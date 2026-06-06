"use client";

import * as React from "react";
import { TaskForm } from "@/features/todo-timeline/components/task-form";
import { TimelineView } from "@/features/todo-timeline/components/timeline-view";
import {
  useAllTasks,
  useCreateTask,
  useUpdateTaskStatus,
  useUpdateTaskPriority,
  useDeleteTask,
} from "@/features/todo-timeline/hooks/use-tasks";
import { type TaskStatus, type TaskPriority } from "@/features/todo-timeline/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ─── Top-level container for the Todo Timeline feature ─────────────────────

export function TimelineContainer() {
  // ── Data — fetch all tasks (past + future), scroll starts at today ─
  const { data: tasks = [], isLoading } = useAllTasks();

  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const updatePriority = useUpdateTaskPriority();
  const deleteTask = useDeleteTask();

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

  // ── Dialog state ────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="flex w-full flex-col gap-6" data-feature="todo-timeline">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            Task Timeline
          </h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1.5"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Task
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Task</DialogTitle>
                <DialogDescription>
                  Create a new task for your timeline.
                </DialogDescription>
              </DialogHeader>
              <TaskForm
                onSubmit={(payload) => {
                  handleCreateTask(payload);
                  setDialogOpen(false);
                }}
                onCancel={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-xs text-muted-foreground/60">
          Tasks are sorted chronologically. Click <strong>Add Task</strong> to create a new one.
        </p>
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
          onDeleteTask={(taskId) => deleteTask.mutate(taskId)}
          onAddTask={() => setDialogOpen(true)}
        />
      )}
    </div>
  );
}
