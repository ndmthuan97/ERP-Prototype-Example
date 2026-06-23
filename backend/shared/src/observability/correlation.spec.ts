// =============================================================================
// CORRELATION TESTS — AsyncLocalStorage-based request tracing
// =============================================================================
// Tests verify that correlationId propagates correctly through async contexts,
// middleware reads/generates IDs, and contexts are isolated per request.

import {
  getCorrelationId,
  runWithCorrelation,
  CorrelationMiddleware,
  CORRELATION_HEADER,
} from './correlation';

describe('getCorrelationId', () => {
  it('should return undefined outside any correlation context', () => {
    expect(getCorrelationId()).toBeUndefined();
  });
});

describe('runWithCorrelation', () => {
  it('should make correlationId available inside the callback', () => {
    runWithCorrelation('test-id-123', () => {
      expect(getCorrelationId()).toBe('test-id-123');
    });
  });

  it('should restore undefined after callback completes', () => {
    runWithCorrelation('temp-id', () => {
      // inside → has id
    });
    expect(getCorrelationId()).toBeUndefined();
  });

  it('should support nested contexts with isolation', () => {
    runWithCorrelation('outer', () => {
      expect(getCorrelationId()).toBe('outer');

      runWithCorrelation('inner', () => {
        expect(getCorrelationId()).toBe('inner');
      });

      // After inner exits, outer is restored
      expect(getCorrelationId()).toBe('outer');
    });
  });

  it('should propagate through async code', async () => {
    await runWithCorrelation('async-id', async () => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(getCorrelationId()).toBe('async-id');
    });
  });

  it('should return the callback return value', () => {
    const result = runWithCorrelation('id', () => 42);
    expect(result).toBe(42);
  });
});

describe('CorrelationMiddleware', () => {
  let middleware: CorrelationMiddleware;

  beforeEach(() => {
    middleware = new CorrelationMiddleware();
  });

  it('should use incoming correlation header if present', (done) => {
    const req = { headers: { [CORRELATION_HEADER]: 'incoming-id' } };
    const res = { setHeader: jest.fn() };

    middleware.use(req, res, () => {
      expect(getCorrelationId()).toBe('incoming-id');
      expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_HEADER, 'incoming-id');
      done();
    });
  });

  it('should generate a UUID if no correlation header', (done) => {
    const req = { headers: {} };
    const res = { setHeader: jest.fn() };

    middleware.use(req, res, () => {
      const id = getCorrelationId();
      expect(id).toBeDefined();
      // UUID v4 format check
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_HEADER, id);
      done();
    });
  });

  it('should generate a UUID if header is empty string', (done) => {
    const req = { headers: { [CORRELATION_HEADER]: '' } };
    const res = { setHeader: jest.fn() };

    middleware.use(req, res, () => {
      const id = getCorrelationId();
      expect(id).toBeDefined();
      expect(id).not.toBe('');
      done();
    });
  });

  it('should handle missing res.setHeader gracefully', (done) => {
    const req = { headers: {} };
    const res = {}; // no setHeader method

    // Should not throw
    middleware.use(req, res, () => {
      expect(getCorrelationId()).toBeDefined();
      done();
    });
  });
});
