import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { validateInitData } from "../server/auth";
import { Garden, type Notifier } from "../server/garden";
import { createApp } from "../server/app";
import { httpsUrl } from "../server/env";

const TOKEN = "123:TEST";
const user = { id: 42, first_name: "Умид", username: "umid" };

function sign(u: object, token = TOKEN, authDate = Math.floor(Date.now() / 1000)) {
  const p = new URLSearchParams({ auth_date: String(authDate), user: JSON.stringify(u), query_id: "q1" });
  const check = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  p.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return p.toString();
}

// 1. подпись initData
assert.equal(validateInitData(sign(user), TOKEN)?.id, 42, "валидная подпись принимается");
assert.equal(validateInitData(sign(user, "999:OTHER"), TOKEN), null, "чужой токен отклоняется");
assert.equal(validateInitData(sign(user).replace("%D0%A3", "X"), TOKEN), null, "подделанные данные отклоняются");
assert.equal(validateInitData(sign(user, TOKEN, 1000), TOKEN), null, "просроченные данные отклоняются");

// 2. логика сада
const sent: string[] = [];
const notifier: Notifier = {
  async treeGrown(id, kind, sec, s) { sent.push(`tree:${id}:${kind}:${s.trees}`); },
  async reminder(id) { sent.push(`reminder:${id}`); },
};
const garden = new Garden(join(mkdtempSync(join(tmpdir(), "garden-")), "g.json"), notifier);
garden.start(user, 300, "oak");
assert.equal(garden.finish(user).ok, false, "нельзя завершить раньше времени");
garden.db.data.sessions["42"].endsAt = Date.now() - 1;
const r = garden.finish(user);
assert.ok(r.ok && r.stat.trees === 1 && r.stat.minutes === 5, "дерево засчитано");
assert.equal(garden.finish(user).ok, false, "повторное завершение не засчитывается");
garden.start(user, 10, "pine");
garden.db.data.sessions["42"].endsAt = Date.now() - 1;
garden.finish(user);
assert.equal(garden.db.data.users["42"].trees, 1, "демо-сессия не идёт в рейтинг");
garden.start(user, 300, "birch");
garden.abandon(user);
assert.equal(garden.db.data.users["42"].withered, 1, "сдавшийся получает засохшее дерево");
await new Promise((r) => setTimeout(r, 10));
assert.deepEqual(sent.filter((s) => s.startsWith("tree")), ["tree:42:oak:1", "tree:42:pine:1"]);
garden.start(user, 300, "oak");
garden.start(user, 300, "pine");
assert.equal(garden.db.data.users["42"].withered, 2, "новая сессия поверх идущей засушивает старое дерево");
garden.db.data.sessions["42"].endsAt = Date.now() - 1;
garden.start(user, 300, "birch");
assert.equal(garden.db.data.users["42"].trees, 2, "новая сессия поверх истёкшей засчитывает дерево");
garden.abandon(user);

// 2б. напоминания: одно на сессию и без повтора после перезапуска сервера
const file = join(mkdtempSync(join(tmpdir(), "garden-")), "r.json");
const reminders: string[] = [];
const remNotifier: Notifier = { async treeGrown() {}, async reminder(id) { reminders.push(`reminder:${id}`); } };
const g1 = new Garden(file, remNotifier, 5);
g1.start(user, 300, "oak");
g1.db.data.sessions["42"].endsAt = Date.now();
g1.restoreTimers();
await new Promise((r) => setTimeout(r, 40));
assert.deepEqual(reminders, ["reminder:42"], "напоминание пришло один раз");
assert.equal(g1.db.data.sessions["42"].reminded, true, "отправленное напоминание запомнено");
g1.db.flush();
const g2 = new Garden(file, remNotifier, 5); // «перезапуск» сервера с теми же данными
assert.equal(g2.restoreTimers(), 0, "после перезапуска отправленное напоминание не повторяется");
g2.db.data.sessions["42"] = { kind: "oak", startedAt: 1, endsAt: Date.now() - 2 * 3_600_000, seconds: 300 };
assert.equal(g2.restoreTimers(), 0, "давно истёкшие сессии не напоминаем");
g2.db.data.sessions["42"] = { kind: "oak", startedAt: 2, endsAt: Date.now() + 60_000, seconds: 300 };
assert.equal(g2.restoreTimers(), 1, "идущая сессия получает напоминание после перезапуска");
g2.abandon(user);

// 2в. адрес мини-аппа
assert.equal(httpsUrl("WEBAPP_URL", "my-app.up.railway.app"), "https://my-app.up.railway.app/", "без схемы дописываем https://");
assert.equal(httpsUrl("WEBAPP_URL", " https://my-app.up.railway.app/ "), "https://my-app.up.railway.app/", "пробелы убираем");
assert.equal(httpsUrl("WEBAPP_URL", "http://my-app.up.railway.app"), undefined, "http не принимаем");
assert.equal(httpsUrl("WEBAPP_URL", "https://"), undefined, "битый адрес не принимаем");
assert.equal(httpsUrl("WEBAPP_URL", ""), undefined);

// 3. HTTP API
const server = createApp(garden, TOKEN, false, "/nonexistent").listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const call = (path: string, init: RequestInit = {}, auth = true) =>
  fetch(base + path, { ...init, headers: { "Content-Type": "application/json", ...(auth ? { "X-Init-Data": sign(user) } : {}) } });

assert.equal((await call("/api/top", {}, false)).status, 401, "без подписи доступ закрыт");
assert.equal((await call("/api/session/start", { method: "POST", body: JSON.stringify({ seconds: 7, kind: "oak" }) })).status, 400, "неверная длительность отклонена");
assert.equal((await call("/api/session/start", { method: "POST", body: JSON.stringify({ seconds: 300, kind: "oak" }) })).status, 200);
assert.equal((await call("/api/session/finish", { method: "POST", body: "{}" })).status, 409, "ранний finish даёт 409");
const top = await (await call("/api/top")).json() as { top: { trees: number }[]; meId: number };
assert.equal(top.meId, 42);
assert.equal(top.top[0].trees, 2);

server.close();
console.log("✓ все проверки пройдены");
process.exit(0);
