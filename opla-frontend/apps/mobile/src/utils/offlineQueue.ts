/**
 * offlineQueue.ts
 * AsyncStorage-backed queue for form submissions that couldn't be synced immediately.
 * On next app foreground or deliberate flush, pending items are submitted and removed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'opla_offline_queue';

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

/** Remove a single item from the queue by id. */
export async function clearItem(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.id !== id));
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
