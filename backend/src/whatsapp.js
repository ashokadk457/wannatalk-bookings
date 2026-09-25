export function whatsAppConfigurationStatus() {
  const url = process.env.WHATSAPP_API_URL;
  return {
    configured: Boolean(url && process.env.WHATSAPP_API_KEY),
    url: url || null,
  };
}

export async function sendWhatsAppMsg({ phoneNumber, message }) {
  const WhatsAppApiUrl = process.env.WHATSAPP_API_URL;
  const WhatsAppApiKey = process.env.WHATSAPP_API_KEY;
  if (!WhatsAppApiUrl || !WhatsAppApiKey) throw new Error('WhatsApp configuration is incomplete');
  let normalizedPhone = String(phoneNumber || '').replace(/\D/g, '');
  if (normalizedPhone.startsWith('0')) normalizedPhone = `27${normalizedPhone.slice(1)}`;
  if (!normalizedPhone) throw new Error('Patient has no valid mobile number');

  const response = await fetch(WhatsAppApiUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "X-API-KEY": WhatsAppApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: normalizedPhone, message }),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(
      payload.message || `Whats App service failed (${response.status})`,
    );
  }
  return payload;
}
