// ───────────────────────────────────────────────────────────────────────────────
// Unit Tests — StreakBadge  (completion streak calculation + rendering)
// ───────────────────────────────────────────────────────────────────────────────
//
//  These tests render the real StreakBadge component with fixture task data
//  and verify that the streak number, visual state, and accessible labels are
//  correct for various completion patterns.
//
//  The streak uses `scheduled_date` for tasks with `status === "done"`, so
//  marking a batch of past tasks as done in one session still reflects the
//  schedule you kept (rather than the single calendar day you clicked "Done").
// ───────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakBadge } from "@/features/todo-timeline/components/streak-badge";
import type { Task } from "@/features/todo-timeline/types";

// ═══════════════════════════════════════════════════════════════════════════════
//  Clock — pin to 2026-06-15 (Monday)
// ═══════════════════════════════════════════════════════════════════════════════

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
});

afterAll(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Fixture Factory
// ═══════════════════════════════════════════════════════════════════════════════

let uuidCounter = 0;

function taskId(): string {
  uuidCounter++;
  return `test-uuid-${String(uuidCounter).padStart(8, "0")}`;
}

/** Build a minimal Task for streak fixtures. */
function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: taskId(),
    title: "Test task",
    description: "",
    status: "done",
    priority: "low",
    scheduled_date: "2026-06-15",
    start_time: "09:00",
    completed_at: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: No completed tasks
// ═══════════════════════════════════════════════════════════════════════════════

describe("StreakBadge — no completed tasks", () => {
  it("shows streak=0 and dimmed styling when no tasks exist", () => {
    render(<StreakBadge tasks={[]} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("days")).toBeInTheDocument();

    const badge = screen.getByTitle("No completed days");
    expect(badge.className).toMatch(/text-muted-foreground\/50/);
  });

  it("shows streak=0 when all tasks are unfinished (none done)", () => {
    const tasks: Task[] = [
      makeTask({ status: "unfinished" }),
      makeTask({ status: "unfinished" }),
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows streak=0 when all tasks are skipped (none done)", () => {
    const tasks: Task[] = [
      makeTask({ status: "skipped" }),
      makeTask({ status: "skipped" }),
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows streak=0 when tasks have status=done but empty scheduled_date", () => {
    const tasks: Task[] = [
      // @ts-expect-error — testing defensive guard: missing scheduled_date
      makeTask({ status: "done", scheduled_date: "" }),
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Single-day completions
// ═══════════════════════════════════════════════════════════════════════════════

describe("StreakBadge — single-day completions", () => {
  it("shows streak=1 when one done task is scheduled for today", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }),
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("day")).toBeInTheDocument(); // singular
  });

  it("shows streak=1 when multiple done tasks share the same scheduled date", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }),
      makeTask({ scheduled_date: "2026-06-15" }),
      makeTask({ scheduled_date: "2026-06-15" }),
    ];

    render(<StreakBadge tasks={tasks} />);

    // All three share one date → streak=1
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows streak=1 for a single done task on a past date", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-01" }), // past
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Multiple distinct dates  (total count, no consecutive logic)
// ═══════════════════════════════════════════════════════════════════════════════

describe("StreakBadge — multiple distinct dates", () => {
  it("shows total=2 for done tasks on June 1 and June 2 (the user's scenario)", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-01" }),
      makeTask({ scheduled_date: "2026-06-02" }),
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("days")).toBeInTheDocument();
  });

  it("shows total=3 for three distinct dates", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }),
      makeTask({ scheduled_date: "2026-06-14" }),
      makeTask({ scheduled_date: "2026-06-13" }),
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("counts all distinct dates even with gaps between them", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-14" }),
      makeTask({ scheduled_date: "2026-06-13" }),
      // gap — nothing done on 2026-06-12
      makeTask({ scheduled_date: "2026-06-11" }), // gap before
    ];

    render(<StreakBadge tasks={tasks} />);

    // All 3 distinct dates are counted regardless of gaps
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Active vs inactive visual styling
// ═══════════════════════════════════════════════════════════════════════════════

describe("StreakBadge — visual state", () => {
  it("applies amber active styling when streak > 0", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }),
    ];

    render(<StreakBadge tasks={tasks} />);

    const badge = screen.getByTitle(/1 day with completed tasks/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/bg-amber-50/);
    expect(badge.className).toMatch(/text-amber-700/);
  });

  it("applies muted inactive styling when streak = 0", () => {
    render(<StreakBadge tasks={[]} />);

    const badge = screen.getByTitle("No completed days");
    expect(badge.className).toMatch(/bg-muted/);
    expect(badge.className).toMatch(/text-muted-foreground\/50/);
  });

  it("shows the flame SVG icon in amber when active", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }),
    ];

    const { container } = render(<StreakBadge tasks={tasks} />);

    const flameSvg = container.querySelector("svg");
    expect(flameSvg).toBeInTheDocument();
    expect(flameSvg!.getAttribute("class")).toMatch(/text-amber-500/);
  });

  it("shows the flame SVG icon muted when inactive", () => {
    const { container } = render(<StreakBadge tasks={[]} />);

    const flameSvg = container.querySelector("svg");
    expect(flameSvg).toBeInTheDocument();
    expect(flameSvg!.getAttribute("class")).toMatch(/text-muted-foreground\/30/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Large / edge datasets
// ═══════════════════════════════════════════════════════════════════════════════

describe("StreakBadge — edge datasets", () => {
  it("handles a 30-day streak without crashing", () => {
    const tasks: Task[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(2026, 5, 15 - i);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      tasks.push(makeTask({ scheduled_date: `${yyyy}-${mm}-${dd}` }));
    }

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("counts each date once when all tasks on it are done", () => {
    // June 15: 3 tasks, all done → counts
    // June 14: 1 task, done → counts
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }),
      makeTask({ scheduled_date: "2026-06-15" }),
      makeTask({ scheduled_date: "2026-06-15" }),
      makeTask({ scheduled_date: "2026-06-14" }),
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does NOT count a date where some tasks are still unfinished", () => {
    // June 15: 2 tasks, 1 done + 1 unfinished → does NOT count
    // June 14: 1 task, done → counts
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }), // done
      { ...makeTask({ scheduled_date: "2026-06-15" }), status: "unfinished" }, // unfinished on same day
      makeTask({ scheduled_date: "2026-06-14" }), // done, counts
    ];

    render(<StreakBadge tasks={tasks} />);

    // Only June 14 qualifies (all tasks on that date are done)
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does NOT count a date with a single unfinished task", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }), // done, counts
      { ...makeTask({ scheduled_date: "2026-06-14" }), status: "unfinished" }, // single unfinished → doesn't count
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does NOT count a date with a skipped task", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }), // done, counts
      { ...makeTask({ scheduled_date: "2026-06-14" }), status: "skipped" }, // skipped → doesn't count
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("handles mixed done/unfinished across separate dates — only all-done dates count", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }), // done, counts
      makeTask({ scheduled_date: "2026-06-14" }), // done, counts
      { ...makeTask({ scheduled_date: "2026-06-13" }), status: "unfinished" }, // doesn't count
      { ...makeTask({ scheduled_date: "2026-06-12" }), status: "unfinished" }, // doesn't count
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("marking past tasks done today still gives a streak of their scheduled dates", () => {
    // This is the exact user scenario: tasks scheduled on June 1 and June 2,
    // both marked done now (June 15). Streak should be 2, not 1.
    const tasks: Task[] = [
      makeTask({
        scheduled_date: "2026-06-01",
        completed_at: "2026-06-15T10:00:00.000Z", // marked done today
      }),
      makeTask({
        scheduled_date: "2026-06-02",
        completed_at: "2026-06-15T10:30:00.000Z", // marked done today
      }),
    ];

    render(<StreakBadge tasks={tasks} />);

    // Streak uses scheduled_date, so even though both were marked done today,
    // their scheduled dates are June 1 and June 2 → streak=2
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Accessibility
// ═══════════════════════════════════════════════════════════════════════════════

describe("StreakBadge — accessibility", () => {
  it("has a title attribute describing the streak", () => {
    const tasks: Task[] = [
      makeTask({ scheduled_date: "2026-06-15" }),
    ];

    render(<StreakBadge tasks={tasks} />);

    expect(
      screen.getByTitle("1 day with completed tasks"),
    ).toBeInTheDocument();
  });

  it("has a title attribute for no active streak", () => {
    render(<StreakBadge tasks={[]} />);

    expect(screen.getByTitle("No completed days")).toBeInTheDocument();
  });
});
