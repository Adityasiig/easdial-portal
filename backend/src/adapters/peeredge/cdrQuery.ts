import type { CdrQuery } from './types.js';

export interface CdrColumn {
  name: string;
  value: string;
}

/**
 * Peeredge stores the customer and vendor on opposite call legs depending on
 * traffic direction. Keep this mapping in one tested function so the UI never
 * has to guess from a trunk label.
 */
export function buildCdrColumns(
  query: CdrQuery,
  customerTrunkGroupId?: string,
  vendorTrunkGroupId?: string,
): CdrColumn[] {
  const termination = query.direction === 'termination';
  const columns: CdrColumn[] = termination
    ? [{ name: 'orig_trunk_group_type', value: '1' }, { name: 'term_trunk_group_type', value: '2' }]
    : [{ name: 'orig_trunk_group_type', value: '2' }, { name: 'term_trunk_group_type', value: '1' }];

  if (customerTrunkGroupId) {
    columns.unshift({ name: termination ? 'orig_trunk_group_id' : 'term_trunk_group_id', value: customerTrunkGroupId });
  }
  if (vendorTrunkGroupId) {
    columns.unshift({ name: termination ? 'term_trunk_group_id' : 'orig_trunk_group_id', value: vendorTrunkGroupId });
  }
  if (!query.includeBLeg) columns.push({ name: 'leg', value: 'A' });
  if (query.ani) columns.push({ name: 'from_did', value: query.ani });
  if (query.dnis) columns.push({ name: 'to_did', value: query.dnis });
  if (query.releaseCode) columns.push({ name: 'sip_code', value: query.releaseCode });
  if (query.callId) columns.push({ name: 'callid', value: query.callId });
  return columns;
}
