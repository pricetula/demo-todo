// ───────────────────────────────────────────────────────────────────────────────
// Unit Test Suite — Todo Timeline Feature
// ───────────────────────────────────────────────────────────────────────────────
//
//  Domains covered:
//    A — Time & Format Normalization   (toHHmm helper)
//    B — Form Schema Validation         (taskFormSchema via Zod)
//    C — Database CRUD Constraints      (IndexedDB store with fake-indexeddb)
//    D — Query Sorting & Timeline       (getTasksByDate chronological sort)
//
//  Each describe block is self-contained so that a failing assertion pinpoints
//  whether the breakdown occurred at the UI form layer, the Zod schema layer,
//  or the IndexedDB persistence tier.
// ───────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { toHHmm, taskFormSchema } from "../components/task-form";
import {
  createTask,
  updateTask,
  getTasksByDate,
  deleteTask,
  closeDatabase,
} from "../db/indexeddb-store";
import type { Task } from "../types";

// ═══════════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Deterministic UUID generator for test records (no crypto dependency). */
let uuidCounter = 0;
function testUuid(): string {
  uuidCounter++;
  return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, "0")}`;
}

/** Build a minimal valid Task object for CRUD tests. */
function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: testUuid(),
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

// ─── IndexedDB lifecycle — clean room between every test ──────────────────────

beforeEach(async () => {
  // Open the test database and delete every record so each test starts fresh.
  // We also wipe the database itself to guarantee no schema/stale-index issues.
  const dbs = await indexedDB.databases?.() ?? [];
  for (const dbInfo of dbs) {
    if (dbInfo.name) {
      indexedDB.deleteDatabase(dbInfo.name);
    }
  }
  // Reset the connection cache in the store module
  await closeDatabase();
  uuidCounter = 0;
  // Give fake-indexeddb a microtick to settle pending deletions
  await new Promise((r) => setTimeout(r, 0));
});

afterEach(async () => {
  await closeDatabase();
  const dbs = await indexedDB.databases?.() ?? [];
  for (const dbInfo of dbs) {
    if (dbInfo.name) {
      indexedDB.deleteDatabase(dbInfo.name);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOMAIN A — Time & Format Normalization
// ═══════════════════════════════════════════════════════════════════════════════
//
//  These tests exercise the pure `toHHmm()` function that transforms the form's
//  time picker output into a canonical `HH:mm` string for the database.
//
//  A failure here means the form→DB transformation is broken — either the AM/PM
//  conversion logic or the 24h pass-through.
// ───────────────────────────────────────────────────────────────────────────────

describe("Domain A — Time & Format Normalization (toHHmm)", () => {
  it("Scenario 1: transforms 02:30 PM → 14:30 (12h→24h PM conversion)", () => {
    const result = toHHmm("02", "30", "PM");
    expect(result).toBe("14:30");
  });

  it("Scenario 2: transforms 12:15 AM → 00:15 (12h→24h AM midnight edge case)", () => {
    const result = toHHmm("12", "15", "AM");
    expect(result).toBe("00:15");
  });

  it("Scenario 2b: transforms 12:00 PM → 12:00 (noon is a PM edge case, stays 12)", () => {
    const result = toHHmm("12", "00", "PM");
    expect(result).toBe("12:00");
  });

  it("Scenario 3: passes through 18:45 in 24h mode unchanged", () => {
    const result = toHHmm("18", "45", "24h");
    expect(result).toBe("18:45");
  });

  it("Scenario 3b: passes through 00:00 in 24h mode unchanged (midnight)", () => {
    const result = toHHmm("00", "00", "24h");
    expect(result).toBe("00:00");
  });

  it("Scenario 3c: passes through 09:05 in 24h mode with single-digit hour zero-padded", () => {
    const result = toHHmm("09", "05", "24h");
    expect(result).toBe("09:05");
  });

  it("converts 11:59 AM → 11:59 correctly (typical morning)", () => {
    const result = toHHmm("11", "59", "AM");
    expect(result).toBe("11:59");
  });

  it("converts 11:59 PM → 23:59 correctly (typical night)", () => {
    const result = toHHmm("11", "59", "PM");
    expect(result).toBe("23:59");
  });

  it("converts 01:00 AM → 01:00 correctly (early morning, non-midnight AM)", () => {
    const result = toHHmm("01", "00", "AM");
    expect(result).toBe("01:00");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOMAIN B — Form Schema Validation (Zod)
// ═══════════════════════════════════════════════════════════════════════════════
//
//  These tests validate the `taskFormSchema` Zod schema used by react-hook-form.
//  A failure here means the client-side validation rules are not enforcing
//  correct bounds — users could submit malformed data to the database.
// ───────────────────────────────────────────────────────────────────────────────

describe("Domain B — Form Schema Validation (taskFormSchema)", () => {
  const validPayload = {
    title: "Buy groceries",
    description: "Milk, eggs, bread",
    priority: "high" as const,
    date: new Date(2026, 5, 15),
    hours: "02",
    minutes: "30",
    timeFormat: "PM" as const,
  };

  // ── Scenario 5: Missing / empty titles ──────────────────────────────

  it("Scenario 5: rejects empty title string with 'Title is required'", () => {
    const result = taskFormSchema.safeParse({ ...validPayload, title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const titleErrors = result.error.issues.filter(
        (i) => i.path[0] === "title",
      );
      expect(titleErrors.length).toBeGreaterThan(0);
      expect(
        titleErrors.some((e) => e.message.includes("Title is required")),
      ).toBe(true);
    }
  });

  it("Scenario 5b: whitespace-only title passes schema validation (trim happens downstream in handleSubmit)", () => {
    // The Zod schema only checks raw string length (no .trim()). A title
    // consisting entirely of spaces has length >= 1, so it passes.
    // The component's handleSubmit() calls .trim() before DB insertion, which
    // would collapse it to "". If this behaviour needs tightening, add
    // .trim()/.min(1) chaining to the schema itself.
    const result = taskFormSchema.safeParse({ ...validPayload, title: "   " });
    expect(result.success).toBe(true);
  });

  // ── Scenario 6: Title boundary limits ───────────────────────────────

  it("Scenario 6: accepts a title of exactly 100 characters", () => {
    const title100 = "a".repeat(100);
    const result = taskFormSchema.safeParse({ ...validPayload, title: title100 });
    expect(result.success).toBe(true);
  });

  it("Scenario 6b: rejects a title of 101 characters with the expected error message", () => {
    const title101 = "a".repeat(101);
    const result = taskFormSchema.safeParse({ ...validPayload, title: title101 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const titleErrors = result.error.issues.filter(
        (i) => i.path[0] === "title",
      );
      expect(titleErrors.length).toBeGreaterThan(0);
      expect(
        titleErrors.some((e) =>
          e.message.includes("Title must be 100 characters or fewer"),
        ),
      ).toBe(true);
    }
  });

  it("Scenario 6c: accepts a single-character title (minimum valid)", () => {
    const result = taskFormSchema.safeParse({ ...validPayload, title: "x" });
    expect(result.success).toBe(true);
  });

  // ── Scenario 7: Priority enum integrity ─────────────────────────────

  it("Scenario 7: accepts 'low' priority", () => {
    const result = taskFormSchema.safeParse({ ...validPayload, priority: "low" });
    expect(result.success).toBe(true);
  });

  it("Scenario 7b: accepts 'high' priority", () => {
    const result = taskFormSchema.safeParse({ ...validPayload, priority: "high" });
    expect(result.success).toBe(true);
  });

  it("Scenario 7c: rejects 'medium' priority as invalid enum option", () => {
    const result = taskFormSchema.safeParse({
      ...validPayload,
      priority: "medium",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path[0] === "priority"),
      ).toBe(true);
    }
  });

  it("Scenario 7d: rejects arbitrary string as priority", () => {
    const result = taskFormSchema.safeParse({
      ...validPayload,
      priority: "urgent",
    });
    expect(result.success).toBe(false);
  });

  // ── Time format enum integrity ──────────────────────────────────────

  it("rejects invalid timeFormat value 'military'", () => {
    const result = taskFormSchema.safeParse({
      ...validPayload,
      timeFormat: "military",
    });
    expect(result.success).toBe(false);
  });

  // ── superRefine hour-range validation ───────────────────────────────

  it("rejects hours=25 in 24h mode via superRefine", () => {
    const result = taskFormSchema.safeParse({
      ...validPayload,
      hours: "25",
      timeFormat: "24h",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "hours")).toBe(true);
      expect(
        result.error.issues.some((m) => m.message.includes("00 and 23")),
      ).toBe(true);
    }
  });

  it("rejects hours=00 in AM/PM mode via superRefine", () => {
    const result = taskFormSchema.safeParse({
      ...validPayload,
      hours: "00",
      timeFormat: "AM",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((m) => m.message.includes("01 and 12")),
      ).toBe(true);
    }
  });

  it("rejects hours=13 in AM mode via superRefine", () => {
    const result = taskFormSchema.safeParse({
      ...validPayload,
      hours: "13",
      timeFormat: "AM",
    });
    expect(result.success).toBe(false);
  });

  // ── Date field validation ───────────────────────────────────────────

  it("rejects undefined date with expected error message", () => {
    const result = taskFormSchema.safeParse({ ...validPayload, date: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "date")).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOMAIN C — Database CRUD Constraints
// ═══════════════════════════════════════════════════════════════════════════════
//
//  These tests exercise the IndexedDB CRUD layer using fake-indexeddb. Each test
//  runs in an isolated database instance. A failure here indicates a problem in
//  the persistence tier — the database schema, connection management, or the
//  transaction helper.
// ───────────────────────────────────────────────────────────────────────────────

describe("Domain C — Database CRUD Constraints", () => {
  // ── Scenario 8: Unique record insertion ─────────────────────────────

  it("Scenario 8: creates a task and retrieves it by date with all fields intact", async () => {
    const task = makeTask({
      title: "Write unit tests",
      scheduled_date: "2026-06-15",
      start_time: "10:00",
    });

    await createTask(task);

    const results = await getTasksByDate("2026-06-15");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(task.id);
    expect(results[0].title).toBe("Write unit tests");
    expect(results[0].scheduled_date).toBe("2026-06-15");
    expect(results[0].start_time).toBe("10:00");
    expect(results[0].status).toBe("unfinished");
    expect(results[0].priority).toBe("low");
    expect(results[0].completed_at).toBeNull();
    expect(results[0].created_at).toBeDefined();
    expect(results[0].updated_at).toBeDefined();
  });

  it("Scenario 8b: creates multiple tasks and retrieves all for a date", async () => {
    const task1 = makeTask({ id: testUuid(), title: "Task A" });
    const task2 = makeTask({ id: testUuid(), title: "Task B" });
    const task3 = makeTask({ id: testUuid(), title: "Task C" });

    await createTask(task1);
    await createTask(task2);
    await createTask(task3);

    const results = await getTasksByDate("2026-06-15");
    expect(results).toHaveLength(3);
  });

  it("Scenario 8c: tasks for different dates are isolated", async () => {
    const taskToday = makeTask({
      id: testUuid(),
      scheduled_date: "2026-06-15",
      title: "Today",
    });
    const taskTomorrow = makeTask({
      id: testUuid(),
      scheduled_date: "2026-06-16",
      title: "Tomorrow",
    });

    await createTask(taskToday);
    await createTask(taskTomorrow);

    const todayResults = await getTasksByDate("2026-06-15");
    const tomorrowResults = await getTasksByDate("2026-06-16");

    expect(todayResults).toHaveLength(1);
    expect(todayResults[0].title).toBe("Today");
    expect(tomorrowResults).toHaveLength(1);
    expect(tomorrowResults[0].title).toBe("Tomorrow");
  });

  it("Scenario 8d: inserting a duplicate ID throws (store.add rejects)", async () => {
    const task = makeTask();
    await createTask(task);

    // Attempt to insert the same ID again
    await expect(createTask(task)).rejects.toThrow();
  });

  // ── Scenario 9: In-place mutation updates ───────────────────────────

  it("Scenario 9: changes status from unfinished to skipped and stamps updated_at", async () => {
    const task = makeTask({ status: "unfinished" });
    await createTask(task);

    const originalUpdatedAt = task.updated_at;

    // Wait a tick so updated_at timestamps are distinguishable
    await new Promise((r) => setTimeout(r, 10));

    const updatedTask: Task = {
      ...task,
      status: "skipped",
      completed_at: null,
      updated_at: new Date().toISOString(),
    };
    await updateTask(updatedTask);

    const results = await getTasksByDate("2026-06-15");
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("skipped");
    // Verify updated_at was actually changed (new timestamp)
    expect(results[0].updated_at).not.toBe(originalUpdatedAt);
  });

  it("Scenario 9b: changes status from unfinished to done and stamps completed_at + updated_at", async () => {
    const task = makeTask({ status: "unfinished", completed_at: null });
    await createTask(task);

    await new Promise((r) => setTimeout(r, 10));

    const completedAt = new Date().toISOString();
    const updatedTask: Task = {
      ...task,
      status: "done",
      completed_at: completedAt,
      updated_at: completedAt,
    };
    await updateTask(updatedTask);

    const results = await getTasksByDate("2026-06-15");
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("done");
    expect(results[0].completed_at).toBe(completedAt);
    expect(results[0].updated_at).toBe(completedAt);
  });

  it("Scenario 9c: reverting from done back to unfinished clears completed_at", async () => {
    const task = makeTask({
      status: "done",
      completed_at: new Date().toISOString(),
    });
    await createTask(task);

    await new Promise((r) => setTimeout(r, 10));

    const revertedTask: Task = {
      ...task,
      status: "unfinished",
      completed_at: null,
      updated_at: new Date().toISOString(),
    };
    await updateTask(revertedTask);

    const results = await getTasksByDate("2026-06-15");
    expect(results[0].status).toBe("unfinished");
    expect(results[0].completed_at).toBeNull();
  });

  it("Scenario 9d: updating a non-existent task still succeeds (store.put upserts)", async () => {
    // store.put() creates the record if it doesn't exist — validate that behaviour.
    const orphan = makeTask({ id: "orphan-0000-0000-0000-000000000000" });
    await expect(updateTask(orphan)).resolves.toBeUndefined();

    const results = await getTasksByDate(orphan.scheduled_date);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(orphan.id);
  });

  // ── Task deletion ───────────────────────────────────────────────────

  it("deleteTask removes a task and it no longer appears in queries", async () => {
    const task = makeTask();
    await createTask(task);

    await deleteTask(task.id);

    const results = await getTasksByDate(task.scheduled_date);
    expect(results).toHaveLength(0);
  });

  it("deleteTask on a non-existent ID does not throw", async () => {
    await expect(
      deleteTask("nonexistent-0000-0000-0000-000000000000"),
    ).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOMAIN D — Query Sorting & Timeline Alignment
// ═══════════════════════════════════════════════════════════════════════════════
//
//  These tests verify that `getTasksByDate` returns tasks in ascending
//  chronological order by `start_time`. The timeline UI depends on this sort
//  being correct — a failure here means the timeline will display tasks in the
//  wrong order.
// ───────────────────────────────────────────────────────────────────────────────

describe("Domain D — Query Sorting & Timeline Alignment", () => {
  it("Scenario 10: returns tasks sorted chronologically by start_time ascending", async () => {
    // Insert three tasks for the same date, inserted out of chronological order
    const taskEvening = makeTask({
      id: testUuid(),
      title: "Evening standup",
      start_time: "17:00",
      scheduled_date: "2026-06-15",
    });
    const taskMorning = makeTask({
      id: testUuid(),
      title: "Morning standup",
      start_time: "08:00",
      scheduled_date: "2026-06-15",
    });
    const taskAfternoon = makeTask({
      id: testUuid(),
      title: "Lunch meeting",
      start_time: "13:00",
      scheduled_date: "2026-06-15",
    });

    // Insert in reverse chronological order to test that sorting is not
    // dependent on insertion order
    await createTask(taskEvening); // 17:00
    await createTask(taskMorning); // 08:00
    await createTask(taskAfternoon); // 13:00

    const results = await getTasksByDate("2026-06-15");

    expect(results).toHaveLength(3);
    // Assert chronological order: 08:00 → 13:00 → 17:00
    expect(results[0].start_time).toBe("08:00");
    expect(results[0].title).toBe("Morning standup");
    expect(results[1].start_time).toBe("13:00");
    expect(results[1].title).toBe("Lunch meeting");
    expect(results[2].start_time).toBe("17:00");
    expect(results[2].title).toBe("Evening standup");
  });

  it("Scenario 10b: sorts correctly when times share the same hour", async () => {
    const taskA = makeTask({
      id: testUuid(),
      title: "09:05 slot",
      start_time: "09:05",
    });
    const taskB = makeTask({
      id: testUuid(),
      title: "09:00 slot",
      start_time: "09:00",
    });
    const taskC = makeTask({
      id: testUuid(),
      title: "09:30 slot",
      start_time: "09:30",
    });

    await createTask(taskA);
    await createTask(taskB);
    await createTask(taskC);

    const results = await getTasksByDate("2026-06-15");
    expect(results[0].start_time).toBe("09:00");
    expect(results[1].start_time).toBe("09:05");
    expect(results[2].start_time).toBe("09:30");
  });

  it("Scenario 10c: returns empty array when no tasks exist for a date", async () => {
    const results = await getTasksByDate("2099-12-31");
    expect(results).toEqual([]);
  });

  it("Scenario 10d: single task is returned as a single-element array", async () => {
    const task = makeTask({ start_time: "12:00" });
    await createTask(task);

    const results = await getTasksByDate("2026-06-15");
    expect(results).toHaveLength(1);
    expect(results[0].start_time).toBe("12:00");
  });

  it("Scenario 10e: tasks on different dates do not pollute each other's sort order", async () => {
    const day1 = makeTask({
      id: testUuid(),
      scheduled_date: "2026-06-15",
      start_time: "14:00",
    });
    const day2 = makeTask({
      id: testUuid(),
      scheduled_date: "2026-06-16",
      start_time: "06:00",
    });

    await createTask(day1);
    await createTask(day2);

    const day1Results = await getTasksByDate("2026-06-15");
    const day2Results = await getTasksByDate("2026-06-16");

    expect(day1Results).toHaveLength(1);
    expect(day1Results[0].start_time).toBe("14:00");
    expect(day2Results).toHaveLength(1);
    expect(day2Results[0].start_time).toBe("06:00");
  });
});
