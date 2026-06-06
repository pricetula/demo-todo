// ─── Domain types for the Todo Timeline feature ────────────────────────────
// Single source of truth. DB store and hooks import from here.
// If you change these, update DB schema version & add a migration.

export type TaskStatus = "unfinished" | "done" | "skipped";

export type TaskPriority = "low" | "high";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  scheduled_date: string;    // YYYY-MM-DD
  start_time: string;        // HH:mm
  completed_at: string | null; // ISO timestamp
  created_at: string;        // ISO timestamp
  updated_at: string;        // ISO timestamp
}

/** Payload used when creating a task (id and timestamps are auto-generated). */
export type TaskDraft = Omit<Task, "id" | "created_at" | "updated_at">;

/** All valid statuses in display order. */
export const TASK_STATUSES: TaskStatus[] = ["unfinished", "done", "skipped"];

/** All valid priorities in ascending order. */
export const TASK_PRIORITIES: TaskPriority[] = ["low", "high"];

/** Human-readable labels for each priority level. */
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  high: "High",
};
