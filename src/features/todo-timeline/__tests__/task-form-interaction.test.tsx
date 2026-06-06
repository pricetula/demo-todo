// ───────────────────────────────────────────────────────────────────────────────
// TaskForm Interaction Tests — Form Clearing After Submission
// ───────────────────────────────────────────────────────────────────────────────
//
//  These tests render the TaskForm component and simulate real user interactions
//  (typing, clicking, selecting dates/times) to verify that:
//
//  1. onSubmit receives the correctly transformed payload
//  2. form.reset() clears all fields back to their default values after submit
//
//  A failure here means either the form data transformation is broken, or the
//  reset behaviour (which lets users quickly add another task) has regressed.
// ───────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskForm } from "../components/task-form";

// ═══════════════════════════════════════════════════════════════════════════════
//  Clock — pin to a known month so the Calendar is reproducible
// ═══════════════════════════════════════════════════════════════════════════════

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 5, 15, 10, 0, 0));
});

afterAll(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function getTimeSelectTriggers() {
  return screen.getAllByRole("combobox");
}

async function selectTimeOption(
  user: ReturnType<typeof userEvent.setup>,
  triggerIndex: number,
  optionLabel: string,
) {
  const triggers = getTimeSelectTriggers();
  await user.click(triggers[triggerIndex]);
  const option = await screen.findByRole("option", { name: optionLabel });
  await user.click(option);
}

/**
 * Opens the date popover and clicks the day-15 button.
 *
 * react-day-picker v10 renders each day as a plain `<button>` (no `name`
 * attribute) with the day number as text content. The calendar is
 * portal-rendered to `document.body`. We find the button whose text
 * content is "15" — with system time pinned to June 2026, this uniquely
 * identifies June 15.
 */
async function pickDate15(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Date" }));

  // Find a button whose exact text content is "15"
  const allButtons = document.querySelectorAll<HTMLButtonElement>("button");
  const day15 = Array.from(allButtons).find(
    (btn) => btn.textContent?.trim() === "15",
  );
  if (!day15) {
    const texts = Array.from(allButtons).map((b) => `"${b.textContent?.trim()}"`);
    throw new Error(
      'Could not find a button with text "15" in the document. ' +
        `Found buttons: ${texts.join(", ")}`,
    );
  }
  await user.click(day15);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("TaskForm — form clearing after submission", () => {
  it("resets all fields to defaults after a valid submit", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<TaskForm onSubmit={onSubmit} />);

    // 1. Fill title
    await user.type(
      screen.getByPlaceholderText("What do you need to do?"),
      "Buy groceries",
    );

    // 2. Fill description
    await user.type(
      screen.getByPlaceholderText("Optional details…"),
      "Milk, eggs, bread",
    );

    // 3. Priority → high
    await user.click(screen.getByRole("button", { name: "High" }));

    // 4. Pick date → June 15
    await pickDate15(user);

    // 5. Hours → "02"
    await selectTimeOption(user, 0, "02");

    // 6. Minutes → "30"
    await selectTimeOption(user, 1, "30");

    // 7. Format → "PM"
    await selectTimeOption(user, 2, "PM");

    // 8. Submit
    await user.click(screen.getByRole("button", { name: /add task/i }));

    // 9. Assert onSubmit payload
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Buy groceries",
      description: "Milk, eggs, bread",
      priority: "high",
      scheduled_date: "2026-06-15",
      start_time: "14:30",
    });

    // 10. Assert form reset to defaults
    const titleInput = screen.getByPlaceholderText(
      "What do you need to do?",
    ) as HTMLInputElement;
    expect(titleInput.value).toBe("");

    const descTextarea = screen.getByPlaceholderText(
      "Optional details…",
    ) as HTMLTextAreaElement;
    expect(descTextarea.value).toBe("");

    // Priority back to "low"
    const lowButton = screen.getByRole("button", { name: "Low" });
    const highButton = screen.getByRole("button", { name: "High" });
    expect(lowButton.className).toContain("bg-primary");
    expect(highButton.className).toContain("border");

    // Date trigger shows "Pick a date"
    expect(screen.getByText("Pick a date")).toBeDefined();

    // Time defaults: 09:00 AM
    const triggersAfter = getTimeSelectTriggers();
    expect(triggersAfter[0]).toHaveTextContent("09");
    expect(triggersAfter[1]).toHaveTextContent("00");
    expect(triggersAfter[2]).toHaveTextContent("AM");
  });

  it("calls onSubmit with correct transformed data using 24h format", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<TaskForm onSubmit={onSubmit} />);

    await user.type(
      screen.getByPlaceholderText("What do you need to do?"),
      "Evening standup",
    );

    await pickDate15(user);

    // Switch to 24h format
    await selectTimeOption(user, 2, "24h");

    // Set hours 18, minutes 00
    await selectTimeOption(user, 0, "18");
    await selectTimeOption(user, 1, "00");

    // Submit
    await user.click(screen.getByRole("button", { name: /add task/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Evening standup",
      description: "",
      priority: "low",
      scheduled_date: "2026-06-15",
      start_time: "18:00",
    });
  });

  it("resets with only required fields (title + date + default time)", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<TaskForm onSubmit={onSubmit} />);

    await user.type(
      screen.getByPlaceholderText("What do you need to do?"),
      "Quick task",
    );

    await pickDate15(user);

    await user.click(screen.getByRole("button", { name: /add task/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Quick task",
      description: "",
      priority: "low",
      scheduled_date: "2026-06-15",
      start_time: "09:00",
    });

    const titleInput = screen.getByPlaceholderText(
      "What do you need to do?",
    ) as HTMLInputElement;
    expect(titleInput.value).toBe("");
  });

  it("does not submit when validation fails (empty title)", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<TaskForm onSubmit={onSubmit} />);

    // Fill date but NOT title
    await pickDate15(user);

    await user.click(screen.getByRole("button", { name: /add task/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Title is required")).toBeDefined();
  });
});
