import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { generateStoredInvoicePdf, formatDate } from '../invoice.js';
import { sendInvoiceEmail } from '../mail.js';
import { authRequired } from '../middleware/authRequired.js';

export const quotesRouter=Router();
const asyncHandler=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const fail=message=>Object.assign(new Error(message),{statusCode:400});
const cash=value=>Math.round(Number(value)*100)/100;
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):null;
const actor=user=>user.name||user.email||'Administrator';
async function owns(client,user,quote){
  if(user.role==='admin')return true;
  return Boolean((await client.query(`SELECT 1 FROM providers WHERE id=$1 AND user_id=$2`,[quote.provider_id,user.id])).rows[0]);
}
async function issuer(client,providerId){
  const result=await client.query(`SELECT bp.*,p.practice_number,p.medical_registration_number,p.private_practice_name,p.full_address,u.full_name provider_name,u.email provider_email,u.mobile provider_mobile FROM provider_billing_profiles bp JOIN providers p ON p.id=bp.provider_id JOIN app_users u ON u.id=p.user_id WHERE bp.provider_id=$1 FOR UPDATE OF bp`,[providerId]);
  const p=result.rows[0];if(!p?.registered_business_name)throw fail('Complete this provider billing profile before creating a quote');
  const bank=(await client.query(`SELECT account_holder,bank_name,account_number,account_type,branch_code FROM billing_default_bank_account WHERE singleton=true`)).rows[0]||{};
  const take=(value,fallback)=>value===null||value===undefined||String(value).trim()===''?fallback:value;
  return {profile:p,snapshot:{name:take(p.registered_business_name,take(p.private_practice_name,p.provider_name)),tradingName:p.trading_name||null,address:take(p.billing_address,take(p.business_address,p.full_address)),phone:take(p.billing_phone,p.provider_mobile),email:take(p.billing_email,p.provider_email),bankAccountHolder:take(p.bank_account_holder,bank.account_holder||'Louw Alberts'),bankName:take(p.bank_name,bank.bank_name||'FNB'),bankAccountNumber:take(p.bank_account_number,bank.account_number||'63191320620'),bankAccountType:take(p.bank_account_type,bank.account_type||'CHEQUE ACCOUNT'),bankBranchCode:take(p.bank_branch_code,bank.branch_code||''),remittanceInstructions:p.remittance_instructions||null,logoUrl:p.logo_url||null,brandPrimaryColor:p.brand_primary_color||'#087b5b',practiceNumber:p.practice_number||null,professionalRegistrationNumber:p.medical_registration_number||null,currency:p.currency_code||'ZAR'}};
}
async function loadQuote(client,id){
  const result=await client.query(`SELECT q.*,q.issue_date::text,q.valid_until::text,u.full_name patient_name,u.email patient_email,u.mobile patient_mobile,p.title patient_title,p.date_of_birth::text patient_date_of_birth,pu.full_name provider_name FROM billing_quotes q JOIN patients p ON p.id=q.patient_id JOIN app_users u ON u.id=p.user_id JOIN providers pr ON pr.id=q.provider_id JOIN app_users pu ON pu.id=pr.user_id WHERE q.id=$1`,[id]);
  const quote=result.rows[0];if(!quote)return null;
  const items=(await client.query(`SELECT *,service_date::text FROM billing_quote_items WHERE quote_id=$1 ORDER BY created_at,id`,[id])).rows;
  return {...quote,document_type:'Quote',total_amount:Number(quote.total_amount),subtotal:Number(quote.subtotal),discount_total:Number(quote.discount_total),tax_total:Number(quote.tax_total),items:items.map(x=>({...x,amount:Number(x.amount),rate:Number(x.rate),quantity:Number(x.quantity),discount_amount:Number(x.discount_amount),tax_amount:Number(x.tax_amount),provider_name:quote.provider_name}))};
}
function quoteSummary(row){return {...row,total_amount:Number(row.total_amount)};}

