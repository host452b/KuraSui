import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { dayNumber, trendSeries } from '../domain';
import type { HealthRecord } from '../domain';

export default function TrendChart({
  record,
  records,
  date,
}: {
  record?: HealthRecord;
  records: HealthRecord[];
  date: string;
}) {
  const series = record ? trendSeries(records, record, date) : [];
  const data = series.map((r) => ({
    stamp: dayNumber(r.date) * 86400000,
    value: r.kind === 'lesion' ? r.dimensions?.[0] : r.value,
    date: r.date,
  }));
  const tick = (value: number) => new Date(value).toISOString().slice(5, 10).replace('-', '/');
  return (
    <div className="trend-card">
      <div className="section-heading">
        <h3>
          <TrendingUp size={16} />
          变化轨迹
        </h3>
        <span className="micro">{series.length} 次记录</span>
      </div>
      <div className="trend-caption">
        <strong>{record?.metric ?? '选择一项指标'}</strong>
        <span>
          {record?.kind === 'lesion' ? '第 1 维尺寸 · ' : ''}
          {record?.unit}
        </span>
      </div>
      {data.length ? (
        <div
          className="chart-wrap"
          role="img"
          aria-label={`${record?.metric}趋势，${series.map((r) => `${r.date}: ${r.value ?? r.dimensions?.[0]}`).join('；')}`}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={data} margin={{ top: 12, right: 12, bottom: 3, left: -24 }}>
              <CartesianGrid vertical={false} stroke="#e7ebe4" strokeDasharray="3 4" />
              <XAxis
                dataKey="stamp"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={tick}
                tick={{ fontSize: 10, fill: '#89958b' }}
                tickLine={false}
                axisLine={false}
                minTickGap={25}
                tickCount={4}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#89958b' }}
                tickLine={false}
                axisLine={false}
                tickCount={4}
              />
              <Tooltip
                labelFormatter={(v) => new Date(Number(v)).toISOString().slice(0, 10)}
                formatter={(v) => [`${v} ${record?.unit ?? ''}`, record?.metric]}
                contentStyle={{ borderRadius: 10, border: '1px solid #dfe6dc', fontSize: 12 }}
              />
              <Line
                type="linear"
                dataKey="value"
                stroke="#658567"
                strokeWidth={2}
                dot={{ r: 3.5, fill: '#f8faf4', stroke: '#658567', strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="chart-empty">暂无可绘制的数值记录</div>
      )}
      <p className="chart-footnote">截至 {date} · 连线仅辅助阅读，不代表连续测量</p>
    </div>
  );
}
