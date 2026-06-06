"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type Task, type TaskStatus } from "@/features/todo-timeline/types";

// ─── Constants ─────────────────────────────────────────────────────────────

const SEGMENT_COLORS: Record<TaskStatus, string> = {
  done: "stroke-emerald-500",
  unfinished: "stroke-primary",
  skipped: "stroke-muted-foreground/30",
};

/** Display order: done first (at the top), then unfinished, then skipped. */
const DISPLAY_ORDER: TaskStatus[] = ["done", "unfinished", "skipped"];

const SIZE = 44;
const STROKE_WIDTH = 5;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

// ─── Helpers ───────────────────────────────────────────────────────────────

interface Segment {
  status: TaskStatus;
  length: number;       // dasharray length for this segment
  offset: number;       // stroke-dashoffset (accumulated prior lengths, negated)
}

function computeSegments(
  done: number,
  unfinished: number,
  skipped: number,
): Segment[] {
  const total = done + unfinished + skipped;
  if (total === 0) return [];

  const entries: [TaskStatus, number][] = [
    ["done", done],
    ["unfinished", unfinished],
    ["skipped", skipped],
  ];

  const segments: Segment[] = [];
  let accumulator = 0;

  for (const [status, count] of entries) {
    if (count === 0) continue;
    const fraction = count / total;
    const length = CIRCUMFERENCE * fraction;
    segments.push({ status, length, offset: -accumulator });
    accumulator += length;
  }

  return segments;
}

// ─── Component ─────────────────────────────────────────────────────────────

interface CompletionRingProps {
  /** Tasks to summarise — typically those scheduled for the current day. */
  tasks: Task[];
  className?: string;
}

export function CompletionRing({ tasks, className }: CompletionRingProps) {
  const counts = React.useMemo(() => {
    let done = 0;
    let unfinished = 0;
    let skipped = 0;
    for (const t of tasks) {
      if (t.status === "done") done++;
      else if (t.status === "unfinished") unfinished++;
      else skipped++;
    }
    return { done, unfinished, skipped, total: done + unfinished + skipped };
  }, [tasks]);

  const segments = React.useMemo(
    () => computeSegments(counts.done, counts.unfinished, counts.skipped),
    [counts],
  );

  // Animate the arcs in on mount via stroke-dashoffset transition
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const hasTasks = counts.total > 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="shrink-0"
        aria-label={
          hasTasks
            ? `${counts.done} of ${counts.total} tasks completed`
            : "No tasks"
        }
        role="img"
      >
        {/* ── Background ring ──────────────────────────────────── */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          className="text-border/50"
        />

        {/* ── Foreground arcs (empty state vs data) ─────────────── */}
        {hasTasks ? (
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {segments.map((seg) => (
              <circle
                key={seg.status}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={`${seg.length} ${CIRCUMFERENCE - seg.length}`}
                strokeDashoffset={mounted ? seg.offset : CIRCUMFERENCE}
                className={cn(
                  "transition-all duration-700 ease-out",
                  SEGMENT_COLORS[seg.status],
                )}
              />
            ))}
          </g>
        ) : (
          /* Empty state — dashed ring */
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray="3 4"
            className="text-muted-foreground/20"
          />
        )}

        {/* ── Center count ──────────────────────────────────────── */}
        <text
          x={CENTER}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-[11px] font-semibold tabular-nums"
        >
          {hasTasks ? counts.done : "0"}
        </text>
      </svg>

      {/* ── Text label ───────────────────────────────────────────── */}
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {hasTasks ? `${counts.done}/${counts.total} done` : "No tasks"}
      </span>
    </div>
  );
}
