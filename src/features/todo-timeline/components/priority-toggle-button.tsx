"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Info } from "lucide-react";
import { type TaskPriority } from "@/features/todo-timeline/types";

// ─── Priority Toggle Button with hover info popup ──────────────────────────
//
//  The button toggles priority on click and shows an info popup on hover.
//  Uses a lightweight controlled-popover pattern so the click goes directly
//  to the toggle action rather than being intercepted by the popover trigger.

interface PriorityToggleButtonProps {
  priority: TaskPriority;
  onClick: () => void;
  className?: string;
}

export function PriorityToggleButton({
  priority,
  onClick,
  className,
}: PriorityToggleButtonProps) {
  const [open, setOpen] = React.useState(false);

  const showDelayRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideDelayRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleMouseEnter = React.useCallback(() => {
    clearTimeout(hideDelayRef.current);
    showDelayRef.current = setTimeout(() => setOpen(true), 300);
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    clearTimeout(showDelayRef.current);
    hideDelayRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      clearTimeout(showDelayRef.current);
      clearTimeout(hideDelayRef.current);
    };
  }, []);

  const isHigh = priority === "high";

  return (
    <div
      className={cn("relative shrink-0", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Toggle button (click toggles directly) ──────────────── */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "rounded p-0.5 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        )}
        aria-label={isHigh ? "Lower priority" : "Mark as high priority"}
        title={isHigh ? "Lower priority" : "Mark as high priority"}
      >
        {isHigh ? (
          <ArrowUp
            size={14}
            className="shrink-0 text-amber-500"
            aria-hidden="true"
          />
        ) : (
          <ArrowDown
            size={14}
            className="shrink-0 text-muted-foreground/40"
            aria-hidden="true"
          />
        )}
      </button>

      {/* ── Hover popup ─────────────────────────────────────────── */}
      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 w-64 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10",
            "bottom-full mb-2",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1",
          )}
          onMouseEnter={() => {
            clearTimeout(hideDelayRef.current);
            setOpen(true);
          }}
          onMouseLeave={() => {
            hideDelayRef.current = setTimeout(() => setOpen(false), 150);
          }}
        >
          {/* Header */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 font-medium">
              <Info size={13} className="text-muted-foreground" aria-hidden="true" />
              Priority:{" "}
              <span className={isHigh ? "text-amber-600" : ""}>
                {isHigh ? "High" : "Low"}
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {isHigh
                ? "High-priority tasks appear with an amber left-border accent and are sorted higher in the timeline."
                : "Low-priority tasks have no border accent and are visually calmer in the timeline."}
            </p>
          </div>

          {/* Action */}
          <div className="flex items-center gap-2 border-t border-border/40 pt-2 mt-1.5">
            <button
              type="button"
              onClick={onClick}
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {isHigh ? (
                <>
                  <ArrowDown size={12} />
                  Switch to Low
                </>
              ) : (
                <>
                  <ArrowUp size={12} />
                  Switch to High
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
