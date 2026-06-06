import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Task } from '@/features/todo-timeline/types';
import {
  getTasksByDate,
  createTask,
  updateTask,
} from '@/features/todo-timeline/db/indexeddb-store';

// ─── Query Key Factory ─────────────────────────────────────────────────────
export const taskKeys = {
  all: ['tasks'] as const,
  byDate: (dateStr: string) => ['tasks', dateStr] as const,
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

// ─── B. useCreateTask ──────────────────────────────────────────────────────
/**
 * Creates a new task and invalidates the timeline query for the given date
 * so the UI re-renders with the new entry.
 */
export function useCreateTask(dateStr: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, Task>({
    mutationFn: (task: Task) => createTask(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byDate(dateStr) });
    },
  });
}

// ─── C. useUpdateTaskStatus ────────────────────────────────────────────────
/**
 * Updates a task's status field (unfinished → done → skipped, etc.)
 * and invalidates the timeline so the change is reflected immediately.
 */
export function useUpdateTaskStatus(dateStr: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { task: Task; newStatus: Task['status'] }, { previousTasks: Task[] | undefined }>({
    mutationFn: async ({ task, newStatus }) => {
      const updatedTask: Task = {
        ...task,
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      await updateTask(updatedTask);
    },

    // ── Optimistic update ──────────────────────────────────────────────
    onMutate: async ({ task, newStatus }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic state
      await queryClient.cancelQueries({ queryKey: taskKeys.byDate(dateStr) });

      // Snapshot the current cached tasks
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.byDate(dateStr));

      // Optimistically patch the cache
      queryClient.setQueryData<Task[]>(taskKeys.byDate(dateStr), (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: newStatus,
                completed_at: newStatus === 'done' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              }
            : t,
        );
      });

      // Return snapshot for rollback on error
      return { previousTasks };
    },

    // If the mutation fails, roll back to the saved snapshot
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.byDate(dateStr), context.previousTasks);
      }
    },

    // Always refetch after mutation settles to stay in sync with IndexedDB
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byDate(dateStr) });
    },
  });
}
