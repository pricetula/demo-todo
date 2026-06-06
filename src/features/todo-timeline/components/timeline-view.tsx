"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { type Task, type TaskStatus, type TaskPriority } from "@/features/todo-timeline/types";
import { Button } from "@/components/ui/button";
import { ScrollAnchor } from "@/features/todo-timeline/components/scroll-anchor";

// ─── Helpers ───────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Today's date as YYYY-MM-DD. */
function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** All possible status transitions a user can trigger directly. */
const STATUS_ACTIONS: { status: TaskStatus; label: string }[] = [
  { status: "done", label: "Done" },
  { status: "skipped", label: "Skip" },
  { status: "unfinished", label: "Reopen" },
];

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "done") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === "skipped") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

// ─── Sticky-top offset (relative to the 400px scroll container) ───────────
const STICKY_TOP = "top-0";

// ─── Timeline View ─────────────────────────────────────────────────────────

interface TimelineViewProps {
  tasks: Task[];
  onDeleteTask: (taskId: string) => void;
  onUpdateStatus: (taskId: string, newStatus: TaskStatus) => void;
  onTogglePriority: (taskId: string, newPriority: TaskPriority) => void;
  onAddTask?: () => void;
  className?: string;
}

export function TimelineView({
  tasks,
  onUpdateStatus,
  onTogglePriority,
  onDeleteTask,
  onAddTask,
  className,
}: TimelineViewProps) {
  // ── Refs for the active-task auto-scroll ───────────────────────────
  const containerRef = React.useRef<HTMLDivElement>(null);
  const taskRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  // ── IntersectionObserver to highlight the sticky-active task ──────
  const [stickyActiveId, setStickyActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-task-id");
            if (id) setStickyActiveId(id);
          }
        }
      },
      {
        // Observe scroll within the timeline container, not the viewport.
        root: containerRef.current,
        // Triggers when the top edge of a task row enters the sticky zone.
        rootMargin: "-52px 0px -75% 0px",
        threshold: 0,
      },
    );

    const refs = taskRefs.current;
    refs.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [tasks]);

  // ── Find the "today boundary" — first task with scheduled_date >= today ─
  // Used to auto-scroll on mount and as the initial date label fallback.
  const todayBoundaryIndex = React.useMemo(() => {
    const today = todayStr();
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].scheduled_date >= today) return i;
    }
    return tasks.length; // all tasks are in the past; boundary at the end
  }, [tasks]);

  // ── Auto-scroll so the today boundary is at the top of the container ─
  const boundaryId = React.useMemo(() => {
    if (tasks.length === 0 || todayBoundaryIndex >= tasks.length) return null;
    return tasks[todayBoundaryIndex].id;
  }, [tasks, todayBoundaryIndex]);

  React.useEffect(() => {
    if (boundaryId && containerRef.current) {
      const el = taskRefs.current.get(boundaryId);
      const timer = setTimeout(() => {
        el?.scrollIntoView({ block: "start", behavior: "auto" });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [boundaryId]);

  // ── Set ref callback ───────────────────────────────────────────────
  function setTaskRef(id: string, el: HTMLDivElement | null) {
    if (el) taskRefs.current.set(id, el);
    else taskRefs.current.delete(id);
  }

  // ── Derive the sticky date label from the active / boundary task ──
  const activeDateLabel = React.useMemo<string | null>(() => {
    if (tasks.length === 0) return null;

    let referenceTask: Task | undefined;

    if (stickyActiveId) {
      referenceTask = tasks.find((t) => t.id === stickyActiveId);
    }

    if (!referenceTask && todayBoundaryIndex < tasks.length) {
      referenceTask = tasks[todayBoundaryIndex];
    }

    if (!referenceTask) {
      referenceTask = tasks[0];
    }

    const date = referenceTask.scheduled_date;
    const today = todayStr();

    if (date === today) return "Today";

    const [y, m, d] = date.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    return format(parsed, "MMMM d, yyyy");
  }, [tasks, stickyActiveId, todayBoundaryIndex]);

  // ── Empty state ────────────────────────────────────────────────────
  if (tasks.length === 0) {
    return (
      <div
        ref={containerRef}
        className={cn("flex items-start justify-center py-8", className)}
      >
        <div className="flex flex-col items-center" data-component="timeline-view-empty">
          <div className="flex flex-col items-center">
            <div className="z-10 size-3 rounded-full border-2 border-dashed border-border bg-background" />
            <div className="h-16 w-0 border-l-2 border-dashed border-border" />
            <div className="z-10 size-3 rounded-full border-2 border-dashed border-border bg-background" />
          </div>
          <div className="mt-6 flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted/60">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50" aria-hidden="true">
                <rect x="4" y="4" width="16" height="20" rx="2" ry="2" />
                <line x1="9" y1="10" x2="15" y2="10" />
                <line x1="9" y1="14" x2="15" y2="14" />
                <line x1="9" y1="18" x2="12" y2="18" />
                <path d="M16 2v4H8V2" />
              </svg>
            </div>
            <div className="h-px w-12 bg-border" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">No tasks scheduled here</p>
              <p className="text-xs text-muted-foreground/60">Your timeline is clear for this time slot.</p>
            </div>
            {onAddTask && (
              <Button variant="outline" size="sm" onClick={onAddTask} className="mt-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add your first task
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render timeline with sticky-node layout ────────────────────────
  return (
    <div>
      {/* date label */}
      <span
        className="text-sm mb-8 block"
        data-testid="timeline-date-header"
      >
        {activeDateLabel}
      </span>

      <div
        ref={containerRef}
        className={cn("h-[400px] overflow-y-auto", className)}
        data-component="timeline-view"
      >
        <div className="space-y-0">
          {tasks.map((task, index) => {
            const isStickyActive = task.id === stickyActiveId;
            const isPast =
              task.status === "done" ||
              task.status === "skipped" ||
              (task.status === "unfinished" &&
                timeToMinutes(task.start_time) < timeToMinutes(nowHHmm()));

            return (
              <React.Fragment key={task.id}>


                <div
                  ref={(el) => setTaskRef(task.id, el)}
                  data-task-id={task.id}
                  className="relative flex justify-end gap-2"
                >
                  {/* ── LEFT COLUMN: Sticky time label (hidden on mobile) ── */}
                  <div
                    className={cn(
                      "sticky self-start pb-4 max-md:hidden",
                      STICKY_TOP,
                    )}
                    style={{ zIndex: 1 }}
                  >
                    <div className="flex w-14 flex-col items-end">
                      <time
                        dateTime={task.start_time}
                        className={cn(
                          "block text-xs font-medium tabular-nums tracking-tight",
                          isStickyActive
                            ? "text-foreground"
                            : isPast
                              ? "text-muted-foreground/50"
                              : "text-muted-foreground",
                        )}
                      >
                        {formatTimeDisplay(task.start_time)}
                      </time>
                    </div>
                  </div>

                  {/* ── MIDDLE COLUMN: Sticky node + connecting line ────── */}
                  <div className="flex flex-col items-center">
                    {/* Sticky node dot */}
                    <div
                      className={cn(
                        "sticky flex size-6 items-center justify-center",
                        STICKY_TOP,
                      )}
                      style={{ zIndex: 2 }}
                    >
                      <span
                        className={cn(
                          "flex size-[14px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                          task.status === "done"
                            ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-900/30"
                            : task.status === "skipped"
                              ? "border-muted-foreground/40 bg-muted"
                              : isStickyActive
                                ? "border-primary bg-primary shadow-[0_0_0_5px_rgba(59,130,246,0.15)] ring-[3px] ring-primary/20"
                                : isPast
                                  ? "border-muted-foreground/30 bg-background"
                                  : "border-muted-foreground/50 bg-background",
                        )}
                        aria-hidden="true"
                      >
                        {task.status === "done" && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {task.status === "unfinished" && isStickyActive && (
                          <span className="size-[6px] rounded-full bg-primary-foreground" />
                        )}
                      </span>
                    </div>

                    {/* Vertical connector line */}
                    <div className="-mt-2.5 w-px flex-1 border-l border-border/60" />
                  </div>

                  {/* ── RIGHT COLUMN: Task card ──────────────────────────── */}
                  <div className="flex flex-1 flex-col gap-3 pb-8 pl-2 md:pl-4">
                    {/* Mobile-only time label */}
                    <div className="flex items-center gap-2 md:hidden">
                      <time
                        dateTime={task.start_time}
                        className={cn(
                          "text-xs font-medium tabular-nums tracking-tight",
                          isPast ? "text-muted-foreground/50" : "text-muted-foreground",
                        )}
                      >
                        {formatTimeDisplay(task.start_time)}
                      </time>
                    </div>

                    {/* Card */}
                    <div
                      className={cn(
                        "relative rounded-lg border bg-card p-3.5 text-card-foreground shadow-xs transition-all duration-200",
                        isStickyActive && [
                          "border-primary/40 shadow-sm shadow-primary/5",
                          "ring-1 ring-primary/10",
                        ],
                        task.priority === "high" && "border-l-2 border-l-amber-400",
                        task.status === "done" && "opacity-60",
                        task.status === "skipped" && "opacity-50",
                        "group",
                      )}
                    >
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className={cn(
                            "text-sm font-medium leading-snug",
                            (task.status === "done" || task.status === "skipped") &&
                            "line-through text-muted-foreground",
                          )}
                        >
                          {task.title}
                        </h3>

                        {/* Priority toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            onTogglePriority(
                              task.id,
                              task.priority === "high" ? "low" : "high",
                            )
                          }
                          className={cn(
                            "shrink-0 rounded p-0.5 transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                          )}
                          aria-label={task.priority === "high" ? "Lower priority" : "Mark as high priority"}
                          title={task.priority === "high" ? "Lower priority" : "Mark as high priority"}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={cn(
                              "shrink-0",
                              task.priority === "high" ? "text-amber-500" : "text-muted-foreground/40",
                            )}
                            aria-hidden="true"
                          >
                            {task.priority === "high" ? (
                              <>
                                <path d="M12 3v18" />
                                <path d="M8 7l4-4 4 4" />
                              </>
                            ) : (
                              <>
                                <path d="M12 21V3" />
                                <path d="M8 17l4 4 4-4" />
                              </>
                            )}
                          </svg>
                        </button>
                      </div>

                      {/* Description */}
                      {task.description && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Bottom bar with always-visible action buttons */}
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        {/* Status badge */}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            task.status === "done" &&
                            "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
                            task.status === "skipped" &&
                            "bg-muted text-muted-foreground dark:bg-muted/50",
                            task.status === "unfinished" && [
                              isStickyActive
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                            ],
                          )}
                        >
                          <StatusIcon status={task.status} />
                          {task.status === "unfinished" ? "Pending" : task.status}
                        </span>

                        {/* Action buttons — always visible, no hover required */}
                        <div className="flex items-center gap-0.5">
                          {STATUS_ACTIONS.map((action) => {
                            const isCurrent = action.status === task.status;
                            return (
                              <Button
                                key={action.status}
                                variant="ghost"
                                size="xs"
                                disabled={isCurrent}
                                onClick={() => onUpdateStatus(task.id, action.status)}
                                aria-label={`Mark as ${action.status}`}
                                className={cn(
                                  "gap-1 px-1.5 text-[10px] font-medium",
                                  isCurrent
                                    ? "text-muted-foreground/30 cursor-not-allowed"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {action.status === "done" && (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                                {action.status === "skipped" && (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                )}
                                {action.status === "unfinished" && (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                  </svg>
                                )}
                                {action.label}
                              </Button>
                            );
                          })}

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            className="ml-1 shrink-0 rounded p-1 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            aria-label={`Delete ${task.title}`}
                            title="Delete task"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* ── Timeline trail end ──────────────────────────────────── */}
          <div className="relative flex justify-end gap-2">
            <div className="self-start pb-4 max-md:hidden">
              <div className="flex w-14 flex-col items-end" />
            </div>
            <div className="flex flex-col items-center">
              <div className="flex size-6 items-center justify-center">
                <div className="size-2 rounded-full border border-dashed border-border/50 bg-background" aria-hidden="true" />
              </div>
              <div className="-mt-2.5 w-px flex-1 border-l border-dashed border-border/30" />
            </div>
            <div className="flex flex-1 flex-col pb-8 pl-2 md:pl-4">
              <span className="text-[10px] text-muted-foreground/30 font-medium tracking-wider uppercase select-none pt-1">
                End of timeline
              </span>
            </div>
          </div>
        </div>

        <ScrollAnchor />
      </div>
    </div>
  );
}
