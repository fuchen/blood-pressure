export type ImportContext = { defaultYear?: number; instructions: string };

export function importContext(defaultYear: string, instructions: string): ImportContext {
  const year = defaultYear.trim();
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100)) {
    throw new Error('默认年份请填写 1900–2100 之间的四位年份，或留空');
  }
  if (instructions.trim().length > 2000) throw new Error('补充说明最多 2000 字');
  return { defaultYear: year ? Number(year) : undefined, instructions: instructions.trim() };
}

export function contextText(context?: ImportContext) {
  return JSON.stringify({ defaultYear: context?.defaultYear ?? null, instructions: context?.instructions ?? '' });
}