quotesRouter.get('/',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{
  const rows=await query(`SELECT q.id,q.quote_number,q.issue_date::text,q.valid_until::text,q.total_amount,q.status,q.deleted_at,u.full_name patient_name,pu.full_name provider_name,c.registered_name company_name FROM billing_quotes q JOIN patients p ON p.id=q.patient_id JOIN app_users u ON u.id=p.user_id JOIN providers pr ON pr.id=q.provider_id JOIN app_users pu ON pu.id=pr.user_id LEFT JOIN billing_companies c ON c.id=q.company_id WHERE q.deleted_at IS NULL AND ($1::uuid IS NULL OR pr.user_id=$1) ORDER BY q.issue_date DESC,q.created_at DESC`,[req.user.role==='provider'?req.user.id:null]);
  res.json({quotes:rows.rows.map(quoteSummary)});
}));

quotesRouter.post('/',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{
  const quote=await withTransaction(async client=>{
    const providerId=String(req.body.providerId||''),patientId=String(req.body.patientId||''),customerType=req.body.billingCustomerType==='company'?'company':'patient',companyId=customerType==='company'?String(req.body.companyId||''):null,issueDate=date(req.body.issueDate)||new Date().toISOString().slice(0,10),validUntil=date(req.body.validUntil);
    if(!providerId||!patientId)throw fail('Select a provider and customer');
    if(validUntil&&validUntil<issueDate)throw fail('Valid-until date cannot be before quote date');
    if(req.user.role==='provider'&&!((await client.query(`SELECT 1 FROM providers WHERE id=$1 AND user_id=$2`,[providerId,req.user.id])).rows[0]))throw Object.assign(new Error('Not allowed'),{statusCode:403});
    if(req.user.role==='provider'&&!((await client.query(`SELECT 1 FROM appointments WHERE provider_id=$1 AND patient_id=$2 LIMIT 1`,[providerId,patientId])).rows[0]))throw Object.assign(new Error('You may only quote your own patients'),{statusCode:403});
    const patient=(await client.query(`SELECT p.*,u.full_name,u.email,u.mobile FROM patients p JOIN app_users u ON u.id=p.user_id WHERE p.id=$1`,[patientId])).rows[0];if(!patient)throw fail('Customer not found');
    let company=null;if(companyId){company=(await client.query(`SELECT c.* FROM billing_companies c JOIN billing_company_patients cp ON cp.company_id=c.id AND cp.patient_id=$2 WHERE c.id=$1 AND c.is_active=true`,[companyId,patientId])).rows[0];if(!company)throw fail('Select an active financially responsible party linked to this customer');}
    const raw=Array.isArray(req.body.items)?req.body.items:[];if(!raw.length)throw fail('Add at least one quote line');
    const items=raw.map((item,index)=>{const quantity=Number(item.quantity??1),rate=Number(item.rate),discount=cash(item.discountAmount||0),tax=cash(item.taxAmount||0),amount=cash(rate*quantity-discount+tax);if(!String(item.description||'').trim()||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(rate)||rate<0||discount<0||tax<0||amount<0)throw fail(`Enter valid values for line ${index+1}`);return {description:String(item.description).trim().slice(0,500),serviceDate:date(item.serviceDate),quantity:cash(quantity),rate:cash(rate),discount,tax,amount};});
    const {profile,snapshot}=await issuer(client,providerId);
    const number=`Q-${profile.invoice_prefix}-${String(profile.quote_next_number).padStart(profile.invoice_number_padding,'0')}`;
    const customer=company?{type:'company',name:company.registered_name,tradingName:company.trading_name,email:company.billing_email,phone:company.phone,address:company.billing_address,contactName:company.accounts_contact_name}:{type:'patient',name:patient.full_name,title:patient.title,email:patient.email,phone:patient.mobile,address:patient.full_address};
    const subtotal=cash(items.reduce((sum,item)=>sum+item.rate*item.quantity,0)),discount=cash(items.reduce((sum,item)=>sum+item.discount,0)),tax=cash(items.reduce((sum,item)=>sum+item.tax,0)),total=cash(items.reduce((sum,item)=>sum+item.amount,0));
    const saved=await client.query(`INSERT INTO billing_quotes(quote_number,provider_id,patient_id,company_id,billing_customer_type,issuer_snapshot,customer_snapshot,issue_date,valid_until,subtotal,discount_total,tax_total,total_amount,notes,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,[number,providerId,patientId,company?.id||null,customerType,JSON.stringify(snapshot),JSON.stringify(customer),issueDate,validUntil,subtotal,discount,tax,total,String(req.body.notes||'').trim().slice(0,2000)||null,req.user.id]);
    for(const item of items)await client.query(`INSERT INTO billing_quote_items(quote_id,description,service_date,quantity,rate,discount_amount,tax_amount,amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[saved.rows[0].id,item.description,item.serviceDate,item.quantity,item.rate,item.discount,item.tax,item.amount]);
    await client.query(`UPDATE provider_billing_profiles SET quote_next_number=quote_next_number+1,updated_at=now() WHERE provider_id=$1`,[providerId]);
    await client.query(`INSERT INTO audit_logs(user_id,user_name,user_role,action,details) VALUES($1,$2,$3,'Created quote',$4::jsonb)`,[req.user.id,actor(req.user),req.user.role,JSON.stringify({quoteId:saved.rows[0].id,quoteNumber:number,total})]);
    return loadQuote(client,saved.rows[0].id);
  });
  res.status(201).json({quote});
}));

