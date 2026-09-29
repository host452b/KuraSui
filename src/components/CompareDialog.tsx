import { useState } from 'react';
import { ArrowRight, GitCompareArrows } from 'lucide-react';
import { compareRecords, displayValue, organs, referenceText, seriesKey } from '../domain';
import type { HealthRecord, OrganId } from '../domain';
import Modal from './Modal';

export default function CompareDialog({
  records,
  date,
  organ,
  onClose,
}: {
  records: HealthRecord[];
  date: string;
  organ: OrganId;
  onClose: () => void;
}) {
  const dates = [...new Set(records.map((r) => r.date))].sort();
  const [left, setLeft] = useState(dates.filter((d) => d < date).at(-1) ?? date),
    [right, setRight] = useState(date),
    [all, setAll] = useState(true);
  const filtered = records.filter((r) => all || r.organ === organ);
  const a = filtered.filter((r) => r.date === left),
    b = filtered.filter((r) => r.date === right);
  const identities = [...new Set([...a, ...b].map(seriesKey))];
  return (
    <Modal
      title="让变化，有迹可循"
      subtitle="按实际检查日期对比。仅对相同单位、检查方式和测量条件计算差值。"
      onClose={onClose}
      wide
    >
      <div className="compare-controls">
        <label>
          较早检查日期
          <input type="date" value={left} onChange={(e) => setLeft(e.target.value)} />
        </label>
        <ArrowRight size={20} />
        <label>
          较晚检查日期
          <input type="date" value={right} onChange={(e) => setRight(e.target.value)} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          全部部位
        </label>
      </div>
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th>指标 / 病灶</th>
              <th>{left}</th>
              <th>{right}</th>
              <th>数值变化</th>
            </tr>
          </thead>
          <tbody>
            {identities.map((key) => {
              const aa = a.filter((r) => seriesKey(r) === key),
                bb = b.filter((r) => seriesKey(r) === key),
                record = bb[0] ?? aa[0];
              const comparison =
                aa.length === 1 && bb.length === 1 ? compareRecords(aa[0], bb[0]) : undefined;
              return (
                <tr key={key}>
                  <td>
                    <strong>{record.metric}</strong>
                    <small>
                      {organs.find((o) => o.id === record.organ)?.name}{' '}
                      {record.lesionId ? `· ${record.location} · ${record.lesionId}` : ''}
                    </small>
                    <small>
                      {record.method || '方式未注明'} · {record.context || '条件未注明'} ·{' '}
                      {record.unit || '无单位'}
                    </small>
                  </td>
                  {[aa, bb].map((items, i) => (
                    <td key={i}>
                      {items.length ? (
                        items.map((r) => (
                          <div key={r.id}>
                            {displayValue(r)} <small className="inline">{r.unit}</small>
                            {['report', 'note'].includes(r.kind) ? (
                              <small>{r.text}</small>
                            ) : (
                              <small>参考：{referenceText(r)}</small>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="muted">缺少记录</span>
                      )}
                    </td>
                  ))}
                  <td>
                    {comparison?.comparable ? (
                      <span className="delta">
                        {comparison.delta?.map((v) => `${v > 0 ? '+' : ''}${v}`).join(' / ')}{' '}
                        <small className="inline">{record.unit}</small>
                      </span>
                    ) : (
                      <span className="muted">
                        {aa.length > 1 || bb.length > 1
                          ? '同日多条，需核对'
                          : (comparison?.reason ?? '缺少可比记录')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!identities.length && (
          <div className="empty-state">
            <GitCompareArrows size={26} />
            <h3>这两个日期暂无记录</h3>
            <p>请选取时间线上已有的检查日期。</p>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <span>差值只描述变化，不代表改善或恶化。病灶尺寸按原维度逐项比较。</span>
        <button className="button secondary" onClick={onClose}>
          完成
        </button>
      </div>
    </Modal>
  );
}
