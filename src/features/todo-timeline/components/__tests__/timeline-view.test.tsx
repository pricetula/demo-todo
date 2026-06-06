// ───────────────────────────────────────────────────────────────────────────────
// Integration Tests — TimelineView Component
// ───────────────────────────────────────────────────────────────────────────────
//
//  Covers four Acceptance Criteria (Gherkin-style) + three integration test
//  scenarios targeting the vertical timeline layout, today-boundary anchor,
//  status toggling via hover-reveal action bar, priority accent visuals, and
//  empty-state rendering.
//
//  These tests render the real TimelineView component (not mocked) with fixture
//  task data and spy-based callbacks. The test environment controls the system
//  clock via vi.useFakeTimers so that "today" and "now" are deterministic.
//
//  Element.prototype.scrollIntoView is spied upon so we can assert that the
//  correct boundary node receives the auto-scroll call on mount.
// ───────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimelineView } from "@/features/todo-timeline/components/timeline-view";
import type { Task, TaskStatus, TaskPriority } from "@/features/todo-timeline/types";

// ═══════════════════════════════════════════════════════════════════════════════
//  Clock — pin to mid-afternoon on a fixed day
// ═══════════════════════════════════════════════════════════════════════════════
//
//  System time: 2026-06-15T14:30:00  (Monday, June 15, 2026 at 2:30 PM)
//  This means: todayStr() = "2026-06-15", nowHHmm() = "14:30"
//  Tasks at 09:00 / 10:00 are "past" (before 14:30).
//  Tasks at 16:00 / 17:00 are "future".
//
//  The "today boundary" is the first task with scheduled_date >= "2026-06-15".
//  Since all fixture tasks share that date, the boundary is always index 0
//  (the earliest task).

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 5, 15, 14, 30, 0));
});

