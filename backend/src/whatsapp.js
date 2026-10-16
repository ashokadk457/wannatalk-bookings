export function whatsAppConfigurationStatus() {
  const url = process.env.WHATSAPP_API_URL;
  return {
    configured: Boolean(url && process.env.WHATSAPP_API_KEY),
    url: url || null,
  };
}

function configuration() {
  const configuredUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;
  if (!configuredUrl || !apiKey) throw new Error('WhatsApp configuration is incomplete');
  const baseUrl = configuredUrl.replace(/\/$/, '').replace(/\/messages\/send$/, '');
  return { baseUrl, apiKey };
}

function normalizedWhatsAppPhone(phoneNumber) {
  let phone = String(phoneNumber || '').replace(/\D/g, '');
  if (phone.startsWith('0')) phone = `27${phone.slice(1)}`;
  if (phone.length < 8 || phone.length > 15) throw new Error('Enter a valid phone number with country code');
  return phone;
}

async function requestWhatsApp(path, options = {}) {
  const { baseUrl, apiKey } = configuration();
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { accept: 'application/json', 'X-API-Key': apiKey, ...options.headers },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const causeCode = error?.cause?.code;
    throw new Error(causeCode
      ? `WhatsApp API connection failed (${causeCode})`
      : `WhatsApp API connection failed: ${error instanceof Error ? error.message : 'network error'}`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const providerError = [payload.message, payload.error, payload.detail]
      .find((value) => typeof value === 'string' && value.trim());
    throw new Error(providerError || `WhatsApp service failed (${response.status})`);
  }
  return payload;
}

export async function sendWhatsAppMsg({ phoneNumber, message }) {
  const phone = normalizedWhatsAppPhone(phoneNumber);
  return requestWhatsApp('/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message }),
  });
}

export async function getWhatsAppMessagesByPhone(phoneNumber) {
  const phone = normalizedWhatsAppPhone(phoneNumber);
  return requestWhatsApp(`/messages/by-phone/${encodeURIComponent(phone)}`);
}
