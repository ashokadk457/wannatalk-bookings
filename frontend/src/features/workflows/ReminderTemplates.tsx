import { useId, useRef, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { Field } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { mutate } from '../../services/api';
import { ResourceState } from './shared';

export type Content = { subject: string; message: string };
type Template = Content & { id: string; name: string; language: string; channel: string };
export const defaultReminder: Content = {
  subject: 'Appointment reminder',
  message:
    'Dear {{patient_name}}, this is a reminder of your appointment with {{provider_name}} on {{appointment_date}} at {{start_time}}.\nMode: {{mode}}',
};
export const reminderFields = [
  '{{patient_name}}',
  '{{provider_name}}',
  '{{appointment_date}}',
  '{{start_time}}',
  '{{end_time}}',
  '{{mode}}',
];

function Editor({
  language,
  channel,
  value,
  onChange,
}: {
  language: string;
  channel: string;
  value: Content;
  onChange: (value: Content) => void;
}) {
  const resource = useResource<{ templates: Template[] }>('/reminder-templates');
  const { notify } = useApp();
  const [id, setId] = useState(''),
    [name, setName] = useState(''),
    [saving, setSaving] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const templates = (resource.value?.templates || []).filter(
    (t) => t.language === language && t.channel === channel,
  );
  async function save(asNew: boolean) {
    if (!name.trim() || !value.message.trim() || (channel === 'email' && !value.subject.trim()))
      return notify('Enter a template name and message; email also needs a subject.');
    setSaving(true);
    try {
      const result = await mutate<{ template: Template }>(
        asNew ? '/reminder-templates' : `/reminder-templates/${id}`,
        asNew ? 'POST' : 'PUT',
        { ...value, name, language, channel },
      );
      setId(result.template.id);
      onChange({ subject: result.template.subject, message: result.template.message });
      await resource.reload();
      notify('Template saved');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to save template');
    } finally {
      setSaving(false);
    }
  }
  function insert(token: string) {
    const start = textarea.current?.selectionStart ?? value.message.length;
    const end = textarea.current?.selectionEnd ?? start;
    onChange({
      ...value,
      message: value.message.slice(0, start) + token + value.message.slice(end),
    });
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(start + token.length, start + token.length);
    });
  }
  return (
    <fieldset className="field full location-fields" disabled={saving}>
      <legend>{channel === 'email' ? 'Email template' : 'SMS template'}</legend>
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        retry={() => void resource.reload()}
      />
      {templates.length > 0 && <Field label="Choose saved template" full>
        <select
          value={id}
          onChange={(e) => {
            const template = templates.find((t) => t.id === e.target.value);
            setId(e.target.value);
            setName(template?.name || '');
            if (template) onChange({ subject: template.subject, message: template.message });
          }}
        >
          <option value="">Unsaved draft</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>}
      <Field label="Template name" full>
        <input
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 24-hour reminder"
        />
      </Field>
      {channel === 'email' && (
        <Field label="Email subject" full>
          <input
            maxLength={160}
            value={value.subject}
            onChange={(e) => onChange({ ...value, subject: e.target.value })}
          />
        </Field>
      )}
      <Field label={channel === 'email' ? 'Email body' : 'SMS message'} full>
        <div className="placeholder-toolbar">
          <span>Insert field:</span>
          {reminderFields.map((token) => (
            <button
              type="button"
              className="btn secondary small"
              key={token}
              onClick={() => insert(token)}
            >
              {token}
            </button>
          ))}
        </div>
        <textarea
          ref={textarea}
          maxLength={1000}
          value={value.message}
          onChange={(e) => onChange({ ...value, message: e.target.value })}
        />
        {channel === 'sms' && (
          <small>
            {value.message.length} template characters; final length depends on appointment fields.
          </small>
        )}
      </Field>
      <div className="modal-actions">
        <button
          type="button"
          className="btn secondary small"
          disabled={!id || resource.loading || !!resource.error}
          onClick={() => void save(false)}
        >
          Save changes
        </button>
        <button
          type="button"
          className="btn secondary small"
          disabled={resource.loading || !!resource.error}
          onClick={() => void save(true)}
        >
          Save as new template
        </button>
      </div>
    </fieldset>
  );
}

export default function ReminderTemplates({
  contents,
  onChange,
}: {
  contents: Record<string, Content>;
  onChange: (contents: Record<string, Content>) => void;
}) {
  const [language, setLanguage] = useState('en');
  const tabsId = useId();
  const [drafts, setDrafts] = useState<Record<string, Record<string, Content>>>({
    en: contents,
    af: {
      email: {
        subject: 'Afspraakherinnering',
        message:
          'Beste {{patient_name}}, hierdie is ’n herinnering aan u afspraak met {{provider_name}} op {{appointment_date}} om {{start_time}}.\nAfspraaktipe: {{mode}}',
      },
      sms: {
        subject: '',
        message:
          'Herinnering: {{patient_name}}, u afspraak met {{provider_name}} is op {{appointment_date}} om {{start_time}}.',
      },
    },
  });
  function change(channel: string, value: Content) {
    const next = { ...drafts[language], [channel]: value };
    setDrafts((current) => ({ ...current, [language]: next }));
    onChange(next);
  }
  return (
    <div className="field full">
      <span id={`${tabsId}-label`}>Template language</span>
      <div className="tabs" role="tablist" aria-labelledby={`${tabsId}-label`}>
        {['en', 'af'].map((lang) => (
          <button
            key={lang}
            type="button"
            role="tab"
            id={`${tabsId}-tab-${lang}`}
            aria-controls={`${tabsId}-panel-${lang}`}
            aria-selected={language === lang}
            tabIndex={language === lang ? 0 : -1}
            className={`tab${language === lang ? ' active' : ''}`}
            onClick={() => {
              setLanguage(lang);
              onChange(drafts[lang]);
            }}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 'en' : event.key === 'End' ? 'af' : lang === 'en' ? 'af' : 'en';
              setLanguage(next);
              onChange(drafts[next]);
              document.getElementById(`${tabsId}-tab-${next}`)?.focus();
            }}
          >
            {lang === 'en' ? 'English' : 'Afrikaans'}
          </button>
        ))}
      </div>
      <p className="sub">
        Choose a saved template or edit a draft. Sending does not save changes. WhatsApp uses the
        SMS text.
      </p>
      {['en', 'af'].map((lang) => (
        <div key={lang} id={`${tabsId}-panel-${lang}`} role="tabpanel" aria-labelledby={`${tabsId}-tab-${lang}`} hidden={language !== lang}>
          {['email', 'sms'].map((channel) => (
            <Editor
              key={channel}
              language={lang}
              channel={channel}
              value={drafts[lang][channel]}
              onChange={(value) => change(channel, value)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
