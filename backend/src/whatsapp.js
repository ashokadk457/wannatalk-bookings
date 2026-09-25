const WhatsAppApiUrl = process.env.WHATSAPP_API_Url;
const WhatsAppApiKey = process.env.WHATSAPP_API_KEY;

export function whatsAppConfigurationStatus() {
  return {
    configured: Boolean(WhatsAppApiUrl && WhatsAppApiKey),
    url: WhatsAppApiUrl || null,
  };
}

export async function sendWhatsAppMsg({ phoneNumber, message }) {
  if (!WhatsAppApiUrl || !WhatsAppApiKey)
    throw new Error("Whats App configuration is incomplete");

  const response = await fetch(WhatsAppApiUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "X-API-KEY": WhatsAppApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: phoneNumber, message }),
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
