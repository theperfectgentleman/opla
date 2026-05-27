/**
 * offlineQueue.ts
 * AsyncStorage-backed queue for form submissions that couldn't be synced immediately.
 * On next app foreground or deliberate flush, pending items are submitted and removed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'opla_offline_queue';
const ATTENDANCE_QUEUE_KEY = 'opla_attendance_offline_queue';

export type QueuedSubmission = {
  id: string;
  form_id: string;
  orgId?: string;
  projectId?: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
  queued_at: string; // ISO string
  attempts: number;
};

export type QueuedAttendanceEvent = {
  id: string;
  kind: 'check_in' | 'check_out';
  orgId?: string;
  projectId?: string;
  payload: {
    timestamp?: string;
    location: { latitude: number; longitude: number; accuracy_meters?: number; label?: string };
    note?: string;
    image_uri?: string;
    signature?: string;
  };
  queued_at: string;
  attempts: number;
};

async function readQueue(): Promise<QueuedSubmission[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSubmission[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedSubmission[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function readAttendanceQueue(): Promise<QueuedAttendanceEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(ATTENDANCE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAttendanceEvent[]) : [];
  } catch {
    return [];
  }
}

async function writeAttendanceQueue(queue: QueuedAttendanceEvent[]): Promise<void> {
  await AsyncStorage.setItem(ATTENDANCE_QUEUE_KEY, JSON.stringify(queue));
}

/** Add a submission to the offline queue. */
export async function enqueue(payload: Omit<QueuedSubmission, 'id' | 'queued_at' | 'attempts'>): Promise<void> {
  const queue = await readQueue();
  queue.push({
    ...payload,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    queued_at: new Date().toISOString(),
    attempts: 0,
  });
  await writeQueue(queue);
}

/** Return all pending submissions without modifying the queue. */
export async function getQueue(): Promise<QueuedSubmission[]> {
  return readQueue();
}

/** Return count of pending submissions. */
export async function getPendingCount(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

export async function enqueueAttendanceEvent(payload: Omit<QueuedAttendanceEvent, 'id' | 'queued_at' | 'attempts'>): Promise<void> {
  const queue = await readAttendanceQueue();
  queue.push({
    ...payload,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    queued_at: new Date().toISOString(),
    attempts: 0,
  });
  await writeAttendanceQueue(queue);
}

export async function getPendingAttendanceCount(): Promise<number> {
  const q = await readAttendanceQueue();
  return q.length;
}

/** Remove a single item from the queue by id. */
export async function clearItem(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.id !== id));
}

export async function flushAttendanceEvents(
  syncFn: (item: QueuedAttendanceEvent) => Promise<any>,
): Promise<{ synced: number; failed: number; dropped: number }> {
  const queue = await readAttendanceQueue();
  if (queue.length === 0) return { synced: 0, failed: 0, dropped: 0 };

  const remaining: QueuedAttendanceEvent[] = [];
  let synced = 0;
  let failed = 0;
  let dropped = 0;

  for (const item of queue) {
    try {
      await syncFn(item);
      synced++;
    } catch {
      const updated = { ...item, attempts: item.attempts + 1 };
      if (updated.attempts >= 5) {
        dropped++;
      } else {
        remaining.push(updated);
        failed++;
      }
    }
  }

  await writeAttendanceQueue(remaining);
  return { synced, failed, dropped };
}

/**
 * Attempt to submit all queued items using the provided submit function.
 * Successfully submitted items are removed; failed items have their attempt count incremented.
 * Items that have failed 5+ times are removed (dead-letter drop) to prevent infinite loops.
 */
export async function flush(
  submitFn: (formId: string, data: Record<string, any>, metadata: Record<string, any>) => Promise<any>,
): Promise<{ synced: number; failed: number; dropped: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { synced: 0, failed: 0, dropped: 0 };

  const remaining: QueuedSubmission[] = [];
  let synced = 0;
  let failed = 0;
  let dropped = 0;

  for (const item of queue) {
    try {
      await submitFn(item.form_id, item.data, {
        ...item.metadata,
        offline_queued_at: item.queued_at,
        sync_attempt: item.attempts + 1,
      });
      synced++;
    } catch {
      const updated = { ...item, attempts: item.attempts + 1 };
      if (updated.attempts >= 5) {
        dropped++;
      } else {
        remaining.push(updated);
        failed++;
      }
    }
  }

  await writeQueue(remaining);
  return { synced, failed, dropped };
}
