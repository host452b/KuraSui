import type { HealthRecord, OrganId } from './domain';
const records: HealthRecord[] = [];
const add = (data: Omit<HealthRecord, 'id' | 'enteredAt'>) =>
  records.push({ ...data, id: `demo-${records.length + 1}`, enteredAt: `${data.date}T10:30:00Z` });
const dates = ['2025-10-22', '2026-01-08', '2026-03-12', '2026-06-24', '2026-09-18'];
const metric = (
  name: string,
  organ: OrganId,
  values: number[],
  unit: string,
  low?: number,
  high?: number,
  kind: 'measurement' | 'calculated' = 'measurement',
) =>
  dates.forEach((date, i) =>
    add({
      kind,
      organ,
      metric: name,
      date,
      value: values[i],
      unit,
      refLow: low,
      refHigh: high,
      source: '虚构示例 · 年度健康检查',
      method: ['body'].includes(organ) ? '体检测量' : '血液检查',
      context: '示例固定检查条件',
      text: '仅用于演示。参考范围来自虚构报告，不构成个人诊断标准。',
      followUp: false,
    }),
  );
metric('体重', 'body', [75.6, 74.8, 73.9, 72.8, 71.5], 'kg');
metric('身高', 'body', [175, 175, 175, 175, 175], 'cm');
metric('BMI', 'body', [24.7, 24.4, 24.1, 23.8, 23.3], 'kg/m²', 18.5, 24, 'calculated');
metric('收缩压', 'body', [132, 128, 126, 124, 122], 'mmHg', 90, 139);
metric('舒张压', 'body', [85, 82, 80, 80, 78], 'mmHg', 60, 89);
metric('空腹血糖', 'body', [5.9, 5.7, 5.5, 5.4, 5.2], 'mmol/L', 3.9, 6.1);
metric('糖化血红蛋白', 'body', [5.8, 5.7, 5.6, 5.5, 5.5], '%', 4, 6);
metric('LDL-C', 'body', [3.9, 3.8, 3.7, 3.6, 3.52], 'mmol/L', undefined, 3.4);
metric('静息心率', 'heart', [75, 73, 72, 70, 68], '次/分', 60, 100);
metric('ALT', 'liver', [62, 55, 48, 51, 46], 'U/L', 7, 40);
metric('AST', 'liver', [39, 37, 32, 30, 28], 'U/L', 13, 35);
metric('脂肪肝指数 FLI', 'liver', [52, 47, 43, 41, 36], '', undefined, undefined, 'calculated');
metric(
  '肝纤维化指数 FIB-4',
  'liver',
  [1.12, 1.08, 1.03, 1.05, 1.02],
  '',
  undefined,
  undefined,
  'calculated',
);
metric('肌酐', 'kidneys', [81, 80, 82, 79, 78], 'μmol/L', 57, 111);
metric('甲胎蛋白 AFP', 'liver', [4.2, 4.4, 4.1, 4.3, 4.0], 'ng/mL', undefined, 7);
for (const [index, date] of ['2026-03-12', '2026-09-18'].entries()) {
  add({
    kind: 'lesion',
    organ: 'lungs',
    metric: '肺结节',
    date,
    unit: 'mm',
    source: '虚构示例 · 胸部 CT 报告',
    method: '低剂量 CT',
    context: '常规随访',
    lesionId: 'LUNG-001',
    location: '右肺上叶',
    laterality: '右侧',
    dimensions: index ? [5, 4] : [5, 3],
    followUp: true,
    text: '右肺上叶见小结节影。本示例报告记录建议随访；请以真实报告及医生意见为准。',
  });
  add({
    kind: 'lesion',
    organ: 'lungs',
    metric: '肺结节',
    date,
    unit: 'mm',
    source: '虚构示例 · 胸部 CT 报告',
    method: '低剂量 CT',
    context: '常规随访',
    lesionId: 'LUNG-002',
    location: '左肺下叶',
    laterality: '左侧',
    dimensions: [3, 2],
    followUp: true,
    text: '左肺下叶见另一处结节影，与右肺结节独立追踪。',
  });
}
add({
  kind: 'lesion',
  organ: 'thyroid',
  metric: '甲状腺结节',
  date: '2026-09-05',
  unit: 'mm',
  source: '虚构示例 · 超声报告',
  method: '超声',
  context: '常规检查',
  lesionId: 'THY-001',
  location: '甲状腺右叶',
  laterality: '右侧',
  dimensions: [4, 3, 3],
  followUp: true,
  text: '甲状腺右叶见结节，按原报告记录随访。此条日期与最近体检不同。',
});
add({
  kind: 'report',
  organ: 'liver',
  metric: '肝脏超声',
  date: '2026-09-18',
  unit: '',
  source: '虚构示例 · 腹部超声报告',
  method: '超声',
  context: '',
  followUp: true,
  text: '肝实质回声增粗、增强。报告提示脂肪肝改变，建议结合临床并复查。',
});
add({
  kind: 'report',
  organ: 'stomach',
  metric: '胃镜检查',
  date: '2025-10-22',
  unit: '',
  source: '虚构示例 · 内镜报告',
  method: '胃镜',
  context: '',
  text: '胃黏膜检查记录。此条仅用于展示较旧数据，不自动推断当前状态。',
});
export const demoRecords = records;
export const metricSuggestions = [
  '体重',
  '身高',
  'BMI',
  '收缩压',
  '舒张压',
  '静息心率',
  '空腹血糖',
  '糖化血红蛋白',
  'LDL-C',
  'HDL-C',
  '甘油三酯',
  'ALT',
  'AST',
  '脂肪肝指数 FLI',
  '肝纤维化指数 FIB-4',
  '肌酐',
  'eGFR',
  '甲胎蛋白 AFP',
  '癌胚抗原 CEA',
  '肺结节',
  '甲状腺结节',
];
