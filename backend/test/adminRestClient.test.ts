import assert from 'node:assert/strict';
import test from 'node:test';
import type { PeeredgeSession } from '../src/adapters/peeredge/PeeredgeSession.js';
import { relationshipStartsWithBrandPrefix } from '../src/adapters/peeredge/relationshipFilter.js';
import { scopedTrunkGroups, trunkNameFromCompleteName } from '../src/adapters/peeredge/trunkGroupFilter.js';

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

test('parses Peeredge complete trunk names with or without separator spacing', () => {
  assert.equal(
    trunkNameFromCompleteName(
      'ED - My Country Mobile Pte Ltd-ED - My Country Mobile USA SD',
      'ED - My Country Mobile Pte Ltd',
    ),
    'ED - My Country Mobile USA SD',
  );
  assert.equal(
    trunkNameFromCompleteName('ED- Tru Telco - ED- Tru Telco SD', 'ED- Tru Telco'),
    'ED- Tru Telco SD',
  );
  assert.equal(
    trunkNameFromCompleteName('My Country Mobile PTE LTD-My Country Mobile SD', 'ED - My Country Mobile Pte Ltd'),
    null,
  );
});

test('scopes live My Country Mobile customer trunks without leaking another carrier', () => {
  const groups = scopedTrunkGroups([
    {
      id: 1440,
      complete_name: 'ED - My Country Mobile Pte Ltd-ED - My Country Mobile USA CONVO',
    },
    {
      id: 1439,
      complete_name: 'ED - My Country Mobile Pte Ltd-ED - My Country Mobile USA SD',
    },
    {
      id: 9999,
      complete_name: 'My Country Mobile PTE LTD-My Country Mobile SD',
    },
    {
      id: 7777,
      carrier_id: 506,
      carrier_name: 'ED - My Country Mobile Pte Ltd',
      trunk_group_name: 'Wrong carrier trunk',
    },
  ], '509', 'ED - My Country Mobile Pte Ltd');

  assert.deepEqual(groups, [
    { id: '1440', label: 'ED - My Country Mobile USA CONVO' },
    { id: '1439', label: 'ED - My Country Mobile USA SD' },
  ]);
});

test('refreshes the Peeredge relationship directory after 180 seconds', async () => {
  process.env.JWT_SECRET ??= 'relationship-cache-test-secret-32-characters';
  process.env.PEEREDGE_SOURCE ??= 'mock';
  const { AdminRestClient } = await import('../src/adapters/peeredge/AdminRestClient.js');
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 10_000;
  let requests = 0;
  Date.now = () => now;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(JSON.stringify(requests === 1
      ? [{ id: 1, carrier_name: 'ED - Existing' }]
      : [{ id: 1, carrier_name: 'ED - Existing' }, { id: 2, carrier_name: 'ED - New' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const session = {
    requestHeaders: async () => ({}),
    refresh: async () => undefined,
  } as unknown as PeeredgeSession;

  try {
    const client = new AdminRestClient('https://api.example.test', session, 'ED');
    assert.deepEqual((await client.listRelationships()).map((relationship) => relationship.id), ['1']);

    now += 179_999;
    assert.deepEqual((await client.listRelationships()).map((relationship) => relationship.id), ['1']);
    assert.equal(requests, 1);

    now += 1;
    assert.deepEqual((await client.listRelationships()).map((relationship) => relationship.id), ['1', '2']);
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