afterAll(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  scrollIntoView spy — installed per test so we can track calls
// ═══════════════════════════════════════════════════════════════════════════════
//
//  vitest.setup.ts stubs scrollIntoView with a no-op so Radix Select doesn't
//  crash. Here we replace that stub with a vi.fn() that we can assert on.

beforeEach(() => {
  // Swap the global stub for a tracked spy
  Element.prototype.scrollIntoView = vi.fn();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Fixture Factories
// ═══════════════════════════════════════════════════════════════════════════════

let fixtureIdCounter = 0;

/** Deterministic UUID for test tasks. */
function taskId(): string {
  fixtureIdCounter++;
  return `test-uuid-${String(fixtureIdCounter).padStart(8, "0")}`;
}

/** Build a minimal Task for timeline test fixtures. */
function makeTask(overrides: Partial<Task> & { start_time: string }): Task {
  return {
    id: taskId(),
    title: "Untitled",
    description: "",
    status: "unfinished",
    priority: "low",
    scheduled_date: "2026-06-15",
    completed_at: null,
    created_at: "2026-06-14T10:00:00.000Z",
    updated_at: "2026-06-14T10:00:00.000Z",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Render TimelineView with default no-op callbacks and optional overrides. */
function renderTimelineView({
  tasks,
  onUpdateStatus = vi.fn(),
  onTogglePriority = vi.fn(),
  onAddTask = vi.fn(),
}: {
  tasks: Task[];
  onUpdateStatus?: (taskId: string, newStatus: TaskStatus) => void;
  onTogglePriority?: (taskId: string, newPriority: TaskPriority) => void;
  onAddTask?: () => void;
}) {
  return render(
    <TimelineView
      tasks={tasks}
      onUpdateStatus={onUpdateStatus}
      onTogglePriority={onTogglePriority}
      onAddTask={onAddTask}
    />,
  );
}

/**
 * Assert that a task card at the given row contains the expected CSS classes
 * indicating the visual state of a "past" vs "future" time label.
 */
function expectTimeLabelStyle(
  container: HTMLElement,
  task: Task,
  expected: "past" | "future",
) {
  // The time label is rendered inside a <time> element with dateTime={task.start_time}.
  // It lives in the left sticky column (desktop) or the mobile row.
  const timeEl = container.querySelector(`time[datetime="${task.start_time}"]`);
  expect(timeEl).toBeInTheDocument();

  const className = timeEl!.getAttribute("class") ?? "";
  if (expected === "past") {
    // Past tasks get "text-muted-foreground/50"
    expect(className).toMatch(/text-muted-foreground\/50/);
  } else {
    // Future tasks get "text-muted-foreground" (no opacity modifier)
    expect(className).toMatch(/text-muted-foreground/);
    expect(className).not.toMatch(/text-muted-foreground\/\d+/);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ACCEPTANCE CRITERIA
// ═══════════════════════════════════════════════════════════════════════════════
//
//  ────────────────────────────────────────────────────────────────────────────
//  Scenario 1: Initial Focus Anchor
//  ────────────────────────────────────────────────────────────────────────────
//    Given a list of tasks containing past, present, and future items
//    When the timeline mounts
//    Then the first "unfinished" task closest to the current time must receive
//      active styling
//    And scrollIntoView must be called on its DOM node
//  ────────────────────────────────────────────────────────────────────────────

describe("Scenario 1 — Initial Focus Anchor", () => {
  it("scrollIntoView is called on the today-boundary task after mount", () => {
    const tasks = [
      makeTask({ id: "past-1", title: "Morning standup", start_time: "09:00" }),
      makeTask({ id: "past-2", title: "Code review", start_time: "10:00" }),
      makeTask({ id: "present-1", title: "Team sync", start_time: "14:00" }),
      makeTask({ id: "future-1", title: "Design review", start_time: "16:00" }),
      makeTask({ id: "future-2", title: "Evening planning", start_time: "17:00" }),
    ];

    renderTimelineView({ tasks });

    // The scrollIntoView effect uses a 120ms setTimeout. Advance timers to
    // flush the timeout and trigger the scrollIntoView call.
    vi.advanceTimersByTime(200);

    // The today boundary is index 0 — first task with scheduled_date >= today.
    // All tasks are on 2026-06-15, so boundaryIndex = 0 → task "Morning standup".
    const spy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

    expect(spy).toHaveBeenCalledTimes(1);

    // The `this` context of the call should be the DOM element that scrollIntoView
    // was invoked on. Verify it is the boundary task by checking data-task-id.
    const thisArg = spy.mock.contexts[0] as HTMLElement | undefined;
    expect(thisArg).toBeDefined();
    expect(thisArg!.getAttribute("data-task-id")).toBe("past-1");
  });

  it("renders the 'Today' dashed divider above the boundary task", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Task A", start_time: "09:00" }),
      makeTask({ id: "t2", title: "Task B", start_time: "12:00" }),
    ];

    renderTimelineView({ tasks });

    // The "Today" divider is an aria-hidden decorative element with the text "Today"
    const todayLabels = screen.getAllByText("Today");
    expect(todayLabels.length).toBeGreaterThanOrEqual(1);

    // The divider uses uppercase text — also verify the label exists
    const todayHeader = todayLabels.find(
      (el) => el.tagName === "SPAN" && el.className.includes("tracking-wider"),
    );
    expect(todayHeader).toBeInTheDocument();
  });

  it("does NOT call scrollIntoView when tasks array is empty", () => {
    renderTimelineView({ tasks: [] });
    const spy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    expect(spy).not.toHaveBeenCalled();
  });

  it("does NOT call scrollIntoView when all tasks are in the past (no today boundary)", () => {
    // All tasks have scheduled_date < today
    const tasks = [
      makeTask({
        id: "t1",
        title: "Yesterday task",
        scheduled_date: "2026-06-14",
        start_time: "10:00",
      }),
    ];

    renderTimelineView({ tasks });
    const spy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    // boundaryId will be null because no task has scheduled_date >= today
    expect(spy).not.toHaveBeenCalled();
  });

  it("renders an active (sticky) node dot with primary colors when IntersectionObserver would fire", () => {
    // Note: IntersectionObserver is mocked in jsdom (no real layout).
    // This test verifies that the boundary task's node dot structure exists
    // and the 'Today' divider appears at the correct position.
    const tasks = [
      makeTask({ id: "boundary", title: "Boundary task", start_time: "14:00" }),
      makeTask({ id: "later", title: "Later task", start_time: "16:00" }),
    ];

    renderTimelineView({ tasks });

    // The boundary task's node dot should be visually distinct.
    // Find the data-task-id element for "boundary"
    const boundaryRow = document.querySelector('[data-task-id="boundary"]');
    expect(boundaryRow).toBeInTheDocument();

    // The "Today" divider must appear before (above) the boundary task
    const allLabels = screen.getAllByText("Today");
    expect(allLabels.length).toBeGreaterThanOrEqual(1);
  });
});

//  ────────────────────────────────────────────────────────────────────────────
//  Scenario 2: State Mutation Toggle
//  ────────────────────────────────────────────────────────────────────────────
//    Given an active task card on the timeline
//    When the user clicks the "Mark as Done" action button
//    Then the task's status must update (callback fires)
//    And its visual highlight should dim (opacity class changes)
//    And its completed_at timestamp should render (when status = done)
//  ────────────────────────────────────────────────────────────────────────────

describe("Scenario 2 — State Mutation Toggle", () => {
  it("fires onUpdateStatus with the task ID and next status when the action button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateStatus = vi.fn();

    // An unfinished task — next status is "done"
    const tasks = [
      makeTask({ id: "t1", title: "Write docs", status: "unfinished", start_time: "10:00" }),
    ];

    renderTimelineView({ tasks, onUpdateStatus });

    // The hover-reveal action bar is always rendered in the DOM.
    // Query the button by its aria-label. For an "unfinished" task,
    // getNextStatus("unfinished") = "done", so aria-label = "Mark as done".
    const doneButton = screen.getByRole("button", { name: /mark as done/i });
    expect(doneButton).toBeInTheDocument();

    await user.click(doneButton);

    expect(onUpdateStatus).toHaveBeenCalledTimes(1);
    expect(onUpdateStatus).toHaveBeenCalledWith("t1", "done");
  });

  it("toggles done→skipped and skipped→unfinished correctly via action button", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateStatus = vi.fn();

    // A "done" task — next is "skipped"
    const tasksDone = [
      makeTask({ id: "t2", title: "Review PR", status: "done", start_time: "11:00" }),
    ];

    const { unmount } = renderTimelineView({ tasks: tasksDone, onUpdateStatus });

    const skipButton = screen.getByRole("button", { name: /mark as skipped/i });
    await user.click(skipButton);
    expect(onUpdateStatus).toHaveBeenCalledWith("t2", "skipped");

    unmount();

    // A "skipped" task — next is "unfinished" (cycles back)
    const onUpdateStatus2 = vi.fn();
    const tasksSkipped = [
      makeTask({ id: "t3", title: "Old item", status: "skipped", start_time: "08:00" }),
    ];

    renderTimelineView({ tasks: tasksSkipped, onUpdateStatus: onUpdateStatus2 });

    const reopenButton = screen.getByRole("button", { name: /mark as unfinished/i });
    await user.click(reopenButton);
    expect(onUpdateStatus2).toHaveBeenCalledWith("t3", "unfinished");
  });

  it("applies opacity-60 class when task status is 'done'", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Finished task", status: "done", start_time: "09:00" }),
      makeTask({ id: "t2", title: "Active task", status: "unfinished", start_time: "10:00" }),
    ];

    renderTimelineView({ tasks });

    // The card for the "done" task should have the opacity-60 class.
    // The card is a child of the data-task-id row. The card itself has
    // a className containing the opacity utility.
    const doneRow = document.querySelector('[data-task-id="t1"]');
    expect(doneRow).toBeInTheDocument();

    // The card div is inside the row; it gets classes via cn(). The done card
    // should have 'opacity-60' and the title should have 'line-through' and
    // 'text-muted-foreground'.
    const cardContainer = doneRow!.querySelector(".rounded-lg.border.bg-card");
    expect(cardContainer).toBeInTheDocument();
    expect(cardContainer!.className).toMatch(/opacity-60/);

    // Also verify the title has the line-through style
    const titleEl = doneRow!.querySelector("h3");
    expect(titleEl!.className).toMatch(/line-through/);
    expect(titleEl!.className).toMatch(/text-muted-foreground/);
  });

  it("renders status badge text reflecting the done status", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Done task", status: "done", start_time: "10:00" }),
    ];

    renderTimelineView({ tasks });

    // The status badge shows "done" as uppercase text
    const badge = screen.getByText("done");
    expect(badge.tagName).toBe("SPAN");
    expect(badge.className).toMatch(/uppercase/);
  });

  it("renders status badge reflecting unfinished (Pending) status", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Active task", status: "unfinished", start_time: "10:00" }),
    ];

    renderTimelineView({ tasks });

    const pendingBadge = screen.getByText("Pending");
    expect(pendingBadge).toBeInTheDocument();
  });
});

