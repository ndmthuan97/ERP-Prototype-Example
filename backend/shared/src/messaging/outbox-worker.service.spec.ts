// =============================================================================
// OUTBOX WORKER TESTS — batch publish + retry + dead-letter logic
// =============================================================================
// The worker is the core of the Outbox Pattern: poll → publish → mark.
// These tests verify batch processing, error isolation, retry, DLQ, and
// the isProcessing guard against concurrent poll overlap.

import { OutboxWorkerService } from './outbox-worker.service';
import type { OutboxStore, OutboxRecord } from './outbox-worker.service';
import type { PubSubPublisher } from './pubsub-publisher';
import type { MetricsService } from '../observability/metrics';

// ---------------------------------------------------------------------------
// Test helpers — mock implementations
// ---------------------------------------------------------------------------

function createMockStore(events: OutboxRecord[] = []): jest.Mocked<OutboxStore> {
  return {
    fetchUnpublished: jest.fn().mockResolvedValue(events),
    markPublished: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    countPending: jest.fn().mockResolvedValue(events.length),
  };
}

function createMockPublisher(): jest.Mocked<Pick<PubSubPublisher, 'publish'>> {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockMetrics(): jest.Mocked<Pick<MetricsService, 'inc' | 'setGauge'>> {
  return {
    inc: jest.fn(),
    setGauge: jest.fn(),
  };
}

function makeEvent(
  id: string,
  type: string,
  attempts = 0,
  payload: unknown = {},
): OutboxRecord {
  return {
    id,
    eventType: type,
    payload,
    aggregateId: `agg-${id}`,
    aggregateType: 'Test',
    attempts,
  };
}

/**
 * Create an OutboxWorkerService instance with mocked dependencies.
 * Does NOT call onModuleInit (no setInterval) — we call processOutbox manually.
 */
function createWorker(
  store: OutboxStore,
  publisher: any,
  metrics?: any,
): OutboxWorkerService {
  // Access private constructor params via direct instantiation
  return new OutboxWorkerService(store, publisher, metrics);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OutboxWorkerService', () => {
  let store: jest.Mocked<OutboxStore>;
  let publisher: jest.Mocked<Pick<PubSubPublisher, 'publish'>>;
  let metrics: jest.Mocked<Pick<MetricsService, 'inc' | 'setGauge'>>;
  let worker: OutboxWorkerService;

  beforeEach(() => {
    store = createMockStore();
    publisher = createMockPublisher();
    metrics = createMockMetrics();
  });

  afterEach(() => {
    // Clean up any intervals
    worker?.onModuleDestroy();
  });

  describe('processOutbox (via onModuleInit poll cycle)', () => {
    it('should do nothing when no pending events', async () => {
      store.fetchUnpublished.mockResolvedValue([]);
      worker = createWorker(store, publisher, metrics);

      // Manually trigger processOutbox
      await (worker as any).processOutbox();

      expect(store.fetchUnpublished).toHaveBeenCalledWith(10);
      expect(publisher.publish).not.toHaveBeenCalled();
      expect(store.markPublished).not.toHaveBeenCalled();
    });

    it('should publish and mark each event in a batch', async () => {
      const events = [
        makeEvent('e1', 'customer.created'),
        makeEvent('e2', 'customer.updated'),
      ];
      store.fetchUnpublished.mockResolvedValue(events);
      worker = createWorker(store, publisher, metrics);

      await (worker as any).processOutbox();

      expect(publisher.publish).toHaveBeenCalledTimes(2);
      expect(publisher.publish).toHaveBeenCalledWith(
        'customer.created',
        {},
        { eventId: 'e1', correlationId: null },
      );
      expect(publisher.publish).toHaveBeenCalledWith(
        'customer.updated',
        {},
        { eventId: 'e2', correlationId: null },
      );
      expect(store.markPublished).toHaveBeenCalledWith('e1');
      expect(store.markPublished).toHaveBeenCalledWith('e2');
    });

    it('should extract correlationId from payload._meta', async () => {
      const payload = { data: 'test', _meta: { correlationId: 'corr-123' } };
      const events = [makeEvent('e1', 'order.submitted', 0, payload)];
      store.fetchUnpublished.mockResolvedValue(events);
      worker = createWorker(store, publisher, metrics);

      await (worker as any).processOutbox();

      expect(publisher.publish).toHaveBeenCalledWith(
        'order.submitted',
        payload,
        { eventId: 'e1', correlationId: 'corr-123' },
      );
    });

    it('should increment metrics on successful publish', async () => {
      const events = [makeEvent('e1', 'customer.created')];
      store.fetchUnpublished.mockResolvedValue(events);
      store.countPending.mockResolvedValue(5); // Simulate 5 pending total
      worker = createWorker(store, publisher, metrics);

      await (worker as any).processOutbox();

      expect(metrics.setGauge).toHaveBeenCalledWith('outbox_pending', 5);
      expect(metrics.inc).toHaveBeenCalledWith('events_published_total', {
        event: 'customer.created',
      });
    });
  });

  describe('error handling', () => {
    it('should call markFailed and continue when one event fails', async () => {
      const events = [
        makeEvent('e1', 'type.a'),
        makeEvent('e2', 'type.b'),
      ];
      store.fetchUnpublished.mockResolvedValue(events);
      publisher.publish
        .mockRejectedValueOnce(new Error('PubSub timeout')) // e1 fails
        .mockResolvedValueOnce(undefined); // e2 succeeds
      worker = createWorker(store, publisher, metrics);

      await (worker as any).processOutbox();

      // e1 — failed → markFailed
      expect(store.markFailed).toHaveBeenCalledWith('e1', 'PubSub timeout', 5);
      expect(store.markPublished).not.toHaveBeenCalledWith('e1');

      // e2 — success → markPublished (not blocked by e1 failure)
      expect(store.markPublished).toHaveBeenCalledWith('e2');
    });

    it('should increment dead-letter metrics when attempts >= maxAttempts', async () => {
      // Event with 4 previous attempts → this is attempt #5 (= MAX_ATTEMPTS)
      const events = [makeEvent('e1', 'type.a', 4)];
      store.fetchUnpublished.mockResolvedValue(events);
      publisher.publish.mockRejectedValueOnce(new Error('fail'));
      worker = createWorker(store, publisher, metrics);

      await (worker as any).processOutbox();

      expect(metrics.inc).toHaveBeenCalledWith('events_publish_failed_total', {
        event: 'type.a',
      });
      expect(metrics.inc).toHaveBeenCalledWith('events_dead_lettered_total', {
        event: 'type.a',
      });
    });

    it('should NOT trigger dead-letter when attempts < maxAttempts', async () => {
      const events = [makeEvent('e1', 'type.a', 2)]; // attempt 3 of 5
      store.fetchUnpublished.mockResolvedValue(events);
      publisher.publish.mockRejectedValueOnce(new Error('fail'));
      worker = createWorker(store, publisher, metrics);

      await (worker as any).processOutbox();

      expect(metrics.inc).toHaveBeenCalledWith('events_publish_failed_total', {
        event: 'type.a',
      });
      // Dead-letter should NOT be called
      expect(metrics.inc).not.toHaveBeenCalledWith(
        'events_dead_lettered_total',
        expect.anything(),
      );
    });
  });

  describe('isProcessing guard', () => {
    it('should skip overlapping processOutbox calls', async () => {
      // Simulate a slow batch that blocks on fetchUnpublished
      let resolveFetch!: (value: OutboxRecord[]) => void;
      store.fetchUnpublished.mockReturnValueOnce(
        new Promise<OutboxRecord[]>((r) => { resolveFetch = r; }),
      );
      store.countPending.mockResolvedValue(0);
      worker = createWorker(store, publisher, metrics);

      // Start first processOutbox (will block on fetchUnpublished)
      const first = (worker as any).processOutbox();

      // Second call while first is still running → should skip (isProcessing = true)
      await (worker as any).processOutbox();

      // countPending called once (by first call), fetchUnpublished called once
      expect(store.fetchUnpublished).toHaveBeenCalledTimes(1);

      // Unblock first call
      resolveFetch([]);
      await first;
    });
  });

  describe('lifecycle', () => {
    it('should start polling on onModuleInit', () => {
      jest.useFakeTimers();
      worker = createWorker(store, publisher, metrics);

      worker.onModuleInit();

      expect((worker as any).pollInterval).not.toBeNull();

      worker.onModuleDestroy();
      jest.useRealTimers();
    });

    it('should stop polling on onModuleDestroy', () => {
      jest.useFakeTimers();
      worker = createWorker(store, publisher, metrics);

      worker.onModuleInit();
      worker.onModuleDestroy();

      expect((worker as any).pollInterval).toBeNull();
      jest.useRealTimers();
    });
  });
});
