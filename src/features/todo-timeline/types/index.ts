// ─── Domain types for the Todo Timeline feature ────────────────────────────

export type TaskStatus = "active" | "completed" | "archived";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;       // unix ms
  updatedAt: number;       // unix ms
  dueDate: number | null;  // unix ms
  sortOrder: number;
}

/** Payload used when creating or updating a task (id/timestamps are auto-generated). */
export type TaskDraft = Omit<Task, "id" | "createdAt" | "updatedAt">;

/** Enumerate statuses for dropdown / filter usage. */
export const TASK_STATUSES: TaskStatus[] = ["active", "completed", "archived"];

/** Enumerate priorities for dropdown / filter usage. */
export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

/** Human-readable labels for each priority level. */
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
