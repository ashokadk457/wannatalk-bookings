import test from 'node:test';
import assert from 'node:assert/strict';
import { channelContent, render } from '../src/routes/communications.js';

const target = { patient_name: 'Sarah', provider_name: 'Dr Smith', appointment_date: '2026-10-15', appointment_time: '10:00:00', end_time: '11:00:00', mode: 'Online' };

test('email and SMS retain separate contents and render patient details', () => {
  const contents = channelContent({ channelMessages: {
    email: { subject: 'Appointment for {{patient_name}}', message: 'Dear {{patient_name}}, see {{provider_name}} at {{start_time}}.' },
    sms: { subject: '', message: 'Herinnering {{patient_name}}: {{appointment_date}}.' },
  } }, ['email', 'sms']);
  assert.equal(render(contents.email.subject, target), 'Appointment for Sarah');
  assert.equal(render(contents.email.message, target), 'Dear Sarah, see Dr Smith at 10:00.');
  assert.equal(render(contents.sms.message, target), 'Herinnering Sarah: 2026-10-15.');
});

test('invalid selected channel or unresolved placeholder blocks preparation', () => {
  assert.throws(() => channelContent({ channelMessages: {} }, ['sms']), { statusCode: 400 });
  assert.throws(() => render('{{unknown_field}}', target), { statusCode: 400 });
  assert.throws(() => render('{{appointment_date}}', {}), { statusCode: 400 });
});

test('legacy communications without channel contents continue to work', () => {
  assert.deepEqual(channelContent({ message: 'Hello' }, ['email']), {});
  assert.equal(render('Hello', {}), 'Hello');
});
