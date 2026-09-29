import { describe, expect, it } from 'vitest';
import {
  snapshot,
  rangeStatus,
  compareRecords,
  upsertRecord,
  loadRecords,
  persistRecords,
  validateRecord,
  trendSeries,
} from './domain';
import type { HealthRecord, StorageLike } from './domain';

const base: HealthRecord = {
  id: 'a',
  kind: 'measurement',
  organ: 'body',
  metric: 'LDL-C',
  value: 3.1,
  unit: 'mmol/L',
  date: '2026-09-01',
  enteredAt: '2026-09-20T00:00:00Z',
  source: '示例检验报告',
  method: '血液检查',
  context: '空腹',
  refHigh: 3.4,
};
const row = (change: Partial<HealthRecord> = {}): HealthRecord => ({ ...base, ...change });
const memory = (): StorageLike => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
};

describe('time snapshots', () => {
  const records = [
    row(),
    row({ id: 'b', date: '2026-08-20' }),
    row({ id: 'c', date: '2026-09-04' }),
    row({ id: 'd', date: '2026-07-01' }),
  ];
  it('uses examination dates rather than entry dates', () =>
    expect(snapshot(records, '2026-09-01', 'exact', 30).map((r) => r.id)).toEqual(['a']));
  it('excludes future records and retains original dates in nearby mode', () =>
    expect(snapshot(records, '2026-09-01', 'nearby', 30).map((r) => r.date)).toEqual([
      '2026-09-01',
      '2026-08-20',
    ]));
  it('includes later data only with an explicit opt in', () =>
    expect(snapshot(records, '2026-09-01', 'nearby', 30, true).map((r) => r.id)).toEqual([
      'c',
      'a',
      'b',
    ]));
  it('does not leak later records into trends', () =>
    expect(trendSeries(records, base, '2026-09-01').map((r) => r.date)).toEqual([
      '2026-07-01',
      '2026-08-20',
      '2026-09-01',
    ]));
});
describe('honest interpretation and comparison', () => {
  it('never calls missing values or absent ranges normal', () => {
    expect(rangeStatus(row({ value: undefined }))).toBe('unknown');
    expect(rangeStatus(row({ refHigh: undefined }))).toBe('unknown');
    expect(rangeStatus(base)).toBe('within');
    expect(rangeStatus(row({ value: 3.8 }))).toBe('outside');
  });
  it('calculates a factual delta only for comparable observations', () =>
    expect(compareRecords(base, row({ value: 3.5 })).delta).toEqual([0.4]));
  it.each([{ unit: 'mg/dL' }, { method: '另一种检查' }, { context: '非空腹' }, { organ: 'liver' }])(
    'rejects incompatible comparison %o',
    (change) =>
      expect(compareRecords(base, row(change as Partial<HealthRecord>)).comparable).toBe(false),
  );
  it('does not join unlike units into a trend', () =>
    expect(trendSeries([base, row({ id: 'b', unit: 'mg/dL' })], base, '2026-09-01')).toHaveLength(
      1,
    ));
  it('compares dimensions only for the same explicitly linked lesion', () => {
    const lesion = row({
      kind: 'lesion',
      organ: 'lungs',
      metric: '肺结节',
      unit: 'mm',
      value: undefined,
      lesionId: 'lesion-1',
      dimensions: [5, 4],
      location: '右肺上叶',
      laterality: '右侧',
      method: '低剂量 CT',
    });
    expect(compareRecords(lesion, { ...lesion, dimensions: [6, 4] }).delta).toEqual([1, 0]);
    expect(compareRecords(lesion, { ...lesion, lesionId: 'lesion-2' }).comparable).toBe(false);
    expect(compareRecords(lesion, { ...lesion, dimensions: [6] }).comparable).toBe(false);
  });
});
describe('record integrity and local persistence', () => {
  it('requires confirmation when attaching a new observation to an existing lesion', () => {
    const lesion = row({
      kind: 'lesion',
      lesionId: 'lesion-1',
      organ: 'lungs',
      dimensions: [5],
      location: '右肺上叶',
      unit: 'mm',
    });
    expect(() => upsertRecord([lesion], { ...lesion, id: 'b' }, false)).toThrow('确认');
    expect(upsertRecord([lesion], { ...lesion, id: 'b' }, true)).toHaveLength(2);
    expect(upsertRecord([lesion], { ...lesion, dimensions: [6] }, false)).toHaveLength(1);
  });
  it('rejects impossible dates, nonfinite values and reversed ranges', () => {
    expect(validateRecord(row({ date: '2026-02-30' }))).not.toHaveLength(0);
    expect(validateRecord(row({ value: NaN }))).not.toHaveLength(0);
    expect(validateRecord(row({ refLow: 5, refHigh: 3 }))).not.toHaveLength(0);
  });
  it('persists edits across reloads and isolates demo from personal data', () => {
    const storage = memory();
    persistRecords(storage, 'demo', [base]);
    persistRecords(storage, 'personal', [row({ id: 'personal' })]);
    expect(loadRecords(storage, 'demo', [])?.[0].id).toBe('a');
    expect(loadRecords(storage, 'personal', [])?.[0].id).toBe('personal');
    persistRecords(storage, 'personal', []);
    expect(loadRecords(storage, 'personal', [base])).toEqual([]);
  });
  it('preserves corrupted storage rather than silently replacing it', () => {
    const storage = memory();
    storage.setItem('kurasui:personal:v1', '{broken');
    expect(() => loadRecords(storage, 'personal', [])).toThrow();
    expect(storage.getItem('kurasui:personal:v1')).toBe('{broken');
  });
});
