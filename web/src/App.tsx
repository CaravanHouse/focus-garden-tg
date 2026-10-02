import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { DEMO_SECONDS, KINDS, KIND_NAME, type TreeKind } from "../../shared/constants";
import { api, type TopRow } from "./api";
import { TreeSvg } from "./TreeSvg";
import { load, loadSession, reducer, save, saveSession } from "./store";
import { haptic } from "./tg";
import type { Session } from "./types";

const DURATIONS = [
  { label: "25 мин", seconds: 1500 },
  { label: "15 мин", seconds: 900 },
  { label: "5 мин", seconds: 300 },
  { label: "10 с · демо", seconds: DEMO_SECONDS },
];

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [durIdx, setDurIdx] = useState(0);
  const [session, setSession] = useState<Session | null>(loadSession);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState<boolean | null>(null);
  const [top, setTop] = useState<TopRow[]>([]);
  const [meId, setMeId] = useState<number | null>(null);
  const finishedRef = useRef<number | null>(null);

  useEffect(() => save(state), [state]);

  const refreshTop = () => api.top().then((r) => { setTop(r.top); setMeId(r.meId); setOnline(true); }).catch(() => setOnline(false));
  useEffect(() => { void refreshTop(); }, []);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [session]);

  const remaining = session ? session.endsAt - now : 0;
  const progress = session ? 1 - Math.max(0, remaining) / session.total : 0;

  // время вышло: сажаем дерево локально и подтверждаем на сервере (он пришлёт сообщение в чат)
  useEffect(() => {
    if (!session || remaining > 0 || finishedRef.current === session.endsAt) return;
    finishedRef.current = session.endsAt;
    dispatch({ type: "plant", taskId: session.taskId, kind: session.kind, minutes: Math.round(session.total / 60_000) });
    setSession(null); saveSession(null);
    haptic("success");
    api.finish().then(() => refreshTop()).catch(() => setOnline(false));
  }, [session, remaining]);

  useEffect(() => { document.title = session ? `${fmt(remaining)} · Сад фокуса` : "Сад фокуса"; }, [session, remaining]);

  function start() {
    if (!selected) return;
    const seconds = DURATIONS[durIdx].seconds;
    const t = Date.now();
    const kind: TreeKind = KINDS[Math.floor(Math.random() * KINDS.length)];
    const s: Session = { taskId: selected, kind, endsAt: t + seconds * 1000, total: seconds * 1000 };
    setNow(t); setSession(s); saveSession(s);
    api.start(seconds, kind).then(() => setOnline(true)).catch(() => setOnline(false));
  }

  function giveUp() {
    if (!session) return;
    dispatch({ type: "wither", taskId: session.taskId, minutes: Math.round((session.total * progress) / 60_000) });
    setSession(null); saveSession(null);
    haptic("error");
    api.abandon().catch(() => setOnline(false));
  }

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    dispatch({ type: "addTask", text: v });
    setText("");
  }

  const stats = useMemo(() => {
    const today = state.forest.filter((t) => sameDay(t.at, Date.now()));
    const alive = today.filter((t) => t.kind !== "dead");
    return { alive: alive.length, dead: today.length - alive.length, minutes: alive.reduce((s, t) => s + t.minutes, 0) };
  }, [state.forest]);
  const perTask = (id: string) => state.forest.filter((t) => t.taskId === id && t.kind !== "dead").length;
  const R = 92, C = 2 * Math.PI * R;

  return (
    <div className="page">
      <header>
        <h1>Сад фокуса</h1>
        <p>Пока идёт таймер — растёт дерево. Бросили раньше — засохнет.</p>
      </header>

      <section className="timer" aria-live="polite">
        <div className="ring">
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r={R} className="track" />
            <circle cx="100" cy="100" r={R} className="fill" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 100 100)" />
          </svg>
          <div className="seed"><TreeSvg kind={session ? session.kind : "oak"} grow={session ? 0.12 + 0.88 * progress : 0.12} /></div>
        </div>
        <p className="clock">{session ? fmt(remaining) : fmt(DURATIONS[durIdx].seconds * 1000)}</p>
        {session ? (
          <>
            <p className="what">{KIND_NAME[session.kind]} растёт · {state.tasks.find((t) => t.id === session.taskId)?.text}</p>
            <button className="btn ghost" onClick={giveUp}>Сдаться — дерево засохнет</button>
          </>
        ) : (
          <>
            <div className="durations" role="group" aria-label="Длительность">
              {DURATIONS.map((d, i) => <button key={d.label} aria-pressed={i === durIdx} onClick={() => setDurIdx(i)}>{d.label}</button>)}
            </div>
            <button className="btn" onClick={start} disabled={!selected}>{selected ? "Посадить и начать" : "Сначала выберите задачу"}</button>
          </>
        )}
      </section>

      <section className="tasks">
        <h2>Над чем работаем</h2>
        <form onSubmit={addTask} className="add">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Например: сверстать главную" aria-label="Новая задача" />
          <button type="submit">Добавить</button>
        </form>
        {state.tasks.length === 0 ? (
          <p className="empty">Добавьте задачу, на которую готовы отдать один рабочий отрезок.</p>
        ) : (
          <ul>
            {state.tasks.map((t) => (
              <li key={t.id} className={selected === t.id ? "on" : ""}>
                <button className="pick" disabled={!!session} onClick={() => setSelected(t.id)} aria-pressed={selected === t.id}><span>{t.text}</span><em>{perTask(t.id)}</em></button>
                <button className="x" disabled={!!session} onClick={() => { dispatch({ type: "removeTask", id: t.id }); if (selected === t.id) setSelected(null); }} aria-label={`Удалить: ${t.text}`}>×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="forest" aria-label="Ваш лес">
        <div className="stats">
          <p><b>{stats.alive}</b> деревьев сегодня</p>
          <p><b>{stats.minutes}</b> мин в фокусе</p>
          <p><b>{stats.dead}</b> засохло</p>
        </div>
        <div className="ground">
          {state.forest.length === 0 && <p className="hint">Здесь вырастет ваш лес.</p>}
          {state.forest.map((t) => <div key={t.id} className="plant"><TreeSvg kind={t.kind} /></div>)}
        </div>
      </section>

      <section className="top">
        <h2>Лучшие лесники</h2>
        {online === false && <p className="empty">Нет связи с ботом. Лес сохраняется на устройстве, рейтинг появится, когда связь вернётся.</p>}
        {online && top.length === 0 && <p className="empty">Рейтинг пуст — завершите первую сессию.</p>}
        <ol>
          {top.map((r, i) => (
            <li key={r.id} className={r.id === meId ? "me" : ""}>
              <span className="rk">{i + 1}</span><span className="nm">{r.name}{r.id === meId ? " (вы)" : ""}</span><span className="tr">{r.trees} 🌳</span><span className="mn">{r.minutes} мин</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
