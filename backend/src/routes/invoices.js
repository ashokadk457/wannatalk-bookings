import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { generateStoredInvoicePdf, parseInvoiceAmount, formatDate } from '../invoice.js';
import { sendInvoiceEmail } from '../mail.js';
import { authRequired } from '../middleware/authRequired.js';

export const invoicesRouter = Router();
const asyncHandler = fn => (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const cash = value => Math.round(Number(value)*100)/100;
const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):null;
const fail = message => Object.assign(new Error(message),{statusCode:400});
const plusDays=(value,days)=>{const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+Number(days));return date.toISOString().slice(0,10);};
const seededDefaultBank={bankAccountHolder:'Louw Alberts',bankName:'FNB',bankAccountNumber:'63191320620',bankAccountType:'CHEQUE ACCOUNT',bankBranchCode:''};
async function ownsInvoice(db,user,invoice){
  if(user.role==='admin')return true;
  if(!invoice?.provider_id)return false;
  const result=await db.query(`SELECT 1 FROM providers WHERE id=$1 AND user_id=$2`,[invoice.provider_id,user.id]);
  return Boolean(result.rows[0]);
}

async function loadDefaultBank(db){
  const result=await db.query(`SELECT account_holder,bank_name,account_number,account_type,branch_code FROM billing_default_bank_account WHERE singleton=true`);
  const row=result.rows[0];
  return row?{bankAccountHolder:row.account_holder,bankName:row.bank_name,bankAccountNumber:row.account_number,bankAccountType:row.account_type,bankBranchCode:row.branch_code||''}:seededDefaultBank;
}

function issuerFromProfile(profile={},previous={},defaultBank=seededDefaultBank){
  const current=(value,fallback)=>value===null||value===undefined||String(value).trim()===''?fallback:value;
  const name=current(profile.registered_business_name,current(profile.private_practice_name,current(profile.provider_name,previous.name||'WannaTalk')));
  return {
    ...previous,
    name,
    tradingName:current(profile.trading_name,previous.tradingName),
    companyRegistrationNumber:current(profile.company_registration_number,previous.companyRegistrationNumber),
    vatRegistered:profile.vat_registered??previous.vatRegistered??false,
    vatNumber:current(profile.vat_number,previous.vatNumber),
    address:current(profile.billing_address,current(profile.business_address,current(profile.full_address,previous.address))),
    phone:current(profile.billing_phone,current(profile.provider_mobile,previous.phone)),
    email:current(profile.billing_email,current(profile.provider_email,previous.email)),
    bankAccountHolder:current(profile.bank_account_holder,defaultBank.bankAccountHolder),
    bankName:current(profile.bank_name,defaultBank.bankName),
    bankAccountNumber:current(profile.bank_account_number,defaultBank.bankAccountNumber),
    bankAccountType:current(profile.bank_account_type,defaultBank.bankAccountType),
    bankBranchCode:current(profile.bank_branch_code,defaultBank.bankBranchCode),
    remittanceInstructions:current(profile.remittance_instructions,previous.remittanceInstructions),
    logoUrl:current(profile.logo_url,previous.logoUrl),
    brandPrimaryColor:current(profile.brand_primary_color,previous.brandPrimaryColor||'#087b5b'),
    practiceNumber:current(profile.practice_number,previous.practiceNumber),
    professionalRegistrationNumber:current(profile.medical_registration_number,previous.professionalRegistrationNumber),
    providerName:current(profile.provider_name,previous.providerName),
    currency:current(profile.currency_code,previous.currency||'ZAR'),
  };
}

