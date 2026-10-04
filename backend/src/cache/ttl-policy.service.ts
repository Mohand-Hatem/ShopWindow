import { Injectable } from '@nestjs/common';

export const DEFAULT_JITTER_RATIO = 0.1; // ±10% variation

@Injectable()
export class TtlPolicyService {
  /**
   * Applies bounded random jitter to a base TTL in seconds.
   * Prevents Cache Avalanches by spreading key expirations across time.
   *
   * Formula:
   *   delta = Math.round(baseTtl * jitterRatio)
   *   min = Math.max(1, baseTtl - delta)
   *   max = baseTtl + delta
   *   return Math.floor(min + Math.random() * (max - min + 1))
   *
   * Example:
   *   applyJitter(300, 0.1) -> returns integer in [270, 330]
   */
  applyJitter(baseTtl: number, jitterRatio: number = DEFAULT_JITTER_RATIO): number {
    if (baseTtl <= 0) {
      return baseTtl;
    }

    if (jitterRatio <= 0) {
      return baseTtl;
    }

    const delta = Math.round(baseTtl * jitterRatio);
    const min = Math.max(1, baseTtl - delta);
    const max = baseTtl + delta;

    return Math.floor(min + Math.random() * (max - min + 1));
  }

  /**
   * Convenience alias for getJitteredTtl matching Master Plan naming.
   */
  getJitteredTtl(baseTtl: number, jitterRatio: number = DEFAULT_JITTER_RATIO): number {
    return this.applyJitter(baseTtl, jitterRatio);
  }
}
