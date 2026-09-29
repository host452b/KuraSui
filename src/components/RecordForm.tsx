import { useState } from 'react';
import { Check, Info, Link2 } from 'lucide-react';
import { kindNames, organs, validateRecord } from '../domain';
import type { HealthRecord, OrganId, RecordKind } from '../domain';
import { metricSuggestions } from '../data';
import Modal from './Modal';

type Props = {
  record?: HealthRecord;
  organ: OrganId;
  date: string;
  records: HealthRecord[];
  demo: boolean;
  onClose: () => void;
  onSave: (record: HealthRecord, confirmed: boolean) => string | undefined;
};
export default function RecordForm({ record, organ, date, records, demo, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<HealthRecord>(
    record ?? {
      id: crypto.randomUUID(),
      kind: 'measurement',
      organ,
      metric: '',
      date,
      enteredAt: new Date().toISOString(),
      source: '',
      method: '',
      context: '',
      unit: '',
    },
  );
  const [dimensions, setDimensions] = useState(record?.dimensions?.join(' × ') ?? '');
  const [link, setLink] = useState(record?.lesionId ?? 'new');
  const [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState('');
  const [newLesionId] = useState(() => `LES-${crypto.randomUUID()}`);
  const lesions = Array.from(
    new Map(
      records.filter((r) => r.kind === 'lesion' && r.lesionId).map((r) => [r.lesionId!, r]),
    ).values(),
  );
  const field = <K extends keyof HealthRecord>(key: K, value: HealthRecord[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const numeric = draft.kind === 'measurement' || draft.kind === 'calculated';
  const linkingExisting = draft.kind === 'lesion' && link !== 'new' && link !== record?.lesionId;
  function chooseLesion(id: string) {
    setLink(id);
    setConfirmed(false);
    const selected = lesions.find((r) => r.lesionId === id);
    if (selected)
      setDraft((d) => ({
        ...d,
        organ: selected.organ,
        location: selected.location,
        laterality: selected.laterality,
        metric: selected.metric,
        unit: selected.unit,
        method: selected.method,
        context: selected.context,
      }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: HealthRecord = {
      ...draft,
      metric: draft.metric.trim(),
      source: draft.source.trim(),
      value: numeric ? draft.value : undefined,
      refLow: numeric ? draft.refLow : undefined,
      refHigh: numeric ? draft.refHigh : undefined,
      lesionId: draft.kind === 'lesion' ? (link === 'new' ? newLesionId : link) : undefined,
      dimensions:
        draft.kind === 'lesion'
          ? dimensions
              .split(/[×xX,，\s]+/)
              .filter(Boolean)
              .map(Number)
          : undefined,
      location: draft.kind === 'lesion' ? draft.location : undefined,
      laterality: draft.kind === 'lesion' ? draft.laterality : undefined,
    };
    const invalid = validateRecord(next);
    if (linkingExisting && !confirmed) invalid.push('请勾选确认：这是同一个病灶');
    if (invalid.length) {
      setError(invalid.join('；'));
      return;
    }
    setError(onSave(next, confirmed) ?? '');
  }
  return (
    <Modal
      title={record ? '编辑健康记录' : '添加健康记录'}
      subtitle={
        demo ? '当前为示例空间，修改不会进入我的数据。' : '记录只保存在此浏览器中，不会上传。'
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="record-form">
        <div className="form-grid">
          <label>
            记录类型
            <select
              value={draft.kind}
              onChange={(e) => {
                field('kind', e.target.value as RecordKind);
                setError('');
              }}
            >
              {Object.entries(kindNames).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            身体部位
            <select
              value={draft.organ}
              onChange={(e) => field('organ', e.target.value as OrganId)}
              disabled={linkingExisting}
            >
              {organs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {draft.kind === 'lesion' && (
          <div className="link-block">
            <label>
              <span>
                <Link2 size={15} /> 病灶身份
              </span>
              <select value={link} onChange={(e) => chooseLesion(e.target.value)}>
                <option value="new">新建独立病灶</option>
                {lesions.map((r) => (
                  <option value={r.lesionId} key={r.lesionId}>
                    {r.location} · {r.lesionId}
                  </option>
                ))}
              </select>
            </label>
            <p>仅在明确确认同一病灶时关联。名称相同不会自动合并。</p>
            {linkingExisting && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                我已核对报告，确认这是同一个病灶
              </label>
            )}
          </div>
        )}
        <div className="form-grid">
          <label>
            指标名称
            <input
              list="metric-options"
              value={draft.metric}
              onChange={(e) => field('metric', e.target.value)}
              placeholder={
                draft.kind === 'lesion' ? '例如：肺结节' : '选择常用指标，或输入自定义名称'
              }
              required
              autoFocus
            />
            <datalist id="metric-options">
              {metricSuggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <label>
            检查日期
            <input
              type="date"
              value={draft.date}
              onChange={(e) => field('date', e.target.value)}
              required
            />
          </label>
        </div>
        {numeric && (
          <>
            <div className="form-grid">
              <label>
                数值
                <input
                  type="number"
                  step="any"
                  value={draft.value ?? ''}
                  onChange={(e) =>
                    field('value', e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  placeholder="输入原报告数值"
                  required
                />
              </label>
              <label>
                单位
                <input
                  value={draft.unit}
                  onChange={(e) => field('unit', e.target.value)}
                  placeholder="例如 mmol/L、kg、U/L"
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                参考下限
                <input
                  type="number"
                  step="any"
                  value={draft.refLow ?? ''}
                  onChange={(e) =>
                    field('refLow', e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  placeholder="选填，以原报告为准"
                />
              </label>
              <label>
                参考上限
                <input
                  type="number"
                  step="any"
                  value={draft.refHigh ?? ''}
                  onChange={(e) =>
                    field('refHigh', e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  placeholder="选填，以原报告为准"
                />
              </label>
            </div>
          </>
        )}
        {draft.kind === 'calculated' && (
          <div className="inline-note">
            <Info size={16} />
            当前支持手动录入已有结果，不自动计算。可在下方备注记录公式来源与输入值。
          </div>
        )}
        {draft.kind === 'lesion' && (
          <>
            <div className="form-grid">
              <label>
                具体部位
                <input
                  value={draft.location ?? ''}
                  onChange={(e) => field('location', e.target.value)}
                  placeholder="例如：右肺上叶"
                  required
                  disabled={linkingExisting}
                />
              </label>
              <label>
                侧别
                <select
                  value={draft.laterality ?? ''}
                  onChange={(e) => field('laterality', e.target.value)}
                  disabled={linkingExisting}
                >
                  <option value="">未注明</option>
                  <option>左侧</option>
                  <option>右侧</option>
                  <option>双侧</option>
                  <option>中线</option>
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                病灶尺寸
                <input
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  placeholder="例如 5 × 4 × 3"
                  required
                />
                <small>按原报告顺序，最多 3 个维度</small>
              </label>
              <label>
                单位
                <input
                  value={draft.unit}
                  onChange={(e) => field('unit', e.target.value)}
                  placeholder="例如 mm"
                  required
                />
              </label>
            </div>
          </>
        )}
        <div className="form-grid">
          <label>
            检查方式
            <input
              value={draft.method}
              onChange={(e) => field('method', e.target.value)}
              placeholder="例如：血液检查、低剂量 CT"
            />
          </label>
          <label>
            测量条件
            <input
              value={draft.context}
              onChange={(e) => field('context', e.target.value)}
              placeholder="例如：空腹、晨起、用药情况"
            />
          </label>
        </div>
        <label>
          记录来源
          <input
            value={draft.source}
            onChange={(e) => field('source', e.target.value)}
            placeholder="报告名称、检查机构或个人记录"
            required
          />
        </label>
        <label>
          原始描述与备注
          <textarea
            value={draft.text ?? ''}
            onChange={(e) => field('text', e.target.value)}
            placeholder="保留报告原文、医生建议或个人备注"
            rows={3}
            required={draft.kind === 'report' || draft.kind === 'note'}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.followUp ?? false}
            onChange={(e) => field('followUp', e.target.checked)}
          />
          原报告或医生注明需要随访
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <span>检查日期与录入时间分别保存</span>
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button primary" type="submit">
            <Check size={16} />
            保存记录
          </button>
        </div>
      </form>
    </Modal>
  );
}