function mapped(header,items){
  ['total_amount','subtotal','discount_total','tax_total','payments_received','outstanding_balance'].forEach(k=>header[k]=Number(header[k]||0));
  return {...header,items:items.map(x=>({...x,amount:Number(x.amount),quantity:Number(x.quantity||1),rate:Number(x.rate||0),discount_amount:Number(x.discount_amount||0),tax_amount:Number(x.tax_amount||0)}))};
}
async function loadInvoice(client,id){
  const h=await client.query(`SELECT i.*,i.issue_date::date::text AS issue_date,i.due_date::date::text AS due_date,u.full_name patient_name,u.email patient_email,u.mobile patient_mobile,p.title patient_title,p.date_of_birth::date::text patient_date_of_birth,pu.full_name provider_name,c.registered_name company_name FROM invoices i JOIN patients p ON p.id=i.patient_id JOIN app_users u ON u.id=p.user_id LEFT JOIN providers pr ON pr.id=i.provider_id LEFT JOIN app_users pu ON pu.id=pr.user_id LEFT JOIN billing_companies c ON c.id=i.company_id WHERE i.id=$1`,[id]);
  if(!h.rows[0])return null;
  const defaultBank=await loadDefaultBank(client);
  if(h.rows[0].provider_id){
    const latest=await client.query(`SELECT bp.*,p.practice_number,p.medical_registration_number,p.private_practice_name,p.full_address,u.full_name provider_name,u.email provider_email,u.mobile provider_mobile FROM providers p JOIN app_users u ON u.id=p.user_id LEFT JOIN provider_billing_profiles bp ON bp.provider_id=p.id WHERE p.id=$1`,[h.rows[0].provider_id]);
    h.rows[0].issuer_snapshot=issuerFromProfile(latest.rows[0]||{},h.rows[0].issuer_snapshot||{},defaultBank);
  } else {
    h.rows[0].issuer_snapshot=issuerFromProfile({},h.rows[0].issuer_snapshot||{},defaultBank);
  }
  const lines=await client.query(`SELECT ii.*,ii.service_date::text,a.appointment_date::date::text appointment_date,a.appointment_time::time::text appointment_time,a.appointment_type,a.mode,COALESCE(pu.full_name,$2) provider_name FROM invoice_items ii LEFT JOIN appointments a ON a.id=ii.appointment_id LEFT JOIN providers p ON p.id=a.provider_id LEFT JOIN app_users pu ON pu.id=p.user_id WHERE ii.invoice_id=$1 ORDER BY COALESCE(ii.service_date,a.appointment_date),ii.created_at`,[id,h.rows[0].provider_name]);
  return mapped(h.rows[0],lines.rows);
}

invoicesRouter.get('/',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{
  await query(`UPDATE invoices SET status='Overdue',updated_at=now() WHERE status='Issued' AND outstanding_balance>0 AND due_at<now()`);
  const result=await query(`SELECT i.id,i.invoice_number,i.provider_id,i.patient_id,i.company_id,i.issue_date::text,i.due_date::text,i.due_at,i.total_amount,i.payments_received,i.outstanding_balance,i.status,i.billing_review,i.billing_review_reason,i.billing_customer_type,u.full_name patient_name,pu.full_name provider_name,c.registered_name company_name,a.appointment_date::text,a.appointment_time::time::text appointment_time,a.appointment_type service,(SELECT COUNT(*)>0 AND BOOL_AND(ap.status='Cancelled') FROM invoice_items iic JOIN appointments ap ON ap.id=iic.appointment_id WHERE iic.invoice_id=i.id) appointments_cancelled FROM invoices i JOIN patients p ON p.id=i.patient_id JOIN app_users u ON u.id=p.user_id LEFT JOIN providers pr ON pr.id=i.provider_id LEFT JOIN app_users pu ON pu.id=pr.user_id LEFT JOIN billing_companies c ON c.id=i.company_id LEFT JOIN LATERAL (SELECT ap.appointment_date,ap.appointment_time,ap.appointment_type FROM invoice_items ii JOIN appointments ap ON ap.id=ii.appointment_id WHERE ii.invoice_id=i.id ORDER BY ii.created_at LIMIT 1) a ON true WHERE i.deleted_at IS NULL AND ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM providers owned WHERE owned.id=i.provider_id AND owned.user_id=$1)) ORDER BY i.issue_date DESC,i.created_at DESC`,[req.user.role==='provider'?req.user.id:null]);
  res.json({invoices:result.rows.map(x=>({...x,total_amount:Number(x.total_amount),payments_received:Number(x.payments_received),outstanding_balance:Number(x.outstanding_balance)}))});
}));

