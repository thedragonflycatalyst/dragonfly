import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { cleanSettings, lastSettings, settingFields, settingsLine } from './equipment-settings';

test('slots by machine name, then by equipment', () => {
  assert.deepEqual(settingFields({ name: 'Leg Extension', gear: ['Machine'] }), ['Seat back', 'Shin pad', 'Range of motion start']);
  assert.deepEqual(settingFields({ name: 'Decline Crunch', gear: ['Decline bench'] }), ['Decline setting', 'Leg roller']);
  assert.deepEqual(settingFields({ name: 'Cable Twists', gear: ['Cable machine'] }), ['Pulley height', 'Attachment']);
  assert.deepEqual(settingFields({ name: 'Barbell Back Squat', gear: ['Barbell'] }), ['J-hook height', 'Safety pin height']);
  assert.deepEqual(settingFields({ name: 'TRX Low Row', gear: ['Suspension trainer (TRX)'] }), ['Strap length']);
  assert.deepEqual(settingFields({ name: 'Incline Dumbbell Press', equipment: 'Dumbbell, Incline bench' }), ['Back angle', 'Seat angle']);
  assert.deepEqual(settingFields({ name: 'Push-up', gear: ['Bodyweight'] }), []);
  assert.deepEqual(settingFields(null), []);
});

test('carry over the newest settings; tidy and show them', () => {
  const hist = [
    { at: '2026-11-08', sets: [], note: null },
    { at: '2026-11-01', sets: [], note: null, settings: { 'Decline setting': '3', 'Leg roller': '' } },
    { at: '2026-10-25', sets: [], note: null, settings: { 'Decline setting': '2' } },
  ];
  assert.deepEqual(lastSettings(hist), { 'Decline setting': '3', 'Leg roller': '' });
  assert.equal(lastSettings([{ at: 'x', sets: [], note: null, settings: { a: ' ' } }]), undefined);
  assert.equal(settingsLine({ 'Decline setting': '3', 'Leg roller': '', 'Seat back': ' 5 ' }), 'Decline setting 3 · Seat back 5');
  assert.deepEqual(cleanSettings({ ' Seat ': ' 4 ', '': 'x' }), { Seat: '4' });
  assert.equal(cleanSettings({}), undefined);
});