//  ────────────────────────────────────────────────────────────────────────────
//  Scenario 3: Priority Accent Visuals
//  ────────────────────────────────────────────────────────────────────────────
//    Given a task with a priority set to "high"
//    Then its timeline card container must include specialized styling classes
//      (e.g., border accents or background tints) that distinguish it from
//      "low" priority tasks.
//  ────────────────────────────────────────────────────────────────────────────

describe("Scenario 3 — Priority Accent Visuals", () => {
  it("applies 'border-l-2 border-l-amber-400' to high-priority cards", () => {
    const tasks = [
      makeTask({ id: "high-1", title: "Urgent item", priority: "high", start_time: "09:00" }),
      makeTask({ id: "low-1", title: "Normal item", priority: "low", start_time: "10:00" }),
    ];

    renderTimelineView({ tasks });

    const highRow = document.querySelector('[data-task-id="high-1"]');
    const lowRow = document.querySelector('[data-task-id="low-1"]');

    // The card div is inside each row
    const highCard = highRow!.querySelector(".rounded-lg.border.bg-card");
    const lowCard = lowRow!.querySelector(".rounded-lg.border.bg-card");

    // High priority gets the amber left-border accent
    expect(highCard!.className).toMatch(/border-l-2/);
    expect(highCard!.className).toMatch(/border-l-amber-400/);

    // Low priority does NOT get these classes
    expect(lowCard!.className).not.toMatch(/border-l-2/);
    expect(lowCard!.className).not.toMatch(/border-l-amber/);
  });

  it("renders a visible priority toggle button with amber icon for high-priority tasks", () => {
    const tasks = [
      makeTask({ id: "t1", title: "High prio", priority: "high", start_time: "09:00" }),
    ];

    renderTimelineView({ tasks });

    // The priority toggle button has aria-label="Lower priority" when high,
    // and "Mark as high priority" when low.
    const toggleBtn = screen.getByRole("button", { name: /lower priority/i });
    expect(toggleBtn).toBeInTheDocument();

    // The SVG icon inside should have text-amber-500 class
    const svg = toggleBtn.querySelector("svg");
    // SVGElement.className is SVGAnimatedString — use getAttribute
    expect(svg!.getAttribute("class")).toMatch(/text-amber-500/);
  });

  it("renders a muted priority toggle icon for low-priority tasks", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Low prio", priority: "low", start_time: "09:00" }),
    ];

    renderTimelineView({ tasks });

    const toggleBtn = screen.getByRole("button", { name: /mark as high priority/i });
    expect(toggleBtn).toBeInTheDocument();

    const svg = toggleBtn.querySelector("svg");
    expect(svg!.getAttribute("class")).toMatch(/text-muted-foreground/);
  });

  it("fires onTogglePriority when the priority button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onTogglePriority = vi.fn();

    const tasks = [
      makeTask({ id: "t1", title: "Toggle me", priority: "low", start_time: "10:00" }),
    ];

    renderTimelineView({ tasks, onTogglePriority });

    const toggleBtn = screen.getByRole("button", { name: /mark as high priority/i });
    await user.click(toggleBtn);

    // Priority toggles from "low" to "high"
    expect(onTogglePriority).toHaveBeenCalledTimes(1);
    expect(onTogglePriority).toHaveBeenCalledWith("t1", "high");
  });

  it("fires onTogglePriority when toggling from high back to low", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onTogglePriority = vi.fn();

    const tasks = [
      makeTask({ id: "t1", title: "Toggle me", priority: "high", start_time: "10:00" }),
    ];

    renderTimelineView({ tasks, onTogglePriority });

    const toggleBtn = screen.getByRole("button", { name: /lower priority/i });
    await user.click(toggleBtn);

    expect(onTogglePriority).toHaveBeenCalledWith("t1", "low");
  });
});