invoicesRouter.get('/deleted',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{
  const result=await query(`SELECT i.id,i.invoice_number,i.issue_date::text,i.total_amount,i.payments_received,i.outstanding_balance,i.status_before_delete,i.deleted_at,i.deleted_by_name,i.deletion_reason,i.billing_customer_type,u.full_name patient_name,pu.full_name provider_name,c.registered_name company_name FROM invoices i JOIN patients p ON p.id=i.patient_id JOIN app_users u ON u.id=p.user_id LEFT JOIN providers pr ON pr.id=i.provider_id LEFT JOIN app_users pu ON pu.id=pr.user_id LEFT JOIN billing_companies c ON c.id=i.company_id WHERE i.deleted_at IS NOT NULL AND ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM providers owned WHERE owned.id=i.provider_id AND owned.user_id=$1)) ORDER BY i.deleted_at DESC`,[req.user.role==='provider'?req.user.id:null]);
  res.json({invoices:result.rows.map(x=>({...x,total_amount:Number(x.total_amount),payments_received:Number(x.payments_received),outstanding_balance:Number(x.outstanding_balance)}))});
}));

invoicesRouter.get('/settings/default-bank',authRequired(['admin']),asyncHandler(async(req,res)=>{
  res.json({bankAccount:await loadDefaultBank({query})});
}));

invoicesRouter.get('/edit-history',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{
  const result=await query(`SELECT h.id,h.invoice_id,h.version_number,h.edited_by_name,h.reason,h.changes,h.created_at,i.invoice_number,u.full_name patient_name,pu.full_name provider_name FROM invoice_edit_history h JOIN invoices i ON i.id=h.invoice_id JOIN patients p ON p.id=i.patient_id JOIN app_users u ON u.id=p.user_id LEFT JOIN providers pr ON pr.id=i.provider_id LEFT JOIN app_users pu ON pu.id=pr.user_id WHERE ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM providers owned WHERE owned.id=i.provider_id AND owned.user_id=$1)) ORDER BY h.created_at DESC`,[req.user.role==='provider'?req.user.id:null]);
  res.json({history:result.rows});
}));

invoicesRouter.get('/edit-history/:historyId',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{
  const result=await query(`SELECT h.*,i.invoice_number FROM invoice_edit_history h JOIN invoices i ON i.id=h.invoice_id WHERE h.id=$1 AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM providers owned WHERE owned.id=i.provider_id AND owned.user_id=$2))`,[req.params.historyId,req.user.role==='provider'?req.user.id:null]);
  if(!result.rows[0])return res.status(404).json({error:'Invoice history version not found'});
  res.json({version:result.rows[0]});
}));

invoicesRouter.put('/settings/default-bank',authRequired(['admin']),asyncHandler(async(req,res)=>{
  const accountHolder=String(req.body.accountHolder||'').trim().slice(0,200);
  const bankName=String(req.body.bankName||'').trim().slice(0,150);
  const accountNumber=String(req.body.accountNumber||'').trim().slice(0,80);
  const accountType=String(req.body.accountType||'').trim().slice(0,80);
  const branchCode=String(req.body.branchCode||'').trim().slice(0,40)||null;
  if(!accountHolder||!bankName||!accountNumber||!accountType)throw fail('Account holder, bank, account number and account type are required');
  const bankAccount=await withTransaction(async client=>{
    const result=await client.query(`INSERT INTO billing_default_bank_account(singleton,account_holder,bank_name,account_number,account_type,branch_code,updated_by_user_id) VALUES(true,$1,$2,$3,$4,$5,$6) ON CONFLICT(singleton) DO UPDATE SET account_holder=EXCLUDED.account_holder,bank_name=EXCLUDED.bank_name,account_number=EXCLUDED.account_number,account_type=EXCLUDED.account_type,branch_code=EXCLUDED.branch_code,updated_at=now(),updated_by_user_id=EXCLUDED.updated_by_user_id RETURNING account_holder,bank_name,account_number,account_type,branch_code`,[accountHolder,bankName,accountNumber,accountType,branchCode,req.user.id]);
    await client.query(`INSERT INTO audit_logs(user_id,user_name,user_role,action,details) VALUES($1,$2,$3,'Updated default bank account',$4::jsonb)`,[req.user.id,req.user.name||req.user.email||'Administrator',req.user.role,JSON.stringify({bankName,accountHolder})]);
    const row=result.rows[0];
    return {bankAccountHolder:row.account_holder,bankName:row.bank_name,bankAccountNumber:row.account_number,bankAccountType:row.account_type,bankBranchCode:row.branch_code||''};
  });
  res.json({bankAccount});
}));

