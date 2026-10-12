import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultAutomaticTemplates,validateSettings,renderAutomatic} from '../src/automaticReminderContent.js';
const settings={enabled:true, offsets:[15,30,1440], language:'en',templates:defaultAutomaticTemplates};
test('valid settings and disabled defaults',()=>{
  validateSettings(settings);
  validateSettings({...settings,enabled:false,offsets:[]});
  assert.throws(()=>validateSettings({...settings,offsets:[]}),{statusCode:400});
  assert.throws(()=>validateSettings({...settings,offsets:[60]}),{statusCode:400});
});
test('unsupported or incomplete fields cannot be saved',()=>{
  for(const message of ['Hello {{unknown}}','Hello {{patient_name','Hello }}']) {
    const templates=structuredClone(defaultAutomaticTemplates);templates.en.patient.message=message;
    assert.throws(()=>validateSettings({...settings,templates}),{statusCode:400});
  }
});
test('patient and provider messages use the correct recipient',()=>{
  const fields={recipient_name:'Sarah',patient_name:'Sarah',provider_name:'Dr Smith',appointment_date:'2026-10-15',start_time:'10:00',mode:'Online'};
  assert.match(renderAutomatic(defaultAutomaticTemplates.en.patient.message,fields),/Dear Sarah.*Dr Smith/);
  assert.match(renderAutomatic(defaultAutomaticTemplates.en.provider.message,{...fields,recipient_name:'Dr Smith'}),/Dear Dr Smith.*Sarah/);
});
