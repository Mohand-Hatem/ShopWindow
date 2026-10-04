import { TtlPolicyService, DEFAULT_JITTER_RATIO } from './ttl-policy.service';

describe('TtlPolicyService (Unit Tests)', () => {
  let service: TtlPolicyService;

  beforeEach(() => {
    service = new TtlPolicyService();
  });

  describe('applyJitter()', () => {
    it('should stay strictly within ±10% bounds for 300s TTL (detail cache)', () => {
      const baseTtl = 300;
      const minExpected = 270;
      const maxExpected = 330;
      const sampleSize = 1000;
      const results: number[] = [];

      for (let i = 0; i < sampleSize; i++) {
        const jittered = service.applyJitter(baseTtl, 0.1);
        expect(jittered).toBeGreaterThanOrEqual(minExpected);
        expect(jittered).toBeLessThanOrEqual(maxExpected);
        results.push(jittered);
      }

      // Verify non-zero variance (it is not returning a constant number)
      const uniqueValues = new Set(results);
      expect(uniqueValues.size).toBeGreaterThan(20);

      // Verify mean is centered near baseTtl
      const mean = results.reduce((acc, v) => acc + v, 0) / sampleSize;
      expect(mean).toBeGreaterThan(290);
      expect(mean).toBeLessThan(310);
    });

    it('should stay strictly within ±10% bounds for 120s TTL (list cache)', () => {
      const baseTtl = 120;
      const minExpected = 108;
      const maxExpected = 132;

      for (let i = 0; i < 500; i++) {
        const jittered = service.applyJitter(baseTtl, 0.1);
        expect(jittered).toBeGreaterThanOrEqual(minExpected);
        expect(jittered).toBeLessThanOrEqual(maxExpected);
      }
    });

    it('should stay strictly within ±10% bounds for 30s TTL (negative cache)', () => {
      const baseTtl = 30;
      const minExpected = 27;
      const maxExpected = 33;

      for (let i = 0; i < 200; i++) {
        const jittered = service.applyJitter(baseTtl, 0.1);
        expect(jittered).toBeGreaterThanOrEqual(minExpected);
        expect(jittered).toBeLessThanOrEqual(maxExpected);
      }
    });

    it('should use DEFAULT_JITTER_RATIO of 0.10 when omitted', () => {
      const baseTtl = 100;
      for (let i = 0; i < 100; i++) {
        const jittered = service.applyJitter(baseTtl);
        expect(jittered).toBeGreaterThanOrEqual(90);
        expect(jittered).toBeLessThanOrEqual(110);
      }
    });

    it('should handle non-positive TTLs safely', () => {
      expect(service.applyJitter(0)).toBe(0);
      expect(service.applyJitter(-10)).toBe(-10);
    });

    it('should return unjittered TTL when jitterRatio is 0 or negative', () => {
      expect(service.applyJitter(300, 0)).toBe(300);
      expect(service.applyJitter(300, -0.05)).toBe(300);
    });

    it('should provide getJitteredTtl alias matching applyJitter', () => {
      const val = service.getJitteredTtl(300, 0.1);
      expect(val).toBeGreaterThanOrEqual(270);
      expect(val).toBeLessThanOrEqual(330);
    });
  });
});
