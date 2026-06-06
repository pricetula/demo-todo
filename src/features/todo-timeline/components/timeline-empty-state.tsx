"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Timeline Empty State ──────────────────────────────────────────────────
/**
 * Renders an elegant empty-state placeholder that preserves the visual
 * continuity of the vertical timeline track. A dashed line segment leads
 * the eye down to a muted illustration card with a call-to-action button.
 */
interface TimelineEmptyStateProps {
  /** Called when the user clicks the CTA button to add their first task. */
  onAddTask?: () => void;
  /** Optional className override for the wrapper. */
  className?: string;
}

export function TimelineEmptyState({ onAddTask, className }: TimelineEmptyStateProps) {
  return (
    <div
      className={cn("relative flex flex-col items-center", className)}
      data-component="timeline-empty-state"
    >
      {/* ── Dashed vertical line segment ──────────────────────────── */}
      <div className="flex flex-col items-center">
        {/* Start node — ghost dot */}
        <div className="z-10 size-3 rounded-full border-2 border-dashed border-border bg-background" />

        {/* Dashed line */}
        <div className="h-16 w-0 border-l-2 border-dashed border-border" />

        {/* End node — ghost dot */}
        <div className="z-10 size-3 rounded-full border-2 border-dashed border-border bg-background" />
      </div>

      {/* ── Placeholder card ───────────────────────────────────────── */}
      <div className="mt-6 flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
        {/* Subtle icon illustration */}
        <div className="flex size-14 items-center justify-center rounded-full bg-muted/60">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground/50"
            aria-hidden="true"
          >
            {/* Clipboard-like outline */}
            <rect x="4" y="4" width="16" height="20" rx="2" ry="2" />
            <line x1="9" y1="10" x2="15" y2="10" />
            <line x1="9" y1="14" x2="15" y2="14" />
            <line x1="9" y1="18" x2="12" y2="18" />
            {/* Checkmark */}
            <path d="M16 2v4H8V2" />
          </svg>
        </div>

        {/* Micro line connector */}
        <div className="h-px w-12 bg-border" />

        {/* Copy */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            No tasks scheduled here
          </p>
          <p className="text-xs text-muted-foreground/60">
            Your timeline is clear for this time slot.
          </p>
        </div>

        {/* CTA button */}
        {onAddTask && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddTask}
            className="mt-1"
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
              className="mr-1.5"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add your first task
          </Button>
        )}
      </div>
    </div>
  );
}
