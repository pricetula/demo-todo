// ───────────────────────────────────────────────────────────────────────────────
// Unit Tests — CompletionRing  (SVG donut chart rendering)
// ───────────────────────────────────────────────────────────────────────────────
//
//  These tests render the real CompletionRing component with fixture task data
//  and verify that the SVG arcs, center text, and accessible labels are correct
//  for various completion ratios.
//
//  The system clock is pinned to 2026-06-15 so "today" is deterministic
//  (though the component itself does not depend on the clock — it summarises
//  whatever task array it receives).
// ───────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompletionRing } from "@/features/todo-timeline/components/completion-ring";
import type { Task } from "@/features/todo-timeline/types";

// ═══════════════════════════════════════════════════════════════════════════════
//  Clock — pin to 2026-06-15 (optional, used only if any helper references it)
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

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: taskId(),
    title: "Test task",
    description: "",
    status: "unfinished",
    priority: "low",
    scheduled_date: "2026-06-15",
    start_time: "09:00",
    completed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Find data-arc <circle> elements inside the SVG (excludes the background ring). */
function getDataCircles(container: HTMLElement): SVGCircleElement[] {
  const svg = container.querySelector("svg");
  if (!svg) return [];
  // Only circles that carry a stroke-* class — filters out the background ring
  // which has `className="text-border/50"` (no stroke class).
  return Array.from(svg.querySelectorAll("circle")).filter(
    (c) => c.getAttribute("class")?.includes("stroke-"),
  );
}

/**
 * Extract the stroke colour class from a circle element.
 * The CompletionRing applies Tailwind classes like "stroke-emerald-500".
 */
function getStrokeClass(circle: SVGCircleElement): string | null {
  const cls = circle.getAttribute("class");
  if (!cls) return null;
  const match = cls.match(/\bstroke-[\w/-]+\b/);
  return match ? match[0] : null;
}

