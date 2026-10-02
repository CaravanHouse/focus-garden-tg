import type { TreeKind } from "../../shared/constants";
import { initData } from "./tg";

export interface TopRow { id: number; name: string; trees: number; minutes: number }

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "X-Init-Data": initData() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

export const api = {
  start: (seconds: number, kind: TreeKind) => call<{ endsAt: number }>("/session/start", { seconds, kind }),
  finish: () => call<{ trees: number; minutes: number }>("/session/finish", {}),
  abandon: () => call<{ ok: true }>("/session/abandon", {}),
  top: () => call<{ meId: number; top: TopRow[] }>("/top"),
};