invoicesRouter.post('/',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{
  const requested=Array.isArray(req.body.items)?req.body.items:[]; if(!requested.length)return res.status(400).json({error:'Add at least one invoice line'});
  const invoice=await withTransaction(async client=>{
    const appointmentIds=[...new Set(requested.map(x=>String(x.appointmentId||'')).filter(Boolean))]; let appointments=[];
    if(appointmentIds.length){const found=await client.query(`SELECT a.*,a.appointment_date::text,pt.title,pt.date_of_birth::text,u.full_name patient_name,u.email patient_email,u.mobile patient_mobile,pu.full_name provider_name FROM appointments a JOIN patients pt ON pt.id=a.patient_id JOIN app_users u ON u.id=pt.user_id JOIN providers pr ON pr.id=a.provider_id JOIN app_users pu ON pu.id=pr.user_id WHERE a.id=ANY($1::uuid[]) FOR UPDATE OF a`,[appointmentIds]);if(found.rows.length!==appointmentIds.length)throw fail('One or more appointments no longer exist');appointments=found.rows;}
    const providerId=String(req.body.providerId||appointments[0]?.provider_id||''),patientId=String(req.body.patientId||appointments[0]?.patient_id||'');
    if(!providerId||!patientId)throw fail('Select a provider and patient');
    if(req.user.role==='provider'&&!(await client.query(`SELECT 1 FROM providers WHERE id=$1 AND user_id=$2`,[providerId,req.user.id])).rows[0])throw Object.assign(new Error('Not allowed'),{statusCode:403});
    if(req.user.role==='provider'&&!(await client.query(`SELECT 1 FROM appointments WHERE provider_id=$1 AND patient_id=$2 LIMIT 1`,[providerId,patientId])).rows[0])throw Object.assign(new Error('You may only invoice your own patients'),{statusCode:403});
    if(appointments.some(a=>a.provider_id!==providerId||a.patient_id!==patientId))throw fail('All appointments must belong to the selected provider and patient');
    if(appointments.some(a=>['Cancelled','No-show'].includes(a.status)))throw fail('Cancelled or missed appointments must be reviewed before invoicing');
    if(appointmentIds.length){const d=await client.query(`SELECT i.id FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id WHERE ii.appointment_id=ANY($1::uuid[]) AND i.status NOT IN('Void','Credited') LIMIT 1`,[appointmentIds]);if(d.rows[0])return {...await loadInvoice(client,d.rows[0].id),existing:true};}
    const pr=await client.query(`SELECT bp.*,p.practice_number,p.medical_registration_number,u.full_name provider_name,u.email provider_email,u.mobile provider_mobile FROM provider_billing_profiles bp JOIN providers p ON p.id=bp.provider_id JOIN app_users u ON u.id=p.user_id WHERE bp.provider_id=$1 FOR UPDATE OF bp`,[providerId]);
    const profile=pr.rows[0];if(!profile?.registered_business_name)throw fail('Complete this provider billing profile before issuing an invoice');
    const pt=await client.query(`SELECT p.*,u.full_name,u.email,u.mobile FROM patients p JOIN app_users u ON u.id=p.user_id WHERE p.id=$1`,[patientId]);const patient=pt.rows[0];if(!patient)throw fail('Patient not found');
    const customerType=req.body.billingCustomerType==='company'?'company':'patient';let company=null;
    if(customerType==='company'){const c=await client.query(`SELECT c.* FROM billing_companies c JOIN billing_company_patients cp ON cp.company_id=c.id AND cp.patient_id=$2 WHERE c.id=$1 AND c.is_active=true`,[req.body.companyId,patientId]);company=c.rows[0];if(!company)throw fail('Select an active billing company associated with this patient');}
    const lines=requested.map((item,index)=>{const a=appointments.find(x=>x.id===item.appointmentId),rate=parseInvoiceAmount(item.rate??item.amount),quantity=Number(item.quantity??1),discount=cash(item.discountAmount||0),tax=cash(item.taxAmount||0);if(!rate||!Number.isFinite(quantity)||quantity<=0||discount<0||tax<0)throw fail(`Enter valid values for line ${index+1}`);const amount=cash(rate*quantity-discount+tax);if(amount<=0)throw fail(`Line ${index+1} total must be greater than zero`);return {appointmentId:a?.id||null,serviceDate:isoDate(item.serviceDate)||a?.appointment_date||null,description:String(item.description||a?.appointment_type||'Professional consultation').trim().slice(0,500),tariffCode:String(item.tariffCode||'81305').trim().slice(0,40),icd10Code:String(item.icd10Code||'Z71.9').trim().slice(0,40),documentNumber:String(item.documentNumber||'').trim().slice(0,40),quantity:cash(quantity),rate,discount,tax,amount};});
    const subtotal=cash(lines.reduce((s,x)=>s+x.rate*x.quantity,0)),discount=cash(lines.reduce((s,x)=>s+x.discount,0)),tax=cash(lines.reduce((s,x)=>s+x.tax,0)),total=cash(lines.reduce((s,x)=>s+x.amount,0));
    const issueDate=isoDate(req.body.issueDate)||new Date().toISOString().slice(0,10),firstAppointment=appointments[0],dueDate=isoDate(req.body.dueDate)||firstAppointment?.appointment_date||plusDays(issueDate,company?.payment_terms_days??profile.payment_terms_days??30),dueAt=firstAppointment?`${firstAppointment.appointment_date}T${String(firstAppointment.appointment_time).slice(0,8)}+02:00`:`${dueDate}T23:59:59+02:00`;
    const number=`${profile.invoice_prefix}-${String(profile.invoice_next_number).padStart(profile.invoice_number_padding,'0')}`;
    const issuer=issuerFromProfile(profile,{},await loadDefaultBank(client));
    const customer=company?{type:'company',name:company.registered_name,tradingName:company.trading_name,email:company.billing_email,phone:company.phone,address:company.billing_address,vatNumber:company.vat_number,companyRegistrationNumber:company.company_registration_number,contactName:company.accounts_contact_name}:{type:'patient',name:patient.full_name,title:patient.title,email:patient.email,phone:patient.mobile,address:patient.full_address};
    const saved=await client.query(`INSERT INTO invoices(invoice_number,patient_id,provider_id,company_id,billing_customer_type,created_by_user_id,total_amount,status,issuer_snapshot,customer_snapshot,issue_date,due_date,due_at,subtotal,discount_total,tax_total,outstanding_balance,notes) VALUES($1,$2,$3,$4,$5,$6,$7,'Issued',$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$7,$16) RETURNING id`,[number,patientId,providerId,company?.id||null,customerType,req.user.id,total,JSON.stringify(issuer),JSON.stringify(customer),issueDate,dueDate,dueAt,subtotal,discount,tax,String(req.body.notes||'').trim().slice(0,2000)||null]);
    for(const x of lines)await client.query(`INSERT INTO invoice_items(invoice_id,appointment_id,description,amount,service_date,tariff_code,icd10_code,document_number,quantity,rate,discount_amount,tax_amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[saved.rows[0].id,x.appointmentId,x.description,x.amount,x.serviceDate,x.tariffCode,x.icd10Code,x.documentNumber,x.quantity,x.rate,x.discount,x.tax]);
    await client.query(`UPDATE provider_billing_profiles SET invoice_next_number=invoice_next_number+1,updated_at=now() WHERE provider_id=$1`,[providerId]);
    await client.query(`INSERT INTO audit_logs(user_id,user_name,user_role,action,details) VALUES($1,$2,$3,'Issued invoice',$4::jsonb)`,[req.user.id,req.user.name||req.user.email||'Administrator',req.user.role,JSON.stringify({invoiceId:saved.rows[0].id,invoiceNumber:number,total})]);
    return loadInvoice(client,saved.rows[0].id);
  });res.status(invoice.existing?200:201).json({invoice});
}));

invoicesRouter.get('/:id',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{const x=await withTransaction(c=>loadInvoice(c,req.params.id));if(!x||!(await ownsInvoice({query},req.user,x)))return res.status(404).json({error:'Invoice not found'});res.json({invoice:x});}));
invoicesRouter.get('/:id/pdf',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{const x=await withTransaction(c=>loadInvoice(c,req.params.id));if(!x||!(await ownsInvoice({query},req.user,x)))return res.status(404).json({error:'Invoice not found'});const pdf=await generateStoredInvoicePdf(x);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${x.invoice_number}.pdf"`);res.send(pdf);}));
invoicesRouter.post('/:id/email',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{const x=await withTransaction(c=>loadInvoice(c,req.params.id));if(!x||!(await ownsInvoice({query},req.user,x))||x.deleted_at)return res.status(404).json({error:'Active invoice not found'});const email=x.customer_snapshot?.email||x.patient_email;if(!email)return res.status(400).json({error:'The billing customer does not have an email address'});const pdf=await generateStoredInvoicePdf(x);await sendInvoiceEmail({email,fullName:x.customer_snapshot?.contactName||x.customer_snapshot?.name||x.patient_name,subject:`Invoice ${x.invoice_number} from ${x.issuer_snapshot?.name||'WannaTalk'}`,message:`Please find invoice ${x.invoice_number}, due ${formatDate(x.due_date)}. Amount due: ${x.issuer_snapshot?.currency||'ZAR'} ${x.outstanding_balance.toFixed(2)}.`,pdfBuffer:pdf,filename:`${x.invoice_number}.pdf`});res.json({success:true,message:`Invoice ${x.invoice_number} emailed to ${email}.`});}));

