export type OrganId =
  'body' | 'brain' | 'thyroid' | 'heart' | 'lungs' | 'liver' | 'stomach' | 'kidneys';
export type RecordKind = 'measurement' | 'calculated' | 'lesion' | 'report' | 'note';
export type Dataset = 'demo' | 'personal';
export interface HealthRecord {
  id: string;
  kind: RecordKind;
  organ: OrganId;
  metric: string;
  date: string;
  enteredAt: string;
  source: string;
  method: string;
  context: string;
  unit: string;
  value?: number;
  refLow?: number;
  refHigh?: number;
  text?: string;
  followUp?: boolean;
  lesionId?: string;
  location?: string;
  laterality?: string;
  dimensions?: number[];
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const organs: { id: OrganId; name: string; english: string }[] = [
  { id: 'body', name: '全身概览', english: 'SYSTEMIC' },
  { id: 'brain', name: '脑部', english: 'BRAIN' },
  { id: 'thyroid', name: '甲状腺', english: 'THYROID' },
  { id: 'heart', name: '心脏', english: 'HEART' },
  { id: 'lungs', name: '肺部', english: 'LUNGS' },
  { id: 'liver', name: '肝脏', english: 'LIVER' },
  { id: 'stomach', name: '胃部', english: 'STOMACH' },
  { id: 'kidneys', name: '肾脏', english: 'KIDNEYS' },
];
export const kindNames: Record<RecordKind, string> = {
  measurement: '实测指标',
  calculated: '计算指数 · 手动录入',
  lesion: '病灶随访',
  report: '报告结论',
  note: '个人备注',
};
export const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;
export const daysBetween = (a: string, b: string) => Math.round(dayNumber(a) - dayNumber(b));
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date;
}
export function snapshot(
  records: HealthRecord[],
  date: string,
  mode: 'exact' | 'nearby',
  days: number,
  future = false,
): HealthRecord[] {
  return records
    .filter((r) => {
      const offset = daysBetween(date, r.date);
      return mode === 'exact' ? r.date === date : offset <= days && offset >= (future ? -days : 0);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function rangeStatus(record: HealthRecord): 'within' | 'outside' | 'unknown' {
  if (
    !['measurement', 'calculated'].includes(record.kind) ||
    record.value === undefined ||
    !Number.isFinite(record.value) ||
    (record.refLow === undefined && record.refHigh === undefined)
  )
    return 'unknown';
  return (record.refLow !== undefined && record.value < record.refLow) ||
    (record.refHigh !== undefined && record.value > record.refHigh)
    ? 'outside'
    : 'within';
}
export function seriesKey(r: HealthRecord): string {
  return JSON.stringify([
    r.organ,
    r.kind,
    r.metric.trim(),
    r.unit.trim(),
    r.method.trim(),
    r.context.trim(),
    r.kind === 'lesion' ? r.lesionId : null,
    r.kind === 'lesion' ? r.dimensions?.length : null,
  ]);
}
export function compareRecords(
  a: HealthRecord,
  b: HealthRecord,
): { comparable: boolean; delta?: number[]; reason?: string } {
  if (a.kind === 'lesion' && (!a.lesionId || a.lesionId !== b.lesionId))
    return { comparable: false, reason: '不同病灶，未建立关联' };
  if (seriesKey(a) !== seriesKey(b))
    return { comparable: false, reason: '指标、单位、检查方式、条件或尺寸维度不一致' };
  const av = a.kind === 'lesion' ? a.dimensions : a.value === undefined ? undefined : [a.value];
  const bv = b.kind === 'lesion' ? b.dimensions : b.value === undefined ? undefined : [b.value];
  if (!av?.length || !bv?.length || av.length !== bv.length)
    return { comparable: false, reason: '缺少可比较的数值' };
  return { comparable: true, delta: bv.map((v, i) => Number((v - av[i]).toFixed(6))) };
}
export function trendSeries(
  records: HealthRecord[],
  record: HealthRecord,
  date: string,
): HealthRecord[] {
  return records
    .filter(
      (r) =>
        r.date <= date &&
        seriesKey(r) === seriesKey(record) &&
        (r.value !== undefined || r.dimensions?.length),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function validateRecord(record: HealthRecord): string[] {
  const errors: string[] = [];
  if (!record.id || !record.metric?.trim()) errors.push('请填写指标或记录名称');
  if (!validDate(record.date)) errors.push('检查日期无效');
  if (!organs.some((o) => o.id === record.organ)) errors.push('请选择身体部位');
  if (!(record.kind in kindNames)) errors.push('记录类型无效');
  if (!record.source?.trim()) errors.push('请填写记录来源');
  if (
    typeof record.unit !== 'string' ||
    typeof record.method !== 'string' ||
    typeof record.context !== 'string' ||
    !Number.isFinite(Date.parse(record.enteredAt))
  )
    errors.push('记录元数据无效');
  if (
    ['measurement', 'calculated'].includes(record.kind) &&
    (typeof record.value !== 'number' || !Number.isFinite(record.value))
  )
    errors.push('请填写有效数值');
  if (
    (record.refLow !== undefined && !Number.isFinite(record.refLow)) ||
    (record.refHigh !== undefined && !Number.isFinite(record.refHigh))
  )
    errors.push('参考范围必须为有效数值');
  if (record.refLow !== undefined && record.refHigh !== undefined && record.refLow > record.refHigh)
    errors.push('参考下限不能大于上限');
  if (
    record.kind === 'lesion' &&
    (!record.lesionId ||
      !record.location?.trim() ||
      !record.dimensions?.length ||
      record.dimensions.length > 3 ||
      record.dimensions.some((v) => !Number.isFinite(v) || v <= 0) ||
      !record.unit.trim())
  )
    errors.push('病灶需要标识、部位、单位及 1–3 个大于零的尺寸');
  if (['note', 'report'].includes(record.kind) && !record.text?.trim())
    errors.push('请填写记录内容');
  return errors;
}
export function upsertRecord(
  records: HealthRecord[],
  record: HealthRecord,
  confirmed: boolean,
): HealthRecord[] {
  const errors = validateRecord(record);
  if (errors.length) throw new Error(errors.join('；'));
  if (record.kind === 'lesion') {
    const previous = records.find((r) => r.id === record.id);
    const linked = records.filter((r) => r.id !== record.id && r.lesionId === record.lesionId);
    if (
      linked.some(
        (r) =>
          r.organ !== record.organ ||
          r.laterality !== record.laterality ||
          r.location !== record.location,
      )
    )
      throw new Error('关联病灶的器官、侧别与部位必须一致');
    if (linked.length && previous?.lesionId !== record.lesionId && !confirmed)
      throw new Error('请明确确认这是同一个病灶');
  }
  return records.some((r) => r.id === record.id)
    ? records.map((r) => (r.id === record.id ? record : r))
    : [...records, record];
}
export function loadRecords(
  storage: StorageLike,
  dataset: Dataset,
  seed: HealthRecord[],
): HealthRecord[] {
  const raw = storage.getItem(`kurasui:${dataset}:v1`);
  if (raw === null) return structuredClone(seed);
  const parsed: unknown = JSON.parse(raw);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('version' in parsed) ||
    parsed.version !== 1 ||
    !('records' in parsed) ||
    !Array.isArray(parsed.records) ||
    parsed.records.some((r) => !r || typeof r !== 'object' || validateRecord(r).length) ||
    new Set(parsed.records.map((r) => r.id)).size !== parsed.records.length
  )
    throw new Error('本地数据格式无效，原始数据已保留');
  return parsed.records;
}
export function persistRecords(
  storage: StorageLike,
  dataset: Dataset,
  records: HealthRecord[],
): void {
  storage.setItem(`kurasui:${dataset}:v1`, JSON.stringify({ version: 1, records }));
}
export const displayValue = (r: HealthRecord) =>
  r.kind === 'lesion'
    ? (r.dimensions?.join(' × ') ?? '—')
    : r.value !== undefined
      ? String(r.value)
      : r.kind === 'report'
        ? '报告'
        : '备注';
export const referenceText = (r: HealthRecord) =>
  r.refLow !== undefined && r.refHigh !== undefined
    ? `${r.refLow}–${r.refHigh}`
    : r.refHigh !== undefined
      ? `≤ ${r.refHigh}`
      : r.refLow !== undefined
        ? `≥ ${r.refLow}`
        : '未提供参考范围';
export function organState(rows: HealthRecord[], historical: HealthRecord[], date: string) {
  const latest = historical
    .filter((r) => r.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    outside: rows.some((r) => rangeStatus(r) === 'outside'),
    within: rows.some((r) => rangeStatus(r) === 'within'),
    followUp: rows.some((r) => r.followUp),
    missing: !rows.length,
    stale: !!latest && daysBetween(date, latest.date) > 180,
    latest,
  };
}
