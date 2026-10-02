import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export interface TgUser { id: number; first_name: string; last_name?: string; username?: string; language_code?: string }

/**
 * Проверка подписи initData из Telegram Mini App.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string, botToken: string, maxAgeSec = 86_400): TgUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = createHmac("sha256", secret).update(dataCheck).digest();

  let given: Buffer;
  try { given = Buffer.from(hash, "hex"); } catch { return null; }
  if (given.length !== calc.length || !timingSafeEqual(given, calc)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;

  try { return JSON.parse(params.get("user") ?? "") as TgUser; } catch { return null; }
}

/** Кладёт пользователя в res.locals.user. DEV_NO_AUTH=1 пускает без подписи (только для локальной разработки). */
export function authMiddleware(botToken: string, devNoAuth: boolean): RequestHandler {
  return (req, res, next) => {
    const init = String(req.header("x-init-data") ?? "");
    const user = init ? validateInitData(init, botToken) : devNoAuth ? { id: 1, first_name: "Demo" } : null;
    if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    res.locals.user = user;
    next();
  };
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const displayName = (u: TgUser) => [u.first_name, u.last_name].filter(Boolean).join(" ");
