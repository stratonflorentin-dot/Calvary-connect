const DEMO_DATA_PATTERNS = [
  "dummy",
  "dumyy",
  "demo",
  "test",
  "sample",
  "mock",
  "placeholder",
  "lorem",
  "unknown unknown",
];

export function isDemoLikeText(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const text = String(value).trim().toLowerCase();
  if (!text) return false;
  return DEMO_DATA_PATTERNS.some((pattern) => text.includes(pattern));
}

export function isProductionRecord<T extends Record<string, any>>(
  record: T,
  fields: string[],
): boolean {
  return !fields.some((field) => isDemoLikeText(record?.[field]));
}

export function filterProductionRecords<T extends Record<string, any>>(
  records: T[] | null | undefined,
  fields: string[],
): T[] {
  return (records || []).filter((record) => isProductionRecord(record, fields));
}
