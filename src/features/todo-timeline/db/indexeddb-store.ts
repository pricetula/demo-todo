// ─── Task Schema ───────────────────────────────────────────────────────────
// Single source of truth lives in ../types — re-exported here for convenience.
import { type Task } from "../types";
export type { Task };

// ─── Constants ─────────────────────────────────────────────────────────────
const DB_NAME = 'todo_timeline_db';
const DB_VERSION = 1;
const STORE_NAME = 'tasks';

// ─── Connection Cache ──────────────────────────────────────────────────────
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens (or reuses) the IndexedDB connection.
 * The promise is cached so subsequent calls share the same connection
 * without redundant open requests.
 */
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create the object store if it doesn't already exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

        // Native indexes for query performance
        store.createIndex('scheduled_date', 'scheduled_date', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('priority', 'priority', { unique: false });
      }
    };

    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Handle unexpected close (e.g. clearing browser storage)
      db.onclose = () => {
        dbPromise = null;
      };
      // Handle versionchange (e.g. another tab triggering an upgrade)
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };

      resolve(db);
    };

    request.onerror = (event: Event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      dbPromise = null; // Reset cache so a retry can attempt a fresh connection
      reject(new Error(`Failed to open IndexedDB database "${DB_NAME}": ${error?.message ?? 'Unknown error'}`));
    };

    request.onblocked = () => {
      // Another tab holds the connection open — reject so callers can react
      dbPromise = null;
      reject(new Error(`Database "${DB_NAME}" open request is blocked. Please close other tabs that are using this application.`));
    };
  });

  return dbPromise;
}

// ─── Reusable Transaction Helper ───────────────────────────────────────────
/**
 * Performs a readwrite transaction against the tasks store, executing the
 * provided callback with the store object. Returns a promise that resolves
 * with the callback's return value.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | IDBRequest<T>[],
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    let result: T;
    let pending = 1;

    const handleSuccess = (value: T) => {
      result = value;
      pending--;
      if (pending <= 0) resolve(result);
    };

    const requestResult = fn(store);

    if (Array.isArray(requestResult)) {
      pending = requestResult.length;
      requestResult.forEach((req) => {
        req.onsuccess = () => handleSuccess(req.result as T);
        req.onerror = () => reject(req.error);
      });
    } else {
      requestResult.onsuccess = () => handleSuccess(requestResult.result as T);
      requestResult.onerror = () => reject(requestResult.error);
    }

    transaction.onerror = (event: Event) => {
      reject((event.target as IDBRequest).error ?? new Error('Unknown transaction error'));
    };

    transaction.onabort = (event: Event) => {
      reject(new Error(`Transaction aborted: ${(event.target as IDBRequest)?.error?.message ?? 'Unknown cause'}`));
    };
  });
}

// ─── CRUD Operations ───────────────────────────────────────────────────────

/**
 * Inserts a new task into the IndexedDB store.
 * Throws if a task with the same `id` already exists.
 */
export async function createTask(task: Task): Promise<void> {
  await withStore('readwrite', (store) => {
    return store.add(task);
  });
}

/**
 * Updates an existing task in the store.
 * Throws if no task with the given `id` exists (use upsertTask if needed).
 */
export async function updateTask(task: Task): Promise<void> {
  await withStore('readwrite', (store) => {
    return store.put(task);
  });
}

/**
 * Deletes a task by its `id`.
 * Succeeds silently if the task does not exist.
 */
export async function deleteTask(id: string): Promise<void> {
  await withStore('readwrite', (store) => {
    return store.delete(id);
  });
}

/**
 * Fetches all tasks scheduled for a specific calendar date, using the
 * `scheduled_date` index. Results are sorted by `start_time` ascending
 * so the timeline UI displays chronologically without extra sorting.
 */
export async function getTasksByDate(dateStr: string): Promise<Task[]> {
  const tasks = await withStore<Task[]>('readonly', (store) => {
    const index = store.index('scheduled_date');
    return index.getAll(dateStr);
  });

  // Sort by start_time (HH:mm) ascending in-place
  tasks.sort((a, b) => a.start_time.localeCompare(b.start_time));

  return tasks;
}

/**
 * Fetches ALL tasks from the store, sorted chronologically by
 * `scheduled_date` then `start_time`. Past tasks are included so the
 * timeline can scroll up to review them; the viewport starts at today.
 */
export async function getAllTasks(): Promise<Task[]> {
  const tasks = await withStore<Task[]>('readonly', (store) => {
    return store.getAll();
  });

  // Sort by date then time ascending
  tasks.sort((a, b) => {
    const dateCmp = a.scheduled_date.localeCompare(b.scheduled_date);
    if (dateCmp !== 0) return dateCmp;
    return a.start_time.localeCompare(b.start_time);
  });

  return tasks;
}

// ─── Utility ───────────────────────────────────────────────────────────────

/**
 * Closes the database connection and clears the cached promise.
 * Useful for testing or when a forced reconnect is needed.
 */
export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}
