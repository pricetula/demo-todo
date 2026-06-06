"use client";

import * as React from "react";
import { format } from "date-fns";
import { TaskForm } from "@/features/todo-timeline/components/task-form";
import {
  useCreateTask,
  useTimelineTasks,
} from "@/features/todo-timeline/hooks/use-tasks";
import { cn } from "@/lib/utils";

// ─── Today's date string (used as default filter) ──────────────────────────
const today = () => format(new Date(), "yyyy-MM-dd");

// ─── Top-level container for the Todo Timeline feature ─────────────────────

export function TimelineContainer() {
  const [selectedDate, setSelectedDate] = React.useState(today);

  // ── Data ───────────────────────────────────────────────────────────
  const { data: tasks = [], isLoading } = useTimelineTasks(selectedDate);
  const createTask = useCreateTask(selectedDate);

  // ── Handlers ───────────────────────────────────────────────────────
  function handleCreateTask(payload: {
    title: string;
    description: string;
    priority: "low" | "high";
    scheduled_date: string;
    start_time: string;
  }) {
    createTask.mutate(
      {
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
      },
      {
        onSuccess: () => {
          // If the task was created for a different date than selected, switch to it
          if (payload.scheduled_date !== selectedDate) {
            setSelectedDate(payload.scheduled_date);
          }
        },
      }
    );
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="flex w-full flex-col gap-6" data-feature="todo-timeline">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          {selectedDate === today() ? "Today" : format(new Date(selectedDate), "MMM d, yyyy")}
        </h1>
        <span className="text-sm text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* ── Form ───────────────────────────────────────────────── */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">New Task</h2>
        <TaskForm onSubmit={handleCreateTask} />
      </div>

      {/* ── Vertical Timeline (future component) ──────────────── */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tasks scheduled for this day. Add one above.
          </p>
        ) : (
          <div className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-12px)] before:w-0.5 before:rounded-full before:bg-border">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "relative pb-4 last:pb-0",
                  "before:absolute before:-left-[19px] before:top-[6px] before:h-3 before:w-3 before:rounded-full before:border-2",
                  task.status === "done"
                    ? "before:bg-muted before:border-muted-foreground opacity-60"
                    : task.priority === "high"
                      ? "before:bg-red-500 before:border-red-500"
                      : "before:bg-primary before:border-primary"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {task.start_time}
                    </span>
                    <p
                      className={cn(
                        "text-sm",
                        task.status === "done" && "line-through"
                      )}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                      task.priority === "high"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
