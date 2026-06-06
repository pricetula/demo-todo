"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type Task } from "@/features/todo-timeline/types";

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Counts the number of scheduled dates where EVERY task on that date has
 * been marked "done". A day only counts when nothing is left unfinished.
 */
function computeStreak(tasks: Task[]): number {
  // Group tasks by scheduled_date
  const byDate = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.scheduled_date) continue;
    const group = byDate.get(task.scheduled_date);
    if (group) {
      group.push(task);
    } else {
      byDate.set(task.scheduled_date, [task]);
    }
  }

  // Count dates where every task has status === "done"
  let count = 0;
  for (const [, group] of byDate) {
    if (group.every((t) => t.status === "done")) {
      count++;
    }
  }
  return count;
}

// ─── Component ─────────────────────────────────────────────────────────────

interface StreakBadgeProps {
  /** All tasks — counts dates where EVERY task on that date is done. */
  tasks: Task[];
  className?: string;
}

export function StreakBadge({ tasks, className }: StreakBadgeProps) {
  const streak = React.useMemo(() => computeStreak(tasks), [tasks]);

  const isActive = streak > 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
        isActive
          ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
          : "bg-muted/50 text-muted-foreground/50",
        className,
      )}
      title={
        isActive
          ? `${streak} day${streak === 1 ? "" : "s"} with completed tasks`
          : "No completed days"
      }
    >
      {/* Flame icon */}
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
          "shrink-0 transition-all",
          isActive ? "text-amber-500" : "text-muted-foreground/30",
        )}
        aria-hidden="true"
      >
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>

      {/* Streak number */}
      <span
        className={cn(
          "text-xs font-semibold tabular-nums leading-none",
          isActive ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground/40",
        )}
      >
        {streak}
      </span>

      {/* Label */}
      <span className="text-[10px] font-medium uppercase tracking-wider leading-none">
        day{streak === 1 ? "" : "s"}
      </span>
    </div>
  );
}
