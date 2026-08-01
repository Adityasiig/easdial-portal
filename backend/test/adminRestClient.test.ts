import assert from 'node:assert/strict';
import test from 'node:test';
import { relationshipStartsWithBrandPrefix } from '../src/adapters/peeredge/relationshipFilter.js';

test('matches all supported ED relationship prefix formats', () => {
  const included = [
    'ED - AD Merchants LLC Convo - Customer',
    'ED-belthrough sd premium - Customer',
    'ED- Tru Telco',
    'ED AJOXI LIMITED USA Convo - Customer',
    '  ed - WOLFVOIP LLC SD - Customer',
  ];

  for (const name of included) {
    assert.equal(relationshipStartsWithBrandPrefix(name, 'ED'), true, name);
  }
});

test('does not include relationships that merely contain ED elsewhere', () => {
  const excluded = [
    'Meta-Lynk LLC USA CONVO - Customer',
    'Virelink USA SD - Customer',
    'STRATO VOIP - SD - Customer',
    'TELINTEL LTD CONVO - Customer',
    'EDITH Telecom',
  ];

  for (const name of excluded) {
    assert.equal(relationshipStartsWithBrandPrefix(name, 'ED'), false, name);
  }
});
