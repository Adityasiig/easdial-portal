const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Peeredge relationship names are not formatted consistently: the same brand
 * prefix may be followed by ` - `, `-`, or a plain space. Match all of those
 * forms while preserving a word boundary so a prefix such as `ED` does not
 * accidentally include an unrelated name such as `EDITH Telecom`.
 */
export const relationshipStartsWithBrandPrefix = (name: string, brandPrefix: string): boolean => {
  const normalizedPrefix = brandPrefix.trim();
  if (!normalizedPrefix) return false;
  return new RegExp(`^\\s*${escapeRegExp(normalizedPrefix)}(?=\\s|-|$)`, 'i').test(name);
};
