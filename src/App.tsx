import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bone,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  FileText,
  GitCompareArrows,
  Heart,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Pencil,
  X,
  CircleDot,
  Clock3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  compareRecords,
  daysBetween,
  displayValue,
  kindNames,
  loadRecords,
  organState,
  organs,
  persistRecords,
  rangeStatus,
  referenceText,
  snapshot,
  today,
  trendSeries,
  upsertRecord,
} from './domain';
import type { Dataset, HealthRecord, OrganId } from './domain';
import { demoRecords } from './data';
import Modal from './components/Modal';
import RecordForm from './components/RecordForm';
import TrendChart from './components/TrendChart';
import CompareDialog from './components/CompareDialog';
const BodyModel = lazy(() => import('./components/BodyModel'));

function read(dataset: Dataset) {
  try {
    return {
      records: loadRecords(localStorage, dataset, dataset === 'demo' ? demoRecords : []),
      error: '',
    };
  } catch {
    return {
      records: [] as HealthRecord[],
      error: '无法读取本地数据。原始数据已保留；请先在数据管理中导出原始备份，避免覆盖。',
    };
  }
}
function initialDataset(): Dataset {
  try {
    return localStorage.getItem('kurasui:workspace') === 'personal' ? 'personal' : 'demo';
  } catch {
    return 'demo';
  }
}
function Status({ record }: { record: HealthRecord }) {
  const status = rangeStatus(record);
  return (
    <span className="status-group">
      {status !== 'unknown' ? (
        <span className={`badge ${status === 'outside' ? 'amber' : 'green'}`}>
          <i />
          {status === 'outside' ? '超出范围' : '范围内'}
        </span>
      ) : (
        <span className="badge neutral">
          {['measurement', 'calculated'].includes(record.kind) ? '无参考范围' : '原始记录'}
        </span>
      )}
      {record.followUp && (
        <span className="badge follow">
          <i />
          需随访
        </span>
      )}
    </span>
  );
}
function MiniChart({ records, record }: { records: HealthRecord[]; record?: HealthRecord }) {
  if (!record) return <span className="mini-empty">—</span>;
  const data = trendSeries(records, record, record.date).filter((r) => r.value !== undefined),
    values = data.map((r) => r.value!);
  if (data.length < 2) return <span className="mini-empty">•</span>;
  const min = Math.min(...values),
    max = Math.max(...values),
    start = Date.parse(data[0].date),
    length = Date.parse(data.at(-1)!.date) - start;
  const points = data
    .map(
      (r) =>
        `${2 + ((Date.parse(r.date) - start) / (length || 1)) * 66},${29 - ((r.value! - min) / (max - min || 1)) * 22}`,
    )
    .join(' ');
  return (
    <svg className="mini-chart" viewBox="0 0 72 36" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={rangeStatus(record) === 'outside' ? '#b38a52' : '#819f7a'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function MetricCard({
  name,
  icon: Icon,
  rows,
  records,
  onSelect,
}: {
  name: string;
  icon: LucideIcon;
  rows: HealthRecord[];
  records: HealthRecord[];
  onSelect: (r: HealthRecord) => void;
}) {
  const record = rows.find((r) => r.metric === name),
    series = record ? trendSeries(records, record, record.date) : [],
    prior = series.filter((r) => r.date < record!.date).at(-1);
  const delta = record && prior ? compareRecords(prior, record).delta?.[0] : undefined;
  const labels: Record<string, string> = {
    体重: '体重',
    收缩压: '收缩压',
    空腹血糖: '空腹血糖',
    'LDL-C': '低密度脂蛋白',
  };
  return (
    <button className="metric-card" onClick={() => record && onSelect(record)} disabled={!record}>
      <div className="metric-title">
        <span>
          <Icon size={14} />
          {labels[name]}
        </span>
        <ArrowUpRight size={13} />
      </div>
      <div className="metric-value">
        <strong>{record ? displayValue(record) : '—'}</strong>
        <span>{record?.unit ?? '暂无数据'}</span>
        <MiniChart records={records} record={record} />
      </div>
      <div className="metric-bottom">
        <span className={record && rangeStatus(record) === 'outside' ? 'text-amber' : 'muted'}>
          {record
            ? rangeStatus(record) === 'outside'
              ? '超出报告范围'
              : rangeStatus(record) === 'within'
                ? '报告范围内'
                : '未提供参考范围'
            : '所选时间暂无记录'}
        </span>
        {delta !== undefined && (
          <span>
            {delta > 0 ? '+' : ''}
            {delta.toFixed(2).replace(/\.00$/, '')} <small>较上次</small>
          </span>
        )}
      </div>
    </button>
  );
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset>(initialDataset),
    [workspace, setWorkspace] = useState(() => read(initialDataset()));
  const { records, error: storageError } = workspace;
  const [date, setDate] = useState(
    () =>
      workspace.records
        .map((r) => r.date)
        .sort()
        .at(-1) ?? today(),
  );
  const [mode, setMode] = useState<'exact' | 'nearby'>('exact'),
    [days, setDays] = useState(30),
    [future, setFuture] = useState(false);
  const [selected, setSelected] = useState<OrganId>(() => (dataset === 'demo' ? 'liver' : 'body')),
    [activeId, setActiveId] = useState<string>();
  const [search, setSearch] = useState(''),
    [onlyFlagged, setOnlyFlagged] = useState(false);
  const [form, setForm] = useState<{ record?: HealthRecord } | null>(null),
    [compare, setCompare] = useState(false),
    [manage, setManage] = useState(false),
    [about, setAbout] = useState(false);
  const [deleting, setDeleting] = useState<HealthRecord | 'all' | null>(null),
    [notice, setNotice] = useState('');
  const dates = useMemo(() => [...new Set(records.map((r) => r.date))].sort(), [records]);
  const visible = useMemo(
    () => snapshot(records, date, mode, days, future),
    [records, date, mode, days, future],
  );
  const organRows = visible.filter((r) => selected === 'body' || r.organ === selected);
  const historical = records
    .filter((r) => (selected === 'body' || r.organ === selected) && r.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const currentOrgan = organs.find((o) => o.id === selected)!;
  const state = organState(organRows, historical, date);
  const active =
    organRows.find((r) => r.id === activeId) ??
    organRows.find((r) => r.value !== undefined || r.kind === 'lesion') ??
    organRows[0];
  const rows = organRows.filter(
    (r) =>
      `${r.metric} ${r.location ?? ''} ${r.source} ${r.text ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!onlyFlagged || rangeStatus(r) === 'outside' || r.followUp),
  );
  const abnormalCount = visible.filter((r) => rangeStatus(r) === 'outside').length,
    followCount = visible.filter((r) => r.followUp).length;
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  function chooseOrgan(id: OrganId) {
    setSelected(id);
    setActiveId(undefined);
    setSearch('');
    setOnlyFlagged(false);
  }
  function chooseRecord(record: HealthRecord) {
    setSelected(record.organ);
    setActiveId(record.id);
    setSearch('');
  }
  function switchWorkspace(next: Dataset) {
    if (next === dataset) return;
    const data = read(next);
    setDataset(next);
    setWorkspace(data);
    setDate(
      data.records
        .map((r) => r.date)
        .sort()
        .at(-1) ?? today(),
    );
    setSelected(next === 'demo' ? 'liver' : 'body');
    setActiveId(undefined);
    setMode('exact');
    setSearch('');
    setOnlyFlagged(false);
    setFuture(false);
    try {
      localStorage.setItem('kurasui:workspace', next);
    } catch {
      setNotice('浏览器无法保存空间偏好');
    }
  }
  function commit(next: HealthRecord[], reset = false) {
    if (storageError && !reset) return storageError;
    try {
      persistRecords(localStorage, dataset, next);
      setWorkspace({ records: next, error: '' });
      return undefined;
    } catch {
      return '保存失败：浏览器存储不可用或空间已满。更改尚未保存，请先导出数据。';
    }
  }
  function saveRecord(record: HealthRecord, confirmed: boolean) {
    try {
      const result = commit(upsertRecord(records, record, confirmed));
      if (result) return result;
      setDate(record.date);
      setMode('exact');
      chooseRecord(record);
      setOnlyFlagged(false);
      setForm(null);
      setNotice('记录已保存在此浏览器');
    } catch (e) {
      return e instanceof Error ? e.message : '无法保存记录';
    }
  }
  function remove() {
    if (!deleting) return;
    const result = commit(
      deleting === 'all' ? [] : records.filter((r) => r.id !== deleting.id),
      deleting === 'all',
    );
    if (result) setNotice(result);
    else {
      setDeleting(null);
      setActiveId(undefined);
      setNotice('记录已删除');
    }
  }
  function exportData(raw = false) {
    try {
      const content = raw
        ? (localStorage.getItem(`kurasui:${dataset}:v1`) ?? '')
        : JSON.stringify(
            {
              app: 'KuraSui',
              version: 1,
              dataset,
              fictional: dataset === 'demo',
              exportedAt: new Date().toISOString(),
              records,
            },
            null,
            2,
          );
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `kurasui-${dataset}-${today()}${raw ? '-raw' : ''}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('已导出到本地下载文件夹');
    } catch {
      setNotice('导出失败，请检查浏览器存储权限');
    }
  }
  function moveDate(direction: -1 | 1) {
    const possible = dates.filter((d) => (direction < 0 ? d < date : d > date));
    const next = direction < 0 ? possible.at(-1) : possible[0];
    if (next) setDate(next);
  }
  function jumpToRecords() {
    document.getElementById('records')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand-symbol"
          title="关于 KuraSui"
          aria-label="关于 KuraSui"
          onClick={() => setAbout(true)}
        >
          <span>k</span>
          <i />
        </button>
        <nav aria-label="主导航">
          <button
            className="nav-icon active"
            title="健康总览"
            aria-label="健康总览"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <LayoutDashboard size={21} />
            <span>总览</span>
          </button>
          <button
            className="nav-icon"
            title="检查记录"
            aria-label="检查记录"
            onClick={jumpToRecords}
          >
            <FileText size={21} />
            <span>记录</span>
          </button>
          <button
            className="nav-icon"
            title="对比检查"
            aria-label="对比检查"
            onClick={() => setCompare(true)}
          >
            <GitCompareArrows size={21} />
            <span>对比</span>
          </button>
          <button
            className="nav-icon"
            title="数据管理"
            aria-label="数据管理"
            onClick={() => setManage(true)}
          >
            <Database size={21} />
            <span>数据</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-icon" aria-label="使用说明" onClick={() => setAbout(true)}>
            <CircleHelp size={20} />
          </button>
          <div className="profile-avatar">我</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <a
            className="wordmark"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            KuraSui<span>身体的时间地图</span>
          </a>
          <div className="topbar-right">
            <span className="local-status">
              <LockKeyhole size={13} />
              数据仅存于本地
            </span>
            <span className="header-divider" />
            <div className="workspace-switch" aria-label="数据空间">
              <button
                className={dataset === 'demo' ? 'active' : ''}
                onClick={() => switchWorkspace('demo')}
              >
                示例空间
              </button>
              <button
                className={dataset === 'personal' ? 'active' : ''}
                onClick={() => switchWorkspace('personal')}
              >
                我的数据
              </button>
            </div>
          </div>
        </header>
        <main className="dashboard">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> PERSONAL HEALTH OBSERVATORY
              </div>
              <h1>
                身体的时间地图<span className="heading-period">.</span>
              </h1>
              <p>让每一次检查，成为了解身体的线索。</p>
            </div>
            <div className="heading-actions">
              <button className="button secondary" onClick={() => exportData()}>
                <ArrowDownToLine size={16} />
                导出数据
              </button>
              <button
                className="button primary"
                onClick={() => setForm({})}
                disabled={!!storageError}
              >
                <Plus size={17} />
                添加记录
              </button>
            </div>
          </section>
          {storageError && (
            <div className="error-banner" role="alert">
              {storageError}
              <button onClick={() => setManage(true)}>数据管理</button>
            </div>
          )}
          <section className="snapshot-toolbar">
            <div className="date-controls">
              <CalendarDays size={17} />
              <label className="sr-only" htmlFor="view-date">
                查看日期
              </label>
              <input
                id="view-date"
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              <span className="toolbar-divider" />
              <div className="segmented">
                <button
                  className={mode === 'exact' ? 'active' : ''}
                  onClick={() => {
                    setMode('exact');
                    setFuture(false);
                  }}
                >
                  单次检查
                </button>
                <button
                  className={mode === 'nearby' ? 'active' : ''}
                  onClick={() => setMode('nearby')}
                >
                  邻近记录
                </button>
              </div>
            </div>
            <span className="demo-indicator">
              <span className={dataset === 'demo' ? 'dot amber-dot' : 'dot'} />
              {dataset === 'demo' ? '虚构示例数据，仅供体验' : '个人空间 · 本地保存'}
            </span>
          </section>
          {mode === 'nearby' && (
            <div className="nearby-options">
              <SlidersHorizontal size={15} />
              <label>
                回看窗口
                <select
                  aria-label="邻近日期窗口"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <option value={7}>7 天</option>
                  <option value={30}>30 天</option>
                  <option value={90}>90 天</option>
                  <option value={180}>180 天</option>
                  <option value={365}>365 天</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={future}
                  onChange={(e) => setFuture(e.target.checked)}
                />
                同时包含之后 {days} 天
              </label>
              <span>
                每条记录保留实际日期{future ? ' · 后续记录单独标记' : ' · 默认排除未来记录'}
              </span>
            </div>
          )}
          <div className="overview-grid">
            <section className="overview-left">
              <div className="section-heading">
                <h2>关键指标</h2>
                <span className="micro">VITALS</span>
              </div>
              <div className="metric-list">
                <MetricCard
                  name="体重"
                  icon={Bone}
                  rows={visible}
                  records={records}
                  onSelect={chooseRecord}
                />
                <MetricCard
                  name="收缩压"
                  icon={Heart}
                  rows={visible}
                  records={records}
                  onSelect={chooseRecord}
                />
                <MetricCard
                  name="空腹血糖"
                  icon={Activity}
                  rows={visible}
                  records={records}
                  onSelect={chooseRecord}
                />
                <MetricCard
                  name="LDL-C"
                  icon={CircleDot}
                  rows={visible}
                  records={records}
                  onSelect={chooseRecord}
                />
              </div>
              <div className="organ-nav-heading">
                <h2>身体导航</h2>
                <span>{organs.length - 1} 个部位</span>
              </div>
              <nav className="organ-navigation" aria-label="器官导航">
                {organs.map((o) => {
                  const rr = visible.filter((r) => o.id === 'body' || r.organ === o.id),
                    os = organState(
                      rr,
                      records.filter((r) => o.id === 'body' || r.organ === o.id),
                      date,
                    );
                  const description = os.outside
                    ? '范围外'
                    : os.followUp
                      ? '随访'
                      : os.missing
                        ? os.stale
                          ? '较旧'
                          : '无数据'
                        : os.within
                          ? '范围内'
                          : '有记录';
                  return (
                    <button
                      key={o.id}
                      aria-label={`选择${o.name}`}
                      className={selected === o.id ? 'selected' : ''}
                      onClick={() => chooseOrgan(o.id)}
                    >
                      <span>
                        <span
                          className={`organ-dot ${os.outside ? 'outside' : os.followUp ? 'follow' : os.missing ? 'missing' : 'within'}`}
                        />
                        {o.name}
                      </span>
                      <small>{description}</small>
                      <ChevronRight size={13} />
                    </button>
                  );
                })}
              </nav>
            </section>
            <Suspense
              fallback={<div className="body-panel model-loading">正在加载身体空间视图…</div>}
            >
              <BodyModel
                selected={selected}
                onSelect={chooseOrgan}
                records={visible}
                history={records}
                date={date}
              />
            </Suspense>
            <section className="detail-column">
              <div className="organ-detail" data-testid="organ-detail">
                <div className="detail-eyebrow">
                  <span>当前关注部位</span>
                  <span className="micro">{currentOrgan.english}</span>
                </div>
                <div className="organ-title">
                  <div className={`organ-avatar ${state.outside ? 'amber-avatar' : ''}`}>
                    <Leaf size={25} strokeWidth={1.4} />
                  </div>
                  <div>
                    <h2>{currentOrgan.name}</h2>
                    <span>
                      {organRows.length} 条记录 ·{' '}
                      {mode === 'exact' ? '单次检查' : `邻近 ${days} 天`}
                    </span>
                  </div>
                  <span className="organ-number">
                    {String(organs.findIndex((o) => o.id === selected)).padStart(2, '0')}
                  </span>
                </div>
                <div className="detail-badges">
                  {state.outside && (
                    <span className="badge amber">
                      <i />
                      指标超出范围
                    </span>
                  )}
                  {state.followUp && (
                    <span className="badge follow">
                      <i />
                      报告注明随访
                    </span>
                  )}
                  {state.within && (
                    <span className="badge green">
                      <i />
                      含范围内指标
                    </span>
                  )}
                  {state.stale && (
                    <span className="badge neutral">
                      <Clock3 size={11} />
                      数据较旧
                    </span>
                  )}
                  {state.missing && <span className="badge neutral">所选时间无数据</span>}
                </div>
                {active ? (
                  <>
                    <div className="selected-observation">
                      <div>
                        <span>{active.metric}</span>
                        <span className="micro">{active.date}</span>
                      </div>
                      <p className="observation-value">
                        {displayValue(active)} <small>{active.unit}</small>
                        {rangeStatus(active) === 'outside' && <ArrowUpRight size={20} />}
                      </p>
                      <span className="reference">
                        {['measurement', 'calculated'].includes(active.kind)
                          ? `报告参考：${referenceText(active)} ${active.refLow !== undefined || active.refHigh !== undefined ? active.unit : ''}`
                          : `${active.location ?? kindNames[active.kind]}${active.lesionId ? ` · ${active.lesionId}` : ''}`}
                      </span>
                    </div>
                    <div className="source-note">
                      <div>
                        <FileText size={13} />
                        <span>{active.source}</span>
                      </div>
                      <p>{active.text || '本条记录没有附加描述。'}</p>
                    </div>
                    <button className="text-button" onClick={jumpToRecords}>
                      查看部位完整记录 <ArrowRight size={14} />
                    </button>
                  </>
                ) : (
                  <div className="detail-empty">
                    <CircleDot size={28} />
                    <h3>暂无记录</h3>
                    <p>
                      {state.latest
                        ? `最近记录：${state.latest.date}，不在当前时间范围内。`
                        : '这个部位还没有检查记录，暂无数据不代表正常。'}
                    </p>
                    {state.latest ? (
                      <button
                        className="text-button"
                        onClick={() => {
                          setDate(state.latest!.date);
                          setMode('exact');
                        }}
                      >
                        查看最近记录 <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button className="text-button" onClick={() => setForm({})}>
                        添加一条记录 <Plus size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <TrendChart record={active} records={records} date={date} />
              <div className="gentle-note">
                <ShieldCheck size={17} />
                <p>
                  每一种状态，都有记录可循。<span>这里呈现检查事实，不自动作出诊断。</span>
                </p>
              </div>
            </section>
          </div>
          <section className="timeline-section">
            <div className="timeline-heading">
              <div>
                <span className="eyebrow">YOUR HEALTH, OVER TIME</span>
                <h2>把每一个时间点，连成了解。</h2>
              </div>
              <div className="timeline-navigation">
                <span>{dates.length} 个检查日期</span>
                <button
                  className="icon-button"
                  aria-label="上次检查"
                  disabled={!dates.some((d) => d < date)}
                  onClick={() => moveDate(-1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="下次检查"
                  disabled={!dates.some((d) => d > date)}
                  onClick={() => moveDate(1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
            <div className="timeline-track">
              {dates.length ? (
                dates.map((d) => (
                  <button
                    className={`timeline-event ${d === date ? 'active' : ''} ${d > date ? 'future' : ''}`}
                    key={d}
                    onClick={() => setDate(d)}
                    aria-label={`查看 ${d} 检查`}
                  >
                    <span className="timeline-date">{d.replaceAll('-', '.')}</span>
                    <span className="timeline-line">
                      <i />
                      {d === date && <span>当前视图</span>}
                    </span>
                    <span className="timeline-description">
                      {records.some((r) => r.date === d && r.kind === 'lesion')
                        ? '体检与影像记录'
                        : '健康检查'}
                      <small>{records.filter((r) => r.date === d).length} 条记录</small>
                    </span>
                  </button>
                ))
              ) : (
                <div className="timeline-empty">从第一条记录开始，建立你的健康时间线。</div>
              )}
            </div>
            <div className="timeline-legend">
              <span>
                <i className="legend-dot green-dot" />
                报告范围内
              </span>
              <span>
                <i className="legend-dot amber-dot" />
                超出范围
              </span>
              <span>
                <i className="legend-dot follow-dot" />
                报告随访
              </span>
              <span>
                <i className="legend-dot gray-dot" />
                无数据 / 数据较旧
              </span>
              <small>较旧：距查看日期超过 180 天，仅表示数据新鲜度</small>
            </div>
          </section>
          <section className="records-section" id="records">
            <div className="records-heading">
              <div>
                <div className="eyebrow">THE RECORD BEHIND EVERY SIGNAL</div>
                <h2>
                  {selected === 'body' ? '全部健康记录' : `${currentOrgan.name} · 检查记录`}
                  <span>{organRows.length}</span>
                </h2>
              </div>
              <div className="record-actions">
                <div className="search-box">
                  <Search size={15} />
                  <input
                    aria-label="搜索记录"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索指标、报告或部位"
                  />
                  {search && (
                    <button aria-label="清空搜索" onClick={() => setSearch('')}>
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button
                  className={`button secondary ${onlyFlagged ? 'filter-active' : ''}`}
                  aria-pressed={onlyFlagged}
                  onClick={() => setOnlyFlagged((v) => !v)}
                >
                  <Settings2 size={15} />
                  需关注
                </button>
                <button className="button secondary" onClick={() => setCompare(true)}>
                  <GitCompareArrows size={16} />
                  对比检查
                </button>
              </div>
            </div>
            <div className="record-summary">
              <span>
                <i className="dot" />
                当前时间范围：{visible.length} 条记录
              </span>
              <span>{abnormalCount} 项超出参考范围</span>
              <span>{followCount} 条报告注明随访</span>
              <span className="summary-last">
                {mode === 'exact' ? date : `以 ${date} 为基准 · ${days} 天窗口`}
              </span>
            </div>
            <div className="records-table-wrap" data-testid="records-table">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>指标 / 检查发现</th>
                    <th>结果</th>
                    <th>报告参考范围</th>
                    <th>状态</th>
                    <th>检查日期</th>
                    <th>
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={active?.id === r.id ? 'active-row' : ''}>
                      <td>
                        <button className="record-name" onClick={() => chooseRecord(r)}>
                          {r.metric}
                          <ArrowUpRight size={12} />
                        </button>
                        <small>
                          {r.kind === 'lesion'
                            ? `${r.location} · ${r.lesionId}`
                            : `${organs.find((o) => o.id === r.organ)?.name} · ${kindNames[r.kind]}`}
                        </small>
                        {(r.kind === 'report' || r.kind === 'note') && (
                          <p className="record-text">{r.text}</p>
                        )}
                      </td>
                      <td>
                        <strong>{displayValue(r)}</strong> <span className="unit">{r.unit}</span>
                      </td>
                      <td className="reference-cell">{referenceText(r)}</td>
                      <td>
                        <Status record={r} />
                      </td>
                      <td className="date-cell">
                        {r.date}
                        {mode === 'nearby' && (
                          <small className={r.date > date ? 'text-amber' : ''}>
                            {r.date === date
                              ? '基准当日'
                              : r.date > date
                                ? `之后 ${-daysBetween(date, r.date)} 天 · 后续记录`
                                : `${daysBetween(date, r.date)} 天前`}
                          </small>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            aria-label={`编辑 ${r.metric}`}
                            title="编辑记录"
                            onClick={() => setForm({ record: r })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            aria-label={`删除 ${r.metric}`}
                            title="删除记录"
                            onClick={() => setDeleting(r)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <div className="empty-state">
                  <FileText size={28} />
                  <h3>暂无记录</h3>
                  <p>
                    {search || onlyFlagged
                      ? '试试其他关键词，或关闭需关注筛选。'
                      : '选择其他时间，或为这个部位添加第一条检查记录。'}
                  </p>
                  <button className="text-button" onClick={() => setForm({})}>
                    <Plus size={15} />
                    添加健康记录
                  </button>
                </div>
              )}
            </div>
            {active && (
              <details className="record-provenance">
                <summary>
                  查看所选记录的来源与检查背景 <ChevronRight size={13} />
                </summary>
                <dl>
                  <div>
                    <dt>来源</dt>
                    <dd>{active.source}</dd>
                  </div>
                  <div>
                    <dt>检查方式</dt>
                    <dd>{active.method || '未注明'}</dd>
                  </div>
                  <div>
                    <dt>测量条件</dt>
                    <dd>{active.context || '未注明'}</dd>
                  </div>
                  <div>
                    <dt>录入时间</dt>
                    <dd>{new Date(active.enteredAt).toLocaleString('zh-CN')}</dd>
                  </div>
                  <div className="full">
                    <dt>原始描述</dt>
                    <dd>{active.text || '未填写'}</dd>
                  </div>
                </dl>
              </details>
            )}
          </section>
          <footer className="page-footer">
            <span>
              <Leaf size={14} /> KuraSui <i>·</i> 与身体保持对话
            </span>
            <span>数据属于你。理解从记录开始。</span>
            <button onClick={() => setAbout(true)}>
              关于与使用说明 <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCheck size={17} />
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {form && (
        <RecordForm
          record={form.record}
          organ={selected}
          date={date}
          records={records}
          demo={dataset === 'demo'}
          onClose={() => setForm(null)}
          onSave={saveRecord}
        />
      )}
      {compare && (
        <CompareDialog
          records={records}
          date={date}
          organ={selected}
          onClose={() => setCompare(false)}
        />
      )}
      {deleting && (
        <Modal
          title={deleting === 'all' ? '清空当前空间的数据？' : '删除这条记录？'}
          subtitle={
            deleting === 'all'
              ? `将删除${dataset === 'demo' ? '示例空间' : '个人空间'}内的全部记录。另一个空间不受影响。此操作不能撤销，建议先导出。`
              : `${deleting.metric} · ${deleting.date}。此操作不能撤销。`
          }
          onClose={() => setDeleting(null)}
        >
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setDeleting(null)}>
              取消
            </button>
            <button className="button danger" onClick={remove}>
              <Trash2 size={15} />
              确认删除
            </button>
          </div>
        </Modal>
      )}
      {manage && (
        <Modal
          title="你的记录，你来掌握"
          subtitle="示例空间与个人空间独立保存。数据仅在当前浏览器内可用。"
          onClose={() => setManage(false)}
        >
          <div className="manage-content">
            <div className="storage-card">
              <Database size={24} />
              <div>
                <h3>{dataset === 'demo' ? '示例空间' : '我的数据'}</h3>
                <p>
                  {records.length} 条记录 · {dates.length} 个检查日期
                </p>
              </div>
              <span className="badge green">
                <LockKeyhole size={11} />
                本地
              </span>
            </div>
            <div className="inline-note">
              <ShieldCheck size={19} />
              <p>
                清理浏览器数据会移除这些记录。请定期导出 JSON
                备份。此版本不提供账号、云同步、文件导入或本地加密。
              </p>
            </div>
            <button className="management-row" onClick={() => exportData(!!storageError)}>
              <ArrowDownToLine size={18} />
              <span>
                <strong>{storageError ? '导出原始备份' : '导出当前空间'}</strong>
                <small>JSON 格式 · 包含原始记录与来源</small>
              </span>
              <ArrowRight size={16} />
            </button>
            <button
              className="management-row destructive"
              onClick={() => {
                setManage(false);
                setDeleting('all');
              }}
            >
              <Trash2 size={18} />
              <span>
                <strong>清空当前空间</strong>
                <small>只删除当前空间，另一个空间保持独立</small>
              </span>
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {about && (
        <Modal
          title="让记录，帮助你了解身体"
          subtitle="KuraSui · 个人健康观察台"
          onClose={() => setAbout(false)}
        >
          <div className="about-content">
            <div className="about-mark">
              <Sparkles size={28} />
            </div>
            <p>
              从一条指标到一个器官，从一次检查到一段时间。这里把分散的健康记录，放回身体与时间的坐标中。
            </p>
            <h3>从这里开始</h3>
            <ol>
              <li>体验示例空间，或切换到「我的数据」。</li>
              <li>添加检查结果，保留原报告单位、参考范围和日期。</li>
              <li>选择器官与时间，查看记录、趋势和检查对比。</li>
            </ol>
            <h3>如何理解这些状态</h3>
            <p>
              颜色对应已录入的报告参考范围与随访标记。没有数据不代表正常，数值变化不自动表示改善或恶化。较旧标记只说明距查看日期超过
              180 天，不是复查建议。
            </p>
            <h3>人体与计算指数</h3>
            <p>
              人体及病灶位置为可交互示意，不是医学影像重建。BMI、FLI、FIB-4
              均需手动录入已有结果。模型不会诊断疾病或建议治疗。
            </p>
            <h3>存储与备份</h3>
            <p>
              数据保存在此浏览器的本地存储中，不上传。清理浏览器会删除数据，请使用导出功能备份。示例数据及参考范围均为虚构。
            </p>
            <button className="button primary" onClick={() => setAbout(false)}>
              <Check size={16} />
              开始探索
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