/** Return the `stroke-dasharray` attribute value for a circle. */
function getDashArray(circle: SVGCircleElement): string | null {
  return circle.getAttribute("stroke-dasharray");
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Empty state
// ═══════════════════════════════════════════════════════════════════════════════

describe("CompletionRing — empty state", () => {
  it("shows 'No tasks' label when tasks array is empty", () => {
    render(<CompletionRing tasks={[]} />);

    expect(screen.getByText("No tasks")).toBeInTheDocument();
  });

  it("shows '0' in the centre when tasks array is empty", () => {
    render(<CompletionRing tasks={[]} />);

    // The centre text is rendered inside an SVG <text> element
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
    const textEl = svg!.querySelector("text");
    expect(textEl).toBeInTheDocument();
    expect(textEl!.textContent).toBe("0");
  });

  it("renders a dashed background ring when empty", () => {
    const { container } = render(<CompletionRing tasks={[]} />);

    const circles = container.querySelectorAll("circle");
    // The last circle should have the dashed dasharray: "3 4"
    const dashedCircle = Array.from(circles).find(
      (c) => c.getAttribute("stroke-dasharray") === "3 4",
    );
    expect(dashedCircle).toBeInTheDocument();
  });

  it("has accessible aria-label describing empty state", () => {
    render(<CompletionRing tasks={[]} />);

    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("aria-label", "No tasks");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: All tasks share the same status
// ═══════════════════════════════════════════════════════════════════════════════

describe("CompletionRing — uniform status", () => {
  it("shows a full green arc when all tasks are done", () => {
    const tasks: Task[] = [
      makeTask({ status: "done", completed_at: "2026-06-15T10:00:00.000Z" }),
      makeTask({ status: "done", completed_at: "2026-06-15T11:00:00.000Z" }),
      makeTask({ status: "done", completed_at: "2026-06-15T12:00:00.000Z" }),
    ];

    const { container } = render(<CompletionRing tasks={tasks} />);

    // Centre text shows "3"
    const svg = container.querySelector("svg")!;
    expect(svg.querySelector("text")!.textContent).toBe("3");

    // The text label shows "3/3 done"
    expect(screen.getByText("3/3 done")).toBeInTheDocument();

    // Only one data arc segment should exist (all done)
    const circles = getDataCircles(container);
    const doneArcs = circles.filter((c) => getStrokeClass(c) === "stroke-emerald-500");
    expect(doneArcs.length).toBe(1);

    // The arc should span the full circumference
    const arc = doneArcs[0];
    const dashArray = arc.getAttribute("stroke-dasharray");
    expect(dashArray).toMatch(/^1/); // starts with "1" (full circumference ~125.66)
  });

  it("shows a full primary-colour arc when all tasks are unfinished", () => {
    const tasks: Task[] = [
      makeTask({ status: "unfinished" }),
      makeTask({ status: "unfinished" }),
    ];

    const { container } = render(<CompletionRing tasks={tasks} />);

    expect(screen.getByText("0/2 done")).toBeInTheDocument();
    expect(container.querySelector("svg")!.querySelector("text")!.textContent).toBe("0");

    const circles = getDataCircles(container);
    const unfinishedArcs = circles.filter(
      (c) => getStrokeClass(c) === "stroke-primary",
    );
    expect(unfinishedArcs.length).toBe(1);
  });

  it("shows a full muted arc when all tasks are skipped", () => {
    const tasks: Task[] = [
      makeTask({ status: "skipped" }),
      makeTask({ status: "skipped" }),
    ];

    const { container } = render(<CompletionRing tasks={tasks} />);

    expect(screen.getByText("0/2 done")).toBeInTheDocument();

    const circles = getDataCircles(container);
    const skippedArcs = circles.filter(
      (c) => getStrokeClass(c) === "stroke-muted-foreground/30",
    );
    expect(skippedArcs.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Mixed statuses
// ═══════════════════════════════════════════════════════════════════════════════

describe("CompletionRing — mixed statuses", () => {
  it("shows three arcs for a mix of done + unfinished + skipped", () => {
    const tasks: Task[] = [
      makeTask({ status: "done", completed_at: "2026-06-15T10:00:00.000Z" }),
      makeTask({ status: "unfinished" }),
      makeTask({ status: "skipped" }),
    ];

    const { container } = render(<CompletionRing tasks={tasks} />);

    expect(screen.getByText("1/3 done")).toBeInTheDocument();

    const circles = getDataCircles(container);
    expect(circles.length).toBe(3);

    // One arc of each colour
    expect(circles.filter((c) => getStrokeClass(c) === "stroke-emerald-500")).toHaveLength(1);
    expect(circles.filter((c) => getStrokeClass(c) === "stroke-primary")).toHaveLength(1);
    expect(circles.filter((c) => getStrokeClass(c) === "stroke-muted-foreground/30")).toHaveLength(1);
  });

  it("shows two arcs when only done and unfinished are present", () => {
    const tasks: Task[] = [
      makeTask({ status: "done", completed_at: "2026-06-15T10:00:00.000Z" }),
      makeTask({ status: "done", completed_at: "2026-06-15T11:00:00.000Z" }),
      makeTask({ status: "unfinished" }),
    ];

    const { container } = render(<CompletionRing tasks={tasks} />);

    expect(screen.getByText("2/3 done")).toBeInTheDocument();
    expect(getDataCircles(container).length).toBe(2);
  });

  it("shows two arcs when only done and skipped are present", () => {
    const tasks: Task[] = [
      makeTask({ status: "done", completed_at: "2026-06-15T10:00:00.000Z" }),
      makeTask({ status: "skipped" }),
    ];

    const { container } = render(<CompletionRing tasks={tasks} />);

    expect(screen.getByText("1/2 done")).toBeInTheDocument();
    expect(getDataCircles(container).length).toBe(2);
  });

  it("shows one arc when only one status is present even with many tasks", () => {
    const tasks: Task[] = [
      makeTask({ status: "done", completed_at: "2026-06-15T10:00:00.000Z" }),
      makeTask({ status: "done", completed_at: "2026-06-15T11:00:00.000Z" }),
      makeTask({ status: "done", completed_at: "2026-06-15T12:00:00.000Z" }),
      makeTask({ status: "done", completed_at: "2026-06-15T13:00:00.000Z" }),
      makeTask({ status: "done", completed_at: "2026-06-15T14:00:00.000Z" }),
    ];

    const { container } = render(<CompletionRing tasks={tasks} />);

    expect(screen.getByText("5/5 done")).toBeInTheDocument();
    expect(getDataCircles(container).length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Arc proportions
// ═══════════════════════════════════════════════════════════════════════════════

describe("CompletionRing — arc proportions", () => {
  it("done arc is larger than unfinished arc when done count > unfinished count", () => {
    // 3 done, 1 unfinished → done arc should be ~75% of circumference
    const tasks: Task[] = [
      makeTask({ status: "done", completed_at: "2026-06-15T10:00:00.000Z" }),
      makeTask({ status: "done", completed_at: "2026-06-15T11:00:00.000Z" }),
      makeTask({ status: "done", completed_at: "2026-06-15T12:00:00.000Z" }),
      makeTask({ status: "unfinished" }),
    ];

    const { container } = render(<CompletionRing tasks={tasks} />);

    const circles = getDataCircles(container);
    const doneArc = circles.find((c) => getStrokeClass(c) === "stroke-emerald-500")!;
    const unfinishedArc = circles.find((c) => getStrokeClass(c) === "stroke-primary")!;

    const doneLength = parseFloat(doneArc.getAttribute("stroke-dasharray")!.split(" ")[0]);
    const unfinishedLength = parseFloat(unfinishedArc.getAttribute("stroke-dasharray")!.split(" ")[0]);

    // 75% > 25% → done arc should be ~3× the unfinished arc
    expect(doneLength).toBeGreaterThan(unfinishedLength * 2);
    expect(doneLength).toBeCloseTo(unfinishedLength * 3, -1);
  });

  it("produces segments that sum to the full circumference", () => {
    const tasks: Task[] = [
      makeTask({ status: "done", completed_at: "2026-06-15T10:00:00.000Z" }),
      makeTask({ status: "unfinished" }),
      makeTask({ status: "skipped" }),
    ];

    const { container } = render(<CompletionRing tasks={tasks} />);

    const circles = getDataCircles(container);
    const totalLength = circles.reduce((sum, c) => {
      const dash = c.getAttribute("stroke-dasharray");
      return sum + (dash ? parseFloat(dash.split(" ")[0]) : 0);
    }, 0);

    // Circumference is 2 * π * (44 - 5) / 2 = 2 * π * 19.5 ≈ 122.52
    // But due to stroke-linecap round, there might be slight overlap.
    // Just verify it's close to the expected circumference.
    const expectedCircumference = 2 * Math.PI * 19.5;
    expect(totalLength).toBeGreaterThan(expectedCircumference * 0.95);
    expect(totalLength).toBeLessThan(expectedCircumference * 1.05);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Centre text
// ═══════════════════════════════════════════════════════════════════════════════

describe("CompletionRing — centre text", () => {
  it("shows the number of done tasks in the centre", () => {
    const tasks: Task[] = [
      makeTask({ status: "done", completed_at: "2026-06-15T10:00:00.000Z" }),
      makeTask({ status: "done", completed_at: "2026-06-15T11:00:00.000Z" }),
      makeTask({ status: "unfinished" }),
      makeTask({ status: "skipped" }),
    ];

    render(<CompletionRing tasks={tasks} />);

    const svg = document.querySelector("svg")!;
    expect(svg.querySelector("text")!.textContent).toBe("2");
  });

  it("shows '0' in the centre when no tasks are done", () => {
    const tasks: Task[] = [
      makeTask({ status: "unfinished" }),
      makeTask({ status: "skipped" }),
    ];

    const { container } = render(<CompletionRing tasks={tasks} />);

    expect(container.querySelector("svg")!.querySelector("text")!.textContent).toBe("0");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Accessibility
// ═══════════════════════════════════════════════════════════════════════════════

describe("CompletionRing — accessibility", () => {
  it("has an aria-label describing the completion ratio", () => {
    const tasks: Task[] = [
      makeTask({ status: "done", completed_at: "2026-06-15T10:00:00.000Z" }),
      makeTask({ status: "unfinished" }),
    ];

    render(<CompletionRing tasks={tasks} />);

    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("aria-label", "1 of 2 tasks completed");
  });

  it("has an aria-label for zero tasks", () => {
    render(<CompletionRing tasks={[]} />);

    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("aria-label", "No tasks");
  });

  it("has role='img' on the SVG element", () => {
    render(<CompletionRing tasks={[]} />);

    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("role", "img");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Scenario: Single-task edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe("CompletionRing — single task", () => {
  it("shows '1/1 done' for a single done task", () => {
    const tasks: Task[] = [
      makeTask({ status: "done", completed_at: "2026-06-15T10:00:00.000Z" }),
    ];

    render(<CompletionRing tasks={tasks} />);

    expect(screen.getByText("1/1 done")).toBeInTheDocument();
    expect(document.querySelector("svg")!.querySelector("text")!.textContent).toBe("1");
  });

  it("shows '0/1 done' for a single unfinished task", () => {
    const tasks: Task[] = [
      makeTask({ status: "unfinished" }),
    ];

    render(<CompletionRing tasks={tasks} />);

    expect(screen.getByText("0/1 done")).toBeInTheDocument();
    expect(document.querySelector("svg")!.querySelector("text")!.textContent).toBe("0");
  });
});
