import { JsonDb } from "./db";
import { displayName, type TgUser } from "./auth";
import { DEMO_SECONDS, type TreeKind } from "../shared/constants";

export interface UserStat { id: number; name: string; username?: string; trees: number; minutes: number; withered: number }
export interface ActiveSession { kind: TreeKind; startedAt: number; endsAt: number; seconds: number; reminded?: boolean }
interface DbShape { users: Record<string, UserStat>; sessions: Record<string, ActiveSession> }

export interface Notifier {
  treeGrown(userId: number, kind: TreeKind, seconds: number, stat: UserStat): Promise<void>;
  reminder(userId: number): Promise<void>;
}

const REMINDER_DELAY_MS = 20_000;
/** Сессии, которые закончились больше часа назад, после перезапуска не напоминаем: человек давно ушёл */
const STALE_MS = 3_600_000;

export class Garden {
  db: JsonDb<DbShape>;
  private timers = new Map<number, NodeJS.Timeout>();

  constructor(file: string, private notifier: Notifier, private reminderDelayMs = REMINDER_DELAY_MS) {
    this.db = new JsonDb<DbShape>(file, { users: {}, sessions: {} });
  }

  touch(u: TgUser): UserStat {
    const key = String(u.id);
    const stat = this.db.data.users[key] ?? { id: u.id, name: displayName(u), trees: 0, minutes: 0, withered: 0 };
    stat.name = displayName(u);
    stat.username = u.username;
    this.db.data.users[key] = stat;
    return stat;
  }

  start(u: TgUser, seconds: number, kind: TreeKind): ActiveSession {
    // незакрытая прошлая сессия: время вышло — дерево выросло, не вышло — засохло
    if (this.db.data.sessions[String(u.id)] && !this.finish(u).ok) this.abandon(u);
    this.touch(u);
    const now = Date.now();
    const session: ActiveSession = { kind, startedAt: now, endsAt: now + seconds * 1000, seconds };
    this.db.data.sessions[String(u.id)] = session;
    this.db.save();
    this.scheduleReminder(u.id, session);
    return session;
  }

  /** Дерево засчитывается только если время реально вышло (с запасом 2 с на расхождение часов) */
  finish(u: TgUser): { ok: true; stat: UserStat; seconds: number } | { ok: false; reason: "no_session" | "too_early" } {
    const session = this.db.data.sessions[String(u.id)];
    if (!session) return { ok: false, reason: "no_session" };
    if (Date.now() < session.endsAt - 2000) return { ok: false, reason: "too_early" };

    const stat = this.touch(u);
    if (session.seconds !== DEMO_SECONDS) { stat.trees += 1; stat.minutes += Math.round(session.seconds / 60); }
    this.clear(u.id);
    void this.notifier.treeGrown(u.id, session.kind, session.seconds, stat).catch(() => {});
    return { ok: true, stat, seconds: session.seconds };
  }

  abandon(u: TgUser) {
    const session = this.db.data.sessions[String(u.id)];
    if (!session) return;
    if (session.seconds !== DEMO_SECONDS) this.touch(u).withered += 1;
    this.clear(u.id);
  }

  top(limit = 10): UserStat[] {
    return Object.values(this.db.data.users)
      .filter((s) => s.trees > 0)
      .sort((a, b) => b.trees - a.trees || b.minutes - a.minutes)
      .slice(0, limit);
  }

  /**
   * После перезапуска сервера возвращаем напоминания для незавершённых сессий.
   * Уже отправленные и давно истёкшие пропускаем, иначе каждый деплой рассылал бы напоминания заново.
   * Возвращает число запланированных напоминаний.
   */
  restoreTimers(): number {
    let n = 0;
    for (const [id, s] of Object.entries(this.db.data.sessions)) {
      if (s.reminded || Date.now() - s.endsAt > STALE_MS) continue;
      this.scheduleReminder(Number(id), s);
      n += 1;
    }
    return n;
  }

  private clear(userId: number) {
    delete this.db.data.sessions[String(userId)];
    const t = this.timers.get(userId);
    if (t) clearTimeout(t);
    this.timers.delete(userId);
    this.db.save();
  }

  /** Если человек закрыл приложение и не вернулся — через 20 с после конца таймера бот напомнит */
  private scheduleReminder(userId: number, session: ActiveSession) {
    const old = this.timers.get(userId);
    if (old) clearTimeout(old);
    const delay = Math.max(0, session.endsAt - Date.now()) + this.reminderDelayMs;
    const t = setTimeout(() => {
      const cur = this.db.data.sessions[String(userId)];
      if (cur && cur.startedAt === session.startedAt && !cur.reminded && session.seconds !== DEMO_SECONDS) {
        cur.reminded = true; // запоминаем, чтобы после перезапуска не напомнить второй раз
        this.db.save();
        void this.notifier.reminder(userId).catch(() => {});
      }
      this.timers.delete(userId);
    }, delay);
    t.unref();
    this.timers.set(userId, t);
  }
}