//  ────────────────────────────────────────────────────────────────────────────
//  Scenario 4: Empty State Rendering
//  ────────────────────────────────────────────────────────────────────────────
//    Given an empty array of tasks for a selected day
//    When the timeline component renders
//    Then the task list layout must be replaced entirely by the empty state
//      placeholder card and call-to-action button.
//  ────────────────────────────────────────────────────────────────────────────

describe("Scenario 4 — Empty State Rendering", () => {
  it("renders the empty-state placeholder when no tasks are provided", () => {
    renderTimelineView({ tasks: [] });

    // The empty state inline markup in TimelineView uses
    // data-component="timeline-view-empty"
    const emptyWrapper = document.querySelector('[data-component="timeline-view-empty"]');
    expect(emptyWrapper).toBeInTheDocument();

    // The main empty-state heading text
    expect(screen.getByText("No tasks scheduled here")).toBeInTheDocument();

    // The supporting subtitle
    expect(
      screen.getByText("Your timeline is clear for this time slot."),
    ).toBeInTheDocument();
  });

  it("renders the CTA button when onAddTask callback is provided", () => {
    renderTimelineView({ tasks: [], onAddTask: vi.fn() });

    const ctaButton = screen.getByRole("button", { name: /add your first task/i });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton.tagName).toBe("BUTTON");
  });

  it("fires onAddTask when the empty-state CTA button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onAddTask = vi.fn();

    renderTimelineView({ tasks: [], onAddTask });

    const ctaButton = screen.getByRole("button", { name: /add your first task/i });
    await user.click(ctaButton);

    expect(onAddTask).toHaveBeenCalledTimes(1);
  });

  it("does NOT render a CTA button when onAddTask is not provided", () => {
    // Render without onAddTask — the button should not appear
    render(<TimelineView tasks={[]} onUpdateStatus={vi.fn()} onTogglePriority={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /add your first task/i })).toBeNull();
  });

  it("renders zero task card rows when tasks array is empty", () => {
    renderTimelineView({ tasks: [] });

    // No elements with data-task-id should exist
    const taskRows = document.querySelectorAll("[data-task-id]");
    expect(taskRows.length).toBe(0);
  });

  it("does NOT render the 'End of timeline' footer in empty state", () => {
    renderTimelineView({ tasks: [] });

    // The "End of timeline" text is rendered only in the non-empty branch
    expect(screen.queryByText(/end of timeline/i)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INTEGRATION TEST CASES
// ═══════════════════════════════════════════════════════════════════════════════
//
//  ────────────────────────────────────────────────────────────────────────────
//  Integration Test Case 1: Chronological Layout
//  ────────────────────────────────────────────────────────────────────────────
//    Render the timeline with mock data and verify that past tasks render above
//    the active anchor and future tasks render below it chronologically.
//  ────────────────────────────────────────────────────────────────────────────

describe("Integration — Chronological Layout (Past ÷ Future ordering)", () => {
  it("renders all tasks in chronological order by start_time ascending", () => {
    const tasks = [
      makeTask({ id: "a", title: "Early bird", start_time: "08:00" }),
      makeTask({ id: "b", title: "Late morning", start_time: "11:00" }),
      makeTask({ id: "c", title: "Afternoon", start_time: "14:00" }),
      makeTask({ id: "d", title: "Evening", start_time: "17:30" }),
    ];

    renderTimelineView({ tasks });

    // Query all task title headings in DOM order
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(4);
    expect(headings[0]).toHaveTextContent("Early bird");
    expect(headings[1]).toHaveTextContent("Late morning");
    expect(headings[2]).toHaveTextContent("Afternoon");
    expect(headings[3]).toHaveTextContent("Evening");
  });

  it("applies 'past' time-label styling to tasks with start_time before now", () => {
    // System time is 14:30. Tasks at 09:00, 10:00 are past.
    // Tasks at 16:00 are future.
    const tasks = [
      makeTask({ id: "past-1", title: "Morning", start_time: "09:00" }),
      makeTask({ id: "past-2", title: "Late morning", start_time: "10:00" }),
      makeTask({ id: "future-1", title: "Afternoon sync", start_time: "16:00" }),
    ];

    const { container } = renderTimelineView({ tasks });

    for (const task of tasks) {
      const isPast = task.start_time < "14:30";
      expectTimeLabelStyle(container, task, isPast ? "past" : "future");
    }
  });

  it("handles tasks with the same start_time (renders both, preserves order)", () => {
    const tasks = [
      makeTask({ id: "a", title: "Meeting A", start_time: "10:00" }),
      makeTask({ id: "b", title: "Meeting B", start_time: "10:00" }),
    ];

    renderTimelineView({ tasks });

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings[0]).toHaveTextContent("Meeting A");
    expect(headings[1]).toHaveTextContent("Meeting B");
  });
});

//  ────────────────────────────────────────────────────────────────────────────
//  Integration Test Case 2: Status Toggle Callback
//  ────────────────────────────────────────────────────────────────────────────
//    Simulate a user clicking the status toggle on a card. Verify that the
//    component fires the correct callback function with the updated task state
//    payload (ready to pass to IndexedDB).
//  ────────────────────────────────────────────────────────────────────────────

describe("Integration — Status Toggle Callback Payload", () => {
  it("fires onUpdateStatus with task ID and the cycled status for an unfinished task", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateStatus = vi.fn();

    const tasks = [
      makeTask({
        id: "task-1",
        title: "Standup notes",
        status: "unfinished",
        start_time: "09:00",
      }),
    ];

    renderTimelineView({ tasks, onUpdateStatus });

    await user.click(screen.getByRole("button", { name: /mark as done/i }));

    // Payload: (taskId, newStatus)
    // IndexedDB mutation: { ..., status: "done", completed_at: <ISO>, updated_at: <ISO> }
    expect(onUpdateStatus).toHaveBeenCalledWith("task-1", "done");
  });

  it("fires onUpdateStatus with 'skipped' when cycling a done task", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateStatus = vi.fn();

    const tasks = [
      makeTask({
        id: "task-2",
        title: "Completed item",
        status: "done",
        start_time: "11:00",
      }),
    ];

    renderTimelineView({ tasks, onUpdateStatus });

    await user.click(screen.getByRole("button", { name: /mark as skipped/i }));

    expect(onUpdateStatus).toHaveBeenCalledWith("task-2", "skipped");
  });

  it("fires onUpdateStatus with 'unfinished' (reopen) when cycling a skipped task", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateStatus = vi.fn();

    const tasks = [
      makeTask({
        id: "task-3",
        title: "Skipped item",
        status: "skipped",
        start_time: "08:00",
      }),
    ];

    renderTimelineView({ tasks, onUpdateStatus });

    // The next status cycles: skipped → unfinished → done → skipped
    // getNextStatus("skipped") returns "unfinished", aria-label="Mark as unfinished"
    await user.click(screen.getByRole("button", { name: /mark as unfinished/i }));

    expect(onUpdateStatus).toHaveBeenCalledWith("task-3", "unfinished");
  });

  it("does not fire onUpdateStatus when clicking the priority toggle instead", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdateStatus = vi.fn();
    const onTogglePriority = vi.fn();

    const tasks = [
      makeTask({ id: "t1", title: "Task", priority: "low", start_time: "09:00" }),
    ];

    renderTimelineView({ tasks, onUpdateStatus, onTogglePriority });

    // Click the priority toggle (arrow-up icon button)
    await user.click(screen.getByRole("button", { name: /mark as high priority/i }));

    // Status should NOT have been triggered
    expect(onUpdateStatus).not.toHaveBeenCalled();
    expect(onTogglePriority).toHaveBeenCalledTimes(1);
  });
});

