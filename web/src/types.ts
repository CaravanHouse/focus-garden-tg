import type { TreeKind } from "../../shared/constants";

export type Species = TreeKind | "dead";
export interface Task { id: string; text: string }
export interface Tree { id: string; taskId: string | null; kind: Species; at: number; minutes: number }
export interface State { tasks: Task[]; forest: Tree[] }
export interface Session { taskId: string; kind: TreeKind; endsAt: number; total: number }

export type Action =
  | { type: "addTask"; text: string }
  | { type: "removeTask"; id: string }
  | { type: "plant"; taskId: string | null; kind: TreeKind; minutes: number }
  | { type: "wither"; taskId: string | null; minutes: number }
  | { type: "clearForest" };
