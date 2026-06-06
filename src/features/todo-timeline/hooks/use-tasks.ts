import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Task } from '@/features/todo-timeline/types';
import {
  getTasksByDate,
  getAllTasks,
  createTask,
  updateTask,
} from '@/features/todo-timeline/db/indexeddb-store';

// ─── Query Key Factory ─────────────────────────────────────────────────────
export const taskKeys = {
  all: ['tasks'] as const,
  byDate: (dateStr: string) => ['tasks', dateStr] as const,
  timeline: ['tasks', '__all__'] as const,
};

// ─── A. useTimelineTasks ───────────────────────────────────────────────────
/**
 * Fetches all tasks scheduled for the given calendar day.
 * Changing `dateStr` automatically refetches via the structured query key.
 */
export function useTimelineTasks(dateStr: string) {
  return useQuery<Task[]>({
    queryKey: taskKeys.byDate(dateStr),
    queryFn: () => getTasksByDate(dateStr),
    // Ensure stale data is not served from cache when switching dates
    staleTime: 0,
  });
}

// ─── B. useAllTasks ──────────────────────────────────────────────────────
/**
 * Fetches ALL tasks sorted chronologically. Past tasks remain in the DOM
 * above the viewport; the scroll position starts at today's boundary.
 */
export function useAllTasks() {
  return useQuery<Task[]>({
    queryKey: taskKeys.timeline,
    queryFn: () => getAllTasks(),
    staleTime: 0,
  });
}

// ─── C. useCreateTask ──────────────────────────────────────────────────────
/**
 * Creates a new task and invalidates all task queries so the
 * upcoming-timeline view re-renders with the new entry.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, Task>({
    mutationFn: (task: Task) => createTask(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// ─── D. useUpdateTaskStatus ────────────────────────────────────────────────
/**
 * Updates a task's status field (unfinished → done → skipped, etc.)
 * and invalidates all task queries so the timeline re-renders.
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { task: Task; newStatus: Task['status'] }, void>({
    mutationFn: async ({ task, newStatus }) => {
      const updatedTask: Task = {
        ...task,
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      await updateTask(updatedTask);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// ─── E. useUpdateTaskPriority ─────────────────────────────────────────────
/**
 * Updates a task's priority (low ↔ high).
 */
export function useUpdateTaskPriority() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { task: Task; newPriority: Task['priority'] }, void>({
    mutationFn: async ({ task, newPriority }) => {
      const updatedTask: Task = {
        ...task,
        priority: newPriority,
        updated_at: new Date().toISOString(),
      };
      await updateTask(updatedTask);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// ─── F. useDeleteTask ──────────────────────────────────────────────────────
/**
 * Deletes a task.
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, void>({
    mutationFn: async (taskId: string) => {
      const { deleteTask } = await import('@/features/todo-timeline/db/indexeddb-store');
      await deleteTask(taskId);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