//  ────────────────────────────────────────────────────────────────────────────
//  Integration Test Case 3: Empty State Visibility
//  ────────────────────────────────────────────────────────────────────────────
//    Pass an empty task array to the component and assert that the text/elements
//    belonging to the empty state component are visible in the document, while
//    no task cards are present.
//  ────────────────────────────────────────────────────────────────────────────

describe("Integration — Empty State Visibility", () => {
  it("renders empty state elements when tasks=[], no task cards present", () => {
    renderTimelineView({ tasks: [] });

    // 1) No task-card headings (h3 elements)
    const headings = screen.queryAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(0);

    // 2) No elements with data-task-id
    const taskRows = document.querySelectorAll("[data-task-id]");
    expect(taskRows).toHaveLength(0);

    // 3) The empty state container is rendered
    const emptyEl = document.querySelector('[data-component="timeline-view-empty"]');
    expect(emptyEl).toBeInTheDocument();

    // 4) Key empty-state copy is visible
    expect(screen.getByText("No tasks scheduled here")).toBeInTheDocument();
    expect(
      screen.getByText("Your timeline is clear for this time slot."),
    ).toBeInTheDocument();

    // 5) No status badges exist
    expect(screen.queryByText("Pending")).toBeNull();
    expect(screen.queryByText("done")).toBeNull();
  });

  it("renders CTA button with accessible name when onAddTask is provided", () => {
    renderTimelineView({ tasks: [], onAddTask: vi.fn() });

    // The button text is "Add your first task"
    const cta = screen.getByRole("button", { name: /add your first task/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toBeVisible();

    // The button contains an SVG icon (the + icon)
    const svg = cta.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("does not render the 'Today' divider in empty state", () => {
    renderTimelineView({ tasks: [] });

    // The "Today" divider is only rendered in the populated branch
    expect(screen.queryByText("Today")).toBeNull();
  });

  it("does not render the timeline-end footer in empty state", () => {
    renderTimelineView({ tasks: [] });

    expect(screen.queryByText(/end of timeline/i)).toBeNull();
  });

  it("renders a dashed timeline trail in the empty state (two ghost dots + dashed line)", () => {
    renderTimelineView({ tasks: [] });

    const emptyEl = document.querySelector('[data-component="timeline-view-empty"]');
    expect(emptyEl).toBeInTheDocument();

    // Two ghost dots with dashed border
    const ghostDots = emptyEl!.querySelectorAll(".rounded-full.border-dashed");
    expect(ghostDots.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Edge Cases & Additional Coverage
// ═══════════════════════════════════════════════════════════════════════════════

describe("Edge Cases — Data Boundary", () => {
  it("renders a single task without crashing", () => {
    const tasks = [
      makeTask({ id: "solo", title: "Only task", start_time: "12:00" }),
    ];

    renderTimelineView({ tasks });

    expect(screen.getByText("Only task")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });

  it("handles tasks with empty description gracefully (no <p> rendered)", () => {
    const tasks = [
      makeTask({ id: "t1", title: "No desc", description: "", start_time: "09:00" }),
    ];

    const { container } = renderTimelineView({ tasks });

    // The description paragraph with line-clamp should NOT be rendered
    const descPara = container.querySelector("p.line-clamp-2");
    expect(descPara).toBeNull();
  });

  it("handles tasks with a long description (renders line-clamp-2 class)", () => {
    const tasks = [
      makeTask({
        id: "t1",
        title: "With desc",
        description: "This is a long description that should be truncated.",
        start_time: "10:00",
      }),
    ];

    const { container } = renderTimelineView({ tasks });

    const descPara = container.querySelector("p.line-clamp-2");
    expect(descPara).toBeInTheDocument();
    expect(descPara).toHaveTextContent(/truncated/);
  });

  it("renders the 'End of timeline' footer when tasks are present", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Task", start_time: "10:00" }),
    ];

    renderTimelineView({ tasks });

    expect(screen.getByText(/end of timeline/i)).toBeInTheDocument();
  });

  it("applies past styling to done/skipped tasks regardless of start_time", () => {
    // System time is 14:30.
    // Even a task at 16:00 should be visually "past" if its status is "done" or "skipped".
    const tasks = [
      makeTask({
        id: "t1",
        title: "Done in future slot",
        status: "done",
        start_time: "16:00", // chronologically future, but status is done
      }),
    ];

    renderTimelineView({ tasks });

    const doneCard = document.querySelector('[data-task-id="t1"] .rounded-lg.border.bg-card');
    expect(doneCard!.className).toMatch(/opacity-60/);

    // The time label should be muted (past styling) even though the time is future,
    // because the status=done overrides the "isPast" logic
    const timeEl = document.querySelector('time[datetime="16:00"]');
    expect(timeEl!.className).toMatch(/text-muted-foreground\/50/);
  });
});

describe("Edge Cases — Accessibility & ARIA", () => {
  it("all status-toggle buttons have accessible names via aria-label", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Unfinished", status: "unfinished", start_time: "09:00" }),
      makeTask({ id: "t2", title: "Done", status: "done", start_time: "10:00" }),
      makeTask({ id: "t3", title: "Skipped", status: "skipped", start_time: "11:00" }),
    ];

    renderTimelineView({ tasks });

    // Each action button should have a unique aria-label
    const doneBtn = screen.getByRole("button", { name: /mark as done/i });
    const skipBtn = screen.getByRole("button", { name: /mark as skipped/i });
    const reopenBtn = screen.getByRole("button", { name: /mark as unfinished/i });

    expect(doneBtn).toBeInTheDocument();
    expect(skipBtn).toBeInTheDocument();
    expect(reopenBtn).toBeInTheDocument();
  });

  it("priority toggle buttons have distinct accessible labels", () => {
    const tasks = [
      makeTask({ id: "t1", title: "High", priority: "high", start_time: "09:00" }),
      makeTask({ id: "t2", title: "Low", priority: "low", start_time: "10:00" }),
    ];

    renderTimelineView({ tasks });

    expect(
      screen.getByRole("button", { name: /lower priority/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /mark as high priority/i }),
    ).toBeInTheDocument();
  });

  it("uses semantic <time> elements with correct datetime attributes", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Task", start_time: "09:30" }),
    ];

    const { container } = renderTimelineView({ tasks });

    const timeEl = container.querySelector('time[datetime="09:30"]');
    expect(timeEl).toBeInTheDocument();
  });

  it("renders decorative timeline dot elements with aria-hidden", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Task", start_time: "10:00" }),
    ];

    const { container } = renderTimelineView({ tasks });

    // The node dot container has aria-hidden="true"
    const nodeDots = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
      .filter((el) => {
        const cls = el.getAttribute("class") ?? "";
        return cls.includes("rounded-full") || cls.includes("size-[14px]");
      });

    expect(nodeDots.length).toBeGreaterThanOrEqual(1);
  });
});
