type JsonRecord = Record<string, unknown>;

export interface TrunkGroupOption {
  id: string;
  label: string;
}

const stringValue = (value: unknown): string => value == null ? '' : String(value).trim();
const normalized = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

const firstValue = (row: JsonRecord, keys: string[]): string => {
  for (const key of keys) {
    const value = stringValue(row[key]);
    if (value) return value;
  }
  return '';
};

/**
 * Peeredge's diagnostic dropdown uses `<relationship>-<trunk>` complete names.
 * The separator is inconsistent: some rows use ` - ` while live rows such as
 * My Country Mobile use no spaces at all. Return only the trunk portion when
 * the complete name belongs to the requested relationship.
 */
export function trunkNameFromCompleteName(completeName: string, relationshipName: string): string | null {
  const complete = completeName.trim();
  const relationship = relationshipName.trim();
  if (!complete || !relationship) return null;
  if (!normalized(complete).startsWith(normalized(relationship))) return null;

  const remainder = complete.slice(relationship.length);
  const separator = remainder.match(/^\s*[-\u2013\u2014]\s*/);
  if (!separator) return remainder.trim() === '' ? '' : null;
  return remainder.slice(separator[0].length).trim();
}

/**
 * Scope the switch-wide trunk response by immutable relationship/carrier ID
 * whenever Peeredge supplies one. Older response variants omit that ID, so a
 * boundary-aware complete-name fallback is retained for those rows.
 */
export function scopedTrunkGroups(
  rows: JsonRecord[],
  relationshipId: string,
  relationshipName: string,
): TrunkGroupOption[] {
  const groups: TrunkGroupOption[] = [];

  for (const row of rows) {
    const id = firstValue(row, ['id', 'trunk_group_id', 'value']);
    if (!id) continue;

    const ownerId = firstValue(row, [
      'carrier_id_customer',
      'customer_carrier_id',
      'relationship_id',
      'carrier_id',
    ]);
    if (ownerId && ownerId !== relationshipId) continue;

    const carrierName = firstValue(row, ['relationship_name', 'customer_name', 'carrier_name']);
    const completeName = firstValue(row, ['complete_name', 'full_name', 'label', 'name']);
    const trunkName = firstValue(row, ['trunk_group_name', 'trunk_name']);
    const completeCandidate = completeName || carrierName;
    const parsedName = trunkNameFromCompleteName(completeCandidate, relationshipName);
    const carrierMatches = normalized(carrierName) === normalized(relationshipName);

    if (!ownerId && !carrierMatches && parsedName === null) continue;

    const label = trunkName || parsedName || completeCandidate;
    if (label) groups.push({ id, label });
  }

  return [...new Map(groups.map((group) => [group.id, group])).values()]
    .sort((a, b) => a.label.localeCompare(b.label));
}
