import { useState, type FormEvent } from 'react';
import { Card, Field, Heading } from '../../components/ui';
import { api, mutate } from '../../services/api';

type SendResult = { success: true; providerResponse: unknown };

export default function WhatsAppTestPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('WannaTalk WhatsApp test message.');
  const [busy, setBusy] = useState(false);
  const [sendResult, setSendResult] = useState<unknown>(null);
  const [history, setHistory] = useState<unknown>(null);
  const [error, setError] = useState('');

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSendResult(null);
    setHistory(null);
    try {
      const result = await mutate<SendResult>('/whatsapp-test/send', 'POST', { phoneNumber, message });
      setSendResult(result.providerResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'WhatsApp send failed');
    } finally {
      setBusy(false);
    }
  }

  async function loadHistory() {
    if (!phoneNumber.trim()) return setError('Enter a mobile number first');
    setBusy(true);
    setError('');
    setHistory(null);
    try {
      const result = await api<{ history: unknown }>(`/whatsapp-test/history?phoneNumber=${encodeURIComponent(phoneNumber)}`);
      setHistory(result.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load WhatsApp history');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <Heading title="WhatsApp test" subtitle="Admin-only utility for checking the WhatsApp connection and message history." />
      <Card>
        <p className="notice">Use a number you control and include its country code, for example 27821234567. A send response confirms the API accepted the request; check provider history for its latest message status. Test sends are not added to patient delivery history.</p>
        <form onSubmit={send}>
          <fieldset className="form-reset" disabled={busy}>
            <div className="form-grid">
              <Field label="Mobile number" full>
                <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="27821234567" autoComplete="tel" />
              </Field>
              <Field label="Test message" full>
                <textarea required maxLength={1000} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
              </Field>
            </div>
            <div className="modal-actions space-top">
              <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send test WhatsApp'}</button>
              <button type="button" className="btn secondary" disabled={busy || !phoneNumber.trim()} onClick={() => void loadHistory()}>
                Check provider history
              </button>
            </div>
          </fieldset>
        </form>
        {error && <div className="notice space-top" role="alert">{error}</div>}
        {sendResult !== null && <section className="space-top" aria-live="polite"><h3>Provider send response</h3><pre className="whatsapp-test-response">{JSON.stringify(sendResult, null, 2)}</pre></section>}
        {history !== null && <section className="space-top" aria-live="polite"><h3>Provider message history</h3><pre className="whatsapp-test-response">{JSON.stringify(history, null, 2)}</pre></section>}
      </Card>
    </section>
  );
}