invoicesRouter.patch('/:id',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{
  const reason=String(req.body.reason||'').trim().slice(0,500);
  const requested=Array.isArray(req.body.items)?req.body.items:[];
  if(!reason)throw fail('Enter a reason for editing this invoice');
  if(!requested.length)throw fail('An invoice must contain at least one line');
  const invoice=await withTransaction(async client=>{
    const found=await client.query(`SELECT * FROM invoices WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,[req.params.id]);
    const current=found.rows[0];
    if(!current)throw Object.assign(new Error('Active invoice not found'),{statusCode:404});
    if(!(await ownsInvoice(client,req.user,current)))throw Object.assign(new Error('Active invoice not found'),{statusCode:404});
    const oldItems=(await client.query(`SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY created_at,id`,[current.id])).rows;
    const issueDate=isoDate(req.body.issueDate);const dueDate=isoDate(req.body.dueDate);
    if(!issueDate||!dueDate||dueDate<issueDate)throw fail('Enter valid issue and due dates');
    const lines=requested.map((item,index)=>{const rate=parseInvoiceAmount(item.rate??item.amount),quantity=Number(item.quantity??1),discount=cash(item.discountAmount||0),tax=cash(item.taxAmount||0),serviceDate=isoDate(item.serviceDate);if(!rate||!Number.isFinite(quantity)||quantity<=0||discount<0||tax<0||!serviceDate)throw fail(`Enter valid values for line ${index+1}`);const amount=cash(rate*quantity-discount+tax);if(amount<=0)throw fail(`Line ${index+1} total must be greater than zero`);return{appointmentId:item.appointmentId?String(item.appointmentId):null,serviceDate,description:String(item.description||'Professional consultation').trim().slice(0,500),tariffCode:String(item.tariffCode||'').trim().slice(0,40),icd10Code:String(item.icd10Code||'').trim().slice(0,40),documentNumber:String(item.documentNumber||'').trim().slice(0,40),quantity:cash(quantity),rate,discount,tax,amount};});
    const appointmentIds=[...new Set(lines.map(x=>x.appointmentId).filter(Boolean))];
    if(appointmentIds.length!==lines.filter(x=>x.appointmentId).length)throw fail('The same appointment cannot appear on more than one invoice line');
    if(appointmentIds.length){const valid=await client.query(`SELECT id,provider_id,patient_id FROM appointments WHERE id=ANY($1::uuid[])`,[appointmentIds]);if(valid.rows.length!==appointmentIds.length)throw fail('One or more linked appointments no longer exist');if(req.user.role==='provider'&&valid.rows.some(a=>String(a.provider_id)!==String(current.provider_id)||String(a.patient_id)!==String(current.patient_id)))throw Object.assign(new Error('Not allowed'),{statusCode:403});}
    const subtotal=cash(lines.reduce((sum,x)=>sum+x.rate*x.quantity,0)),discount=cash(lines.reduce((sum,x)=>sum+x.discount,0)),tax=cash(lines.reduce((sum,x)=>sum+x.tax,0)),total=cash(lines.reduce((sum,x)=>sum+x.amount,0));
    const credits=await client.query(`SELECT COALESCE(SUM(amount),0) total FROM billing_credit_notes WHERE invoice_id=$1 AND status='Issued'`,[current.id]);
    const paid=Number(current.payments_received||0),credited=Number(credits.rows[0].total||0),outstanding=Math.max(0,cash(total-paid-credited));
    const status=credited>=total?'Credited':outstanding===0?'Paid':paid>0||credited>0?'Part Paid':new Date(`${dueDate}T23:59:59+02:00`)<new Date()?'Overdue':'Issued';
    const notes=String(req.body.notes||'').trim().slice(0,2000)||null;
    const summary=[];
    if(String(current.issue_date).slice(0,10)!==issueDate)summary.push(`Issue date: ${String(current.issue_date).slice(0,10)} → ${issueDate}`);
    if(String(current.due_date||'').slice(0,10)!==dueDate)summary.push(`Due date: ${String(current.due_date||'').slice(0,10)||'None'} → ${dueDate}`);
    if(Number(current.total_amount)!==total)summary.push(`Total: ${Number(current.total_amount).toFixed(2)} → ${total.toFixed(2)}`);
    if((current.notes||'')!==(notes||''))summary.push('Invoice notes changed');
    const oldLineValues=oldItems.map(x=>({appointmentId:x.appointment_id||null,serviceDate:String(x.service_date||'').slice(0,10),description:x.description,tariffCode:x.tariff_code||'',icd10Code:x.icd10_code||'',documentNumber:x.document_number||'',quantity:Number(x.quantity),rate:Number(x.rate),discount:Number(x.discount_amount),tax:Number(x.tax_amount),amount:Number(x.amount)}));
    if(oldItems.length!==lines.length)summary.push(`Lines: ${oldItems.length} → ${lines.length}`);
    if(JSON.stringify(oldLineValues)!==JSON.stringify(lines))summary.push('Invoice line details changed');
    if(!summary.length)summary.push('No invoice values changed');
    const version=(await client.query(`SELECT COALESCE(MAX(version_number),0)+1 version FROM invoice_edit_history WHERE invoice_id=$1`,[current.id])).rows[0].version;
    await client.query(`INSERT INTO invoice_edit_history(invoice_id,version_number,edited_by_user_id,edited_by_name,reason,invoice_snapshot,changes) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,[current.id,version,req.user.id,req.user.name||req.user.email||'Administrator',reason,JSON.stringify({invoice:current,items:oldItems}),JSON.stringify({summary,beforeTotal:Number(current.total_amount),afterTotal:total,newItems:lines})]);
    await client.query(`UPDATE invoices SET issue_date=$2,due_date=$3,due_at=$4,total_amount=$5,subtotal=$6,discount_total=$7,tax_total=$8,outstanding_balance=$9,status=$10,notes=$11,updated_at=now() WHERE id=$1`,[current.id,issueDate,dueDate,`${dueDate}T23:59:59+02:00`,total,subtotal,discount,tax,outstanding,status,notes]);
    await client.query(`DELETE FROM invoice_items WHERE invoice_id=$1`,[current.id]);
    for(const x of lines)await client.query(`INSERT INTO invoice_items(invoice_id,appointment_id,description,amount,service_date,tariff_code,icd10_code,document_number,quantity,rate,discount_amount,tax_amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[current.id,x.appointmentId,x.description,x.amount,x.serviceDate,x.tariffCode,x.icd10Code,x.documentNumber,x.quantity,x.rate,x.discount,x.tax]);
    await client.query(`INSERT INTO audit_logs(user_id,user_name,user_role,action,details) VALUES($1,$2,$3,'Edited invoice',$4::jsonb)`,[req.user.id,req.user.name||req.user.email||'Administrator',req.user.role,JSON.stringify({invoiceId:current.id,invoiceNumber:current.invoice_number,version,reason,changes:summary})]);
    return loadInvoice(client,current.id);
  });
  res.json({invoice});
}));

invoicesRouter.delete('/:id',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{
  const reason=String(req.body?.reason||'').trim().slice(0,500);
  if(!reason)throw fail('Enter a reason for deleting this invoice');
  await withTransaction(async client=>{
    const found=await client.query(`SELECT id,invoice_number,provider_id,status,payments_received,deleted_at FROM invoices WHERE id=$1 FOR UPDATE`,[req.params.id]);
    const invoice=found.rows[0];
    if(!invoice||invoice.deleted_at)throw Object.assign(new Error('Invoice not found'),{statusCode:404});
    if(!(await ownsInvoice(client,req.user,invoice)))throw Object.assign(new Error('Invoice not found'),{statusCode:404});
    const activity=await client.query(`SELECT EXISTS(SELECT 1 FROM billing_payment_allocations a JOIN billing_payments p ON p.id=a.payment_id WHERE a.invoice_id=$1 AND p.status='Active') has_payment,EXISTS(SELECT 1 FROM billing_credit_notes c WHERE c.invoice_id=$1 AND c.status='Issued') has_credit,EXISTS(SELECT 1 FROM billing_refunds r WHERE r.invoice_id=$1 AND r.status='Paid') has_refund`,[invoice.id]);
    const linked=activity.rows[0];
    if(Number(invoice.payments_received)>0||linked.has_payment||linked.has_credit||linked.has_refund)throw fail('Invoices with payments, credits, or refunds cannot be deleted. Reverse the financial activity first.');
    await client.query(`UPDATE invoices SET status_before_delete=status,status='Void',deleted_at=now(),deleted_by_user_id=$2,deleted_by_name=$3,deletion_reason=$4,updated_at=now() WHERE id=$1`,[invoice.id,req.user.id,req.user.name||req.user.email||'Administrator',reason]);
    await client.query(`INSERT INTO audit_logs(user_id,user_name,user_role,action,details) VALUES($1,$2,$3,'Deleted invoice',$4::jsonb)`,[req.user.id,req.user.name||req.user.email||'Administrator',req.user.role,JSON.stringify({invoiceId:invoice.id,invoiceNumber:invoice.invoice_number,reason,previousStatus:invoice.status})]);
  });
  res.status(204).end();
}));
