export const KINDS = ["pine", "oak", "birch", "sakura"] as const;
export type TreeKind = (typeof KINDS)[number];
export const KIND_NAME: Record<TreeKind, string> = { pine: "ель", oak: "дуб", birch: "берёза", sakura: "сакура" };

/** Допустимые длительности сессий в секундах. 10 — демо-режим (в рейтинг не идёт). */
export const DURATIONS = [1500, 900, 300, 10] as const;
export const DEMO_SECONDS = 10;
