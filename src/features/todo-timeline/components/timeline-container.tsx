"use client";

import * as React from "react";
import { format } from "date-fns";
import { TaskForm } from "@/features/todo-timeline/components/task-form";
import { TimelineView } from "@/features/todo-timeline/components/timeline-view";
import {
  useAllTasks,
  useCreateTask,
  useUpdateTaskStatus,
  useUpdateTaskPriority,
} from "@/features/todo-timeline/hooks/use-tasks";
import { type TaskStatus, type TaskPriority } from "@/features/todo-timeline/types";

// ─── Top-level container for the Todo Timeline feature ─────────────────────

export function TimelineContainer() {
  // ── Data — fetch all tasks (past + future), scroll starts at today ─
  const { data: tasks = [], isLoading } = useAllTasks();

  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const updatePriority = useUpdateTaskPriority();

  // ── Handlers ───────────────────────────────────────────────────────
  function handleCreateTask(payload: {
    title: string;
    description: string;
    priority: "low" | "high";
    scheduled_date: string;
    start_time: string;
  }) {
    createTask.mutate({
      id: crypto.randomUUID(),
      title: payload.title,
      description: payload.description,
      status: "unfinished" as const,
      priority: payload.priority,
      scheduled_date: payload.scheduled_date,
      start_time: payload.start_time,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  function handleUpdateStatus(taskId: string, newStatus: TaskStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    updateStatus.mutate({ task, newStatus });
  }

  function handleTogglePriority(taskId: string, newPriority: TaskPriority) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    updatePriority.mutate({ task, newPriority });
  }

  // ── Form visibility ────────────────────────────────────────────────
  const [formOpen, setFormOpen] = React.useState(true);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="flex w-full flex-col gap-6" data-feature="todo-timeline">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            Task Timeline
          </h1>
          <span className="text-sm text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground/60">
          All tasks sorted chronologically. Use the form below to add new ones.
        </p>
      </div>

      {/* ── Collapsible Form ──────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">New Task</h2>
          <button
            type="button"
            onClick={() => setFormOpen(!formOpen)}
            className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
            aria-label={formOpen ? "Collapse form" : "Expand form"}
          >
            {formOpen ? "Collapse" : "Expand"}
          </button>
        </div>
        {formOpen && (
          <div className="mt-3">
            <TaskForm onSubmit={handleCreateTask} />
          </div>
        )}
      </div>

      {/* ── Vertical Timeline ──────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-2">
            <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
            <p className="text-xs text-muted-foreground">Loading tasks…</p>
          </div>
        </div>
      ) : (
        <TimelineView
          tasks={tasks}
          onUpdateStatus={handleUpdateStatus}
          onTogglePriority={handleTogglePriority}
          onAddTask={() => {
            setFormOpen(true);
            document
              .querySelector('[data-feature="todo-timeline"]')
              ?.firstElementChild?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}
    </div>
  );
}
