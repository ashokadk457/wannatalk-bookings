export const reminderTokens = ['recipient_name', 'patient_name', 'provider_name', 'appointment_date', 'start_time', 'end_time', 'mode'];
export const defaultAutomaticTemplates = {
  en: {
    patient: { subject: 'Appointment reminder', message: 'Dear {{recipient_name}}, your appointment with {{provider_name}} is on {{appointment_date}} at {{start_time}}.\nAppointment type: {{mode}}.' },
    provider: { subject: 'Upcoming appointment', message: 'Dear {{recipient_name}}, your appointment with {{patient_name}} is on {{appointment_date}} at {{start_time}}.\nAppointment type: {{mode}}.' },
  },
  af: {
    patient: { subject: 'Afspraakherinnering', message: 'Beste {{recipient_name}}, u afspraak met {{provider_name}} is op {{appointment_date}} om {{start_time}}.\nAfspraaktipe: {{mode}}.' },
    provider: { subject: 'Komende afspraak', message: 'Beste {{recipient_name}}, u afspraak met {{patient_name}} is op {{appointment_date}} om {{start_time}}.\nAfspraaktipe: {{mode}}.' },
  },
};
export function validateSettings(body) {
  if (typeof body.enabled !== 'boolean' || !Array.isArray(body.offsets) || body.offsets.some(n => ![15,30,1440].includes(n)) || !['en','af'].includes(body.language) || (body.enabled && !body.offsets.length)) throw Object.assign(new Error('Choose reminder times and a valid language'), { statusCode: 400 });
  for (const language of ['en','af']) for (const kind of ['patient','provider']) {
    const template = body.templates?.[language]?.[kind];
    for (const field of ['subject','message']) {
      const text = template?.[field];
      if (typeof text !== 'string' || !text.trim() || text.length > (field === 'subject' ? 160 : 1000)) throw Object.assign(new Error(`Enter a valid ${language} ${kind} ${field}`), { statusCode: 400 });
      const stripped = text.replace(/\{\{([a-z_]+)\}\}/g, (token,key) => reminderTokens.includes(key) ? '' : token);
      if (stripped.includes('{{') || stripped.includes('}}')) throw Object.assign(new Error('Use only the supported reminder fields'), { statusCode: 400 });
    }
  }
}
export function renderAutomatic(text, fields) {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (_,key) => {
    if (!reminderTokens.includes(key) || fields[key] == null) throw new Error(`Missing reminder field: ${key}`);
    return String(fields[key]);
  });
}
