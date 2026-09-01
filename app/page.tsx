"use client";

import { useEffect, useState } from "react";

type PageKey = "dashboard" | "order" | "queue" | "scan";
type Tone = "green" | "orange" | "red" | "yellow";
type MachineState = "IDLE" | "RUNNING" | "ALARM";
type JobState = "READY" | "BOUND" | "RUNNING" | "INTERRUPTED" | "FINISHED";
type AndonState = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

type EventItem = {
  time: string;
  title: string;
  detail: string;
  tone: Tone | "neutral";
};

const navigation: Array<{ key: PageKey; label: string; icon: string }> = [
  { key: "dashboard", label: "生产总览", icon: "01" },
  { key: "order", label: "订单与工序", icon: "02" },
  { key: "queue", label: "操作员任务", icon: "03" },
  { key: "scan", label: "扫码报工", icon: "04" },
];

const initialEvents: EventItem[] = [
  { time: "14:04", title: "工单已释放", detail: "WO-240830-017 的 CNC 精加工任务已派至王工。", tone: "neutral" },
  { time: "14:08", title: "备料完成", detail: "前序工序完成 6 / 20，CNC 工位等待绑定。", tone: "green" },
];

function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return <span className={"badge " + tone}>{label}</span>;
}

function EventList({ events }: { events: EventItem[] }) {
  return (
    <div className="event-list" aria-label="事件时间线">
      {events.map((event, index) => (
        <div className="event" key={event.time + event.title + index}>
          <span className={"event-dot " + (event.tone === "neutral" ? "" : event.tone)} />
          <div className="event-copy">
            <strong>{event.title}</strong>
            <span>{event.time} · {event.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function stateLabel(jobState: JobState, andonState: AndonState | null) {
  if (andonState === "OPEN") return "异常待确认";
  if (andonState === "ACKNOWLEDGED") return "异常处理中";
  if (jobState === "READY") return "待扫码绑定";
  if (jobState === "BOUND") return "已绑定，待开始";
  if (jobState === "RUNNING") return "加工中";
  if (jobState === "INTERRUPTED") return "等待恢复";
  return "已完成";
}

export default function Page() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [completed, setCompleted] = useState(6);
  const [binding, setBinding] = useState(false);
  const [jobState, setJobState] = useState<JobState>("READY");
  const [andonState, setAndonState] = useState<AndonState | null>(null);
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [scanCode, setScanCode] = useState("TASK-CNC-017");
  const [toast, setToast] = useState("模拟网关在线，等待 CNC-01 的执行信号。");

  const planned = 20;
  const progress = Math.round((completed / planned) * 100);
  const machineState: MachineState = andonState ? "ALARM" : jobState === "RUNNING" ? "RUNNING" : "IDLE";
  const canStart = binding && !andonState && jobState === "BOUND";
  const canCycle = jobState === "RUNNING" && !andonState && completed < planned;
  const canRaise = binding && jobState !== "FINISHED" && !andonState;

  function commandId() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "cmd-" + Date.now() + "-" + Math.random();
  }

  function syncRemote(nextCommand: Record<string, unknown>) {
    void fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...nextCommand, commandId: commandId() }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "命令执行失败。");
        const next = payload.state;
        setCompleted(next.completed);
        setBinding(next.binding);
        setJobState(next.jobState);
        setAndonState(next.andonState);
        setEvents(next.events);
        setToast(next.events[0]?.title ? next.events[0].title + "： " + next.events[0].detail : "状态已更新。");
      })
      .catch((error: Error) => setToast(error.message));
  }

  useEffect(() => {
    void fetch("/api/demo")
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("无法加载演示状态。")))
      .then((payload) => {
        const next = payload.state;
        setCompleted(next.completed);
        setBinding(next.binding);
        setJobState(next.jobState);
        setAndonState(next.andonState);
        setEvents(next.events);
      })
      .catch((error: Error) => setToast(error.message));
  }, []);

  function log(title: string, detail: string, tone: EventItem["tone"] = "neutral") {
    const time = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    setEvents((current) => [{ time, title, detail, tone }, ...current].slice(0, 8));
  }

  function bindTask() {
    syncRemote({ type: "BIND_TASK", taskCode: scanCode });
  }

  function startJob() {
    syncRemote({ type: "START_JOB" });
  }

  function signalCycle() {
    syncRemote({ type: "MACHINE_CYCLE_COMPLETED" });
  }

  function raiseAndon() {
    syncRemote({ type: "RAISE_ANDON", code: "SPINDLE_OVERLOAD" });
  }

  function acknowledgeAndon() {
    syncRemote({ type: "ACKNOWLEDGE_ANDON" });
  }

  function resolveAndon() {
    syncRemote({ type: "RESOLVE_ANDON", resolution: "检查刀具并完成复位" });
  }

  function resumeJob() {
    syncRemote({ type: "RESUME_JOB" });
  }

  function completeJob() {
    syncRemote({ type: "COMPLETE_JOB" });
  }

  function resetDemo() {
    syncRemote({ type: "RESET_DEMO" });
    setPage("dashboard");
  }

  const currentMachineTone: Tone = machineState === "ALARM" ? "red" : machineState === "RUNNING" ? "orange" : "green";
  const currentMachineLabel = machineState === "ALARM" ? "报警" : machineState === "RUNNING" ? "运行" : "空闲";

  function Dashboard() {
    return (
      <>
        <div className={"status-banner " + (andonState ? "alert" : "")} role="status">
          <strong>{andonState ? "AT RISK" : "LIVE"}</strong>
          <p>{andonState ? "MES-DEMO-001 存在未关闭 ANDON；CNC 任务已阻塞。" : toast}</p>
        </div>

        <section className="grid-kpi" aria-label="生产关键指标">
          <div className="card kpi"><div className="kpi-label">当前生产订单</div><div className="kpi-value">01</div><div className="kpi-note">MES-DEMO-001 · DN100 球阀</div></div>
          <div className="card kpi"><div className="kpi-label">订单总体进度</div><div className="kpi-value">{progress}%</div><div className="kpi-note positive">{completed} / {planned} 已完成 CNC 节拍</div></div>
          <div className="card kpi"><div className="kpi-label">设备运行</div><div className="kpi-value">2 / 3</div><div className="kpi-note">1 台空闲 · 0 台离线</div></div>
          <div className="card kpi"><div className="kpi-label">待处理 ANDON</div><div className="kpi-value">{andonState ? "01" : "00"}</div><div className={"kpi-note " + (andonState ? "attention" : "positive")}>{andonState ? "CNC-01 主轴过载" : "当前班次无异常"}</div></div>
        </section>

        <div className="dashboard-grid">
          <section className="card section-card">
            <div className="section-title">
              <div><h2>订单工艺节拍线</h2><p>MES-DEMO-001 · DN100 手动球阀 · 计划 20 台</p></div>
              <button className="text-button" onClick={() => setPage("order")}>查看订单详情</button>
            </div>
            <div className="route-head"><strong>WO-240830-017</strong><span className="route-progress">当前：CNC 精加工 · {completed}/{planned}</span></div>
            <div className="route-line">
              <div className="operation done"><div className="operation-node">✓</div><div className="operation-name">备料</div><div className="operation-count">20 / 20</div><div className="operation-status">已完成</div></div>
              <div className={"operation " + (jobState === "FINISHED" ? "done" : "current")}><div className="operation-node">{jobState === "FINISHED" ? "✓" : "2"}</div><div className="operation-name">CNC 精加工</div><div className="operation-count">{completed} / 20</div><div className="operation-status">{stateLabel(jobState, andonState)}</div></div>
              <div className={"operation " + (jobState === "FINISHED" ? "current" : "")}><div className="operation-node">3</div><div className="operation-name">装配</div><div className="operation-count">0 / 20</div><div className="operation-status">{jobState === "FINISHED" ? "任务已释放" : "等待前序"}</div></div>
              <div className="operation"><div className="operation-node">4</div><div className="operation-name">压力测试</div><div className="operation-count">0 / 20</div><div className="operation-status">未开始</div></div>
            </div>
          </section>

          <aside className="card section-card">
            <div className="section-title"><div><h2>设备状态</h2><p>工作中心 · 精加工与装配</p></div></div>
            <div className="machine-list">
              <div className="machine"><div><div className="machine-name">CNC-01</div><div className="machine-detail">{binding ? "关联 TASK-CNC-017" : "等待任务绑定"}</div></div><StatusBadge tone={currentMachineTone} label={currentMachineLabel} /></div>
              <div className="machine"><div><div className="machine-name">ASSY-01</div><div className="machine-detail">等待 CNC 前序完成</div></div><StatusBadge tone="green" label="空闲" /></div>
              <div className="machine"><div><div className="machine-name">TEST-01</div><div className="machine-detail">压力测试工位</div></div><StatusBadge tone="green" label="空闲" /></div>
            </div>
            <div className="andon">
              <h3>ANDON 异常队列</h3>
              {andonState ? (
                <div className="andon-item">
                  <strong>主轴过载 · CNC-01</strong>
                  <span>{andonState === "OPEN" ? "等待李主管确认" : andonState === "ACKNOWLEDGED" ? "李主管处理中" : "已解决，等待恢复加工"}</span>
                  <button onClick={() => setPage("scan")}>进入处置台 →</button>
                </div>
              ) : <div className="empty-and-on">暂无未关闭异常</div>}
            </div>
          </aside>
        </div>

        <div className="lower-grid">
          <section className="card section-card">
            <div className="section-title"><div><h2>当前任务</h2><p>执行记录与工序状态</p></div><button className="text-button" onClick={() => setPage("queue")}>打开任务队列</button></div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>任务</th><th>资源</th><th>人员</th><th>完成</th><th>状态</th></tr></thead>
                <tbody><tr><td><strong className="mono">TASK-CNC-017</strong><br /><span style={{ color: "var(--ink-500)" }}>CNC 精加工</span></td><td className="mono">CNC-01</td><td>王工</td><td className="mono">{completed} / 20</td><td><StatusBadge tone={andonState ? "red" : jobState === "RUNNING" ? "orange" : jobState === "FINISHED" ? "green" : "yellow"} label={stateLabel(jobState, andonState)} /></td></tr></tbody>
              </table>
            </div>
          </section>
          <section className="card section-card"><div className="section-title"><div><h2>事件时间线</h2><p>事实与命令审计</p></div></div><EventList events={events.slice(0, 4)} /></section>
        </div>
      </>
    );
  }

  function OrderPage() {
    const operations = [
      { no: "01", name: "备料", count: "20 / 20", tone: "green" as Tone, label: "已完成" },
      { no: "02", name: "CNC 精加工", count: completed + " / 20", tone: andonState ? "red" as Tone : jobState === "RUNNING" ? "orange" as Tone : jobState === "FINISHED" ? "green" as Tone : "yellow" as Tone, label: stateLabel(jobState, andonState) },
      { no: "03", name: "装配", count: "0 / 20", tone: jobState === "FINISHED" ? "orange" as Tone : "yellow" as Tone, label: jobState === "FINISHED" ? "任务已释放" : "等待前序" },
      { no: "04", name: "压力测试", count: "0 / 20", tone: "yellow" as Tone, label: "未开始" },
    ];
    return (
      <>
        <div className="page-toolbar"><div><h2>订单与工序</h2><p>从订单查看可解释的工序、任务与实际执行记录。</p></div><button className="secondary-button" onClick={() => setPage("dashboard")}>返回生产总览</button></div>
        <div className="detail-layout">
          <section className="card order-summary">
            <h3>MES-DEMO-001 · DN100 手动球阀</h3>
            <div className="order-meta"><span>工单 <b className="mono">WO-240830-017</b></span><span>计划数量 <b>20 台</b></span><span>当前班次 <b>晚班</b></span><span>订单状态 <b>{andonState ? "有风险" : jobState === "FINISHED" ? "加工推进" : "加工中"}</b></span></div>
            <div className="route-rows">
              {operations.map((item) => <div className="route-row" key={item.no}><span>{item.no}</span><b>{item.name}</b><span>{item.count}</span><StatusBadge tone={item.tone} label={item.label} /></div>)}
            </div>
          </section>
          <aside className="card section-card"><div className="section-title"><div><h2>订单事件</h2><p>可追溯事实，不允许直接改状态</p></div></div><EventList events={events} /></aside>
        </div>
      </>
    );
  }

  function QueuePage() {
    return (
      <>
        <div className="page-toolbar"><div><h2>操作员任务队列</h2><p>王工 · 晚班 · 以当前任务为主，不把执行藏在单据表里。</p></div><button className="primary-button" onClick={() => setPage("scan")}>扫码进入工位</button></div>
        <div className="queue-layout">
          <section className="card current-task">
            <StatusBadge tone={andonState ? "red" : jobState === "FINISHED" ? "green" : "orange"} label={stateLabel(jobState, andonState)} />
            <h3>TASK-CNC-017 · CNC 精加工</h3>
            <p>订单 MES-DEMO-001 · DN100 手动球阀。先建立人—机—任务绑定，设备信号才能归属到这一段实际执行。</p>
            <div className="task-facts"><div className="task-fact"><label>设备</label><strong className="mono">CNC-01</strong></div><div className="task-fact"><label>进度</label><strong>{completed} / {planned}</strong></div><div className="task-fact"><label>实际执行</label><strong className="mono">JE-017</strong></div><div className="task-fact"><label>异常</label><strong>{andonState ? "ANDON 开启" : "无"}</strong></div></div>
            <div className="button-row"><button className="primary-button" onClick={() => setPage("scan")}>{binding ? "进入执行台" : "扫码绑定任务"}</button><button className="secondary-button" onClick={resetDemo}>重置演示</button></div>
          </section>
          <section className="card section-card">
            <div className="section-title"><div><h2>我的待办</h2><p>下一步任务由前序完成状态自动释放</p></div></div>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>优先级</th><th>任务</th><th>设备</th><th>计划</th><th>状态</th></tr></thead><tbody>
              <tr><td>01</td><td><strong>CNC 精加工</strong><br /><span className="mono" style={{ color: "var(--ink-500)" }}>TASK-CNC-017</span></td><td className="mono">CNC-01</td><td>晚班</td><td><StatusBadge tone={andonState ? "red" : jobState === "FINISHED" ? "green" : "orange"} label={stateLabel(jobState, andonState)} /></td></tr>
              <tr><td>02</td><td><strong>装配</strong><br /><span className="mono" style={{ color: "var(--ink-500)" }}>TASK-ASSY-017</span></td><td className="mono">ASSY-01</td><td>待释放</td><td><StatusBadge tone={jobState === "FINISHED" ? "orange" : "yellow"} label={jobState === "FINISHED" ? "可领取" : "等待前序"} /></td></tr>
            </tbody></table></div>
          </section>
        </div>
      </>
    );
  }

  function ScanPage() {
    const stepOne = binding ? "done" : "active";
    const stepTwo = jobState === "BOUND" || jobState === "RUNNING" || jobState === "INTERRUPTED" || jobState === "FINISHED" ? "done" : "";
    const stepThree = jobState === "RUNNING" || jobState === "INTERRUPTED" || jobState === "FINISHED" ? "done" : binding ? "active" : "";
    return (
      <div className="scan-screen">
        <div className="page-toolbar"><div><h2>扫码报工 · CNC-01</h2><p>固定工位演示：扫码后建立人—机—任务有效绑定。</p></div><button className="secondary-button" onClick={() => setPage("queue")}>返回任务队列</button></div>
        <section className="card scan-card">
          <div className={"scan-step " + stepOne}><div className="step-number">{binding ? "✓" : "1"}</div><div style={{ flex: 1 }}><h3>扫描工序任务</h3><p>仅允许 READY / DISPATCHED 状态任务建立执行绑定。演示码：TASK-CNC-017。</p><input className="scan-code" aria-label="工序任务码" value={scanCode} onChange={(event) => setScanCode(event.target.value)} disabled={binding} /><div className="button-row" style={{ marginTop: 10 }}><button className="primary-button" onClick={bindTask} disabled={binding}>确认绑定 CNC-01</button></div></div></div>
          <div className={"scan-step " + stepTwo}><div className="step-number">{binding ? "✓" : "2"}</div><div><h3>确认绑定关系</h3><p>{binding ? "王工 · CNC-01 · TASK-CNC-017 · JobExecution JE-017" : "绑定后系统将创建 JobExecution，并接收此后的设备信号。"} </p></div></div>
          <div className={"scan-step " + stepThree}><div className="step-number">{jobState === "FINISHED" ? "✓" : "3"}</div><div><h3>执行与报工</h3><p>{stateLabel(jobState, andonState)} · 已完成 {completed} / {planned}。</p></div></div>
          <div className="action-console">
            <h3>模拟设备网关</h3>
            <p>{toast}</p>
            {jobState === "READY" || jobState === "BOUND" ? <button className="primary-button" onClick={startJob} disabled={!canStart}>开始加工</button> : null}
            {jobState === "RUNNING" ? <button className="primary-button" onClick={signalCycle} disabled={!canCycle}>上报一个加工周期（{completed}/{planned}）</button> : null}
            {andonState === "OPEN" ? <button className="primary-button" onClick={acknowledgeAndon}>班组长确认 ANDON</button> : null}
            {andonState === "ACKNOWLEDGED" ? <button className="primary-button" onClick={resolveAndon}>登记处理并解决异常</button> : null}
            {andonState === "RESOLVED" ? <button className="primary-button" onClick={resumeJob}>确认恢复加工</button> : null}
            {jobState === "FINISHED" ? <button className="primary-button" onClick={() => setPage("order")}>查看已释放的下一工序</button> : null}
            <div className="console-actions">
              <button className="secondary-button" onClick={raiseAndon} disabled={!canRaise}>模拟主轴过载</button>
              <button className="secondary-button" onClick={completeJob} disabled={jobState !== "RUNNING" || Boolean(andonState)}>完工报工（补齐至 20）</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  let view: React.ReactNode = <Dashboard />;
  if (page === "order") view = <OrderPage />;
  if (page === "queue") view = <QueuePage />;
  if (page === "scan") view = <ScanPage />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">GM</div><div className="brand-copy"><strong>GMMS</strong><small>生产执行工作台</small></div></div>
        <span className="nav-label">WORKBENCH</span>
        <nav className="nav" aria-label="主导航">
          {navigation.map((item) => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key)} aria-current={page === item.key ? "page" : undefined}><span className="nav-icon">{item.icon}</span><span className="nav-text">{item.label}</span></button>)}
        </nav>
        <div className="side-footer"><span className="user-dot" />模拟网关在线<br />信号源：CNC-01 / SIM-01</div>
      </aside>
      <main className="main">
        <header className="topbar"><div><div className="eyebrow">WORK CENTER · 晚班</div><h1>{navigation.find((item) => item.key === page)?.label}</h1></div><div className="shift"><span className="live-dot" />08 月 30 日 · 数据每秒刷新</div></header>
        <div className="content">{view}</div>
      </main>
    </div>
  );
}
