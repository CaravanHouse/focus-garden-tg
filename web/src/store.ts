import type { Action, Session, State, Tree } from "./types";

const KEY = "focus-garden-tg:v1";
const SESSION_KEY = "focus-garden-tg:session";

export function load(): State {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as State; } catch { /* начинаем с нуля */ }
  return { tasks: [], forest: [] };
}
export function save(state: State) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* нет хранилища */ } }

/** Активная сессия переживает закрытие мини-аппа: вернулись — таймер на месте */
export function loadSession(): Session | null {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? (JSON.parse(raw) as Session) : null; } catch { return null; }
}
export function saveSession(s: Session | null) {
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* нет хранилища */ }
}

const tree = (taskId: string | null, kind: Tree["kind"], minutes: number): Tree =>
  ({ id: crypto.randomUUID(), taskId, kind, at: Date.now(), minutes });

export function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "addTask": return { ...state, tasks: [...state.tasks, { id: crypto.randomUUID(), text: a.text }] };
    case "removeTask": return { ...state, tasks: state.tasks.filter((t) => t.id !== a.id) };
    case "plant": return { ...state, forest: [...state.forest, tree(a.taskId, a.kind, a.minutes)] };
    case "wither": return { ...state, forest: [...state.forest, tree(a.taskId, "dead", a.minutes)] };
    case "clearForest": return { ...state, forest: [] };
    default: { const _n: never = a; return _n; }
  }
}