quotesRouter.get('/:id/pdf',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{const quote=await withTransaction(c=>loadQuote(c,req.params.id));if(!quote||quote.deleted_at||!(await owns({query},req.user,quote)))return res.status(404).json({error:'Active quote not found'});const pdf=await generateStoredInvoicePdf(quote);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${quote.quote_number}.pdf"`);res.send(pdf);}));
quotesRouter.post('/:id/email',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{const quote=await withTransaction(c=>loadQuote(c,req.params.id));if(!quote||quote.deleted_at||!(await owns({query},req.user,quote)))return res.status(404).json({error:'Active quote not found'});const email=quote.customer_snapshot?.email||quote.patient_email;if(!email)throw fail('The billing customer does not have an email address');const pdf=await generateStoredInvoicePdf(quote);await sendInvoiceEmail({email,fullName:quote.customer_snapshot?.contactName||quote.customer_snapshot?.name||quote.patient_name,subject:`Quote ${quote.quote_number} from ${quote.issuer_snapshot?.name||'WannaTalk'}`,message:`Please find quote ${quote.quote_number}, valid until ${formatDate(quote.valid_until)}. Quote total: ${quote.issuer_snapshot?.currency||'ZAR'} ${quote.total_amount.toFixed(2)}.`,pdfBuffer:pdf,filename:`${quote.quote_number}.pdf`});res.json({success:true,message:`Quote ${quote.quote_number} emailed to ${email}.`});}));
quotesRouter.delete('/:id',authRequired(['admin','provider']),asyncHandler(async(req,res)=>{const reason=String(req.body?.reason||'').trim().slice(0,500);if(!reason)throw fail('Enter a reason for voiding this quote');await withTransaction(async client=>{const found=await client.query(`SELECT * FROM billing_quotes WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,[req.params.id]);const quote=found.rows[0];if(!quote||!(await owns(client,req.user,quote)))throw Object.assign(new Error('Active quote not found'),{statusCode:404});await client.query(`UPDATE billing_quotes SET status='Void',deleted_at=now(),deleted_by_user_id=$2,deleted_by_name=$3,deletion_reason=$4,updated_at=now() WHERE id=$1`,[quote.id,req.user.id,actor(req.user),reason]);await client.query(`INSERT INTO audit_logs(user_id,user_name,user_role,action,details) VALUES($1,$2,$3,'Voided quote',$4::jsonb)`,[req.user.id,actor(req.user),req.user.role,JSON.stringify({quoteId:quote.id,quoteNumber:quote.quote_number,reason})]);});res.status(204).end();}));
