import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCdrColumns } from '../src/adapters/peeredge/cdrQuery.js';
import type { CdrQuery } from '../src/adapters/peeredge/types.js';

const base: CdrQuery = {
  direction: 'termination',
  startTime: '2026-08-02T00:00:00Z',
  endTime: '2026-08-02T23:59:59Z',
  status: 'all',
};

const asMap = (query: CdrQuery, customer = 'customer-10', vendor = 'vendor-20') =>
  new Map(buildCdrColumns(query, customer, vendor).map((column) => [column.name, column.value]));

test('termination maps customer to originating and vendor to terminating trunk', () => {
  const columns = asMap(base);
  assert.equal(columns.get('orig_trunk_group_id'), 'customer-10');
  assert.equal(columns.get('term_trunk_group_id'), 'vendor-20');
  assert.equal(columns.get('orig_trunk_group_type'), '1');
  assert.equal(columns.get('term_trunk_group_type'), '2');
});

test('origination maps vendor to originating and customer to terminating trunk', () => {
  const columns = asMap({ ...base, direction: 'origination' });
  assert.equal(columns.get('orig_trunk_group_id'), 'vendor-20');
  assert.equal(columns.get('term_trunk_group_id'), 'customer-10');
  assert.equal(columns.get('orig_trunk_group_type'), '2');
  assert.equal(columns.get('term_trunk_group_type'), '1');
});

test('advanced filters and B-leg selection are emitted exactly once', () => {
  const columns = buildCdrColumns({
    ...base,
    ani: '1214',
    dnis: '1972',
    releaseCode: '16',
    callId: 'call-123',
    includeBLeg: true,
  }, 'customer-10', 'vendor-20');
  const values = new Map(columns.map((column) => [column.name, column.value]));
  assert.equal(values.get('from_did'), '1214');
  assert.equal(values.get('to_did'), '1972');
  assert.equal(values.get('sip_code'), '16');
  assert.equal(values.get('callid'), 'call-123');
  assert.equal(values.has('leg'), false);
});
