/**
 * Rate Limiter & Exponential Backoff for BML Connection Polling
 * Strictly guarantees that Bank of Maldives servers are NEVER hammered,
 * applying rate protection, exponential backoff on transient errors, and immediate
 * suspension when session expiration or reauth is required.
 */

export interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitter: boolean;
  maxRetries: number;
}

const DEFAULT_CONFIG: BackoffConfig = {
  initialDelayMs: 2000,
  maxDelayMs: 60000,
  multiplier: 2.0,
  jitter: true,
  maxRetries: 4,
};

export class ConnectionRateLimiter {
  private consecutiveFailures = 0;
  private lastRequestTime = 0;
  private minIntervalMs: number;
  private config: BackoffConfig;
  private backoffUntil: number = 0;

  constructor(minIntervalSeconds: number = 60, config: Partial<BackoffConfig> = {}) {
    this.minIntervalMs = Math.max(minIntervalSeconds * 1000, 10000); // Minimum 10 seconds safety floor
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public setMinIntervalSeconds(seconds: number) {
    this.minIntervalMs = Math.max(seconds * 1000, 10000);
  }

  public getMinIntervalSeconds(): number {
    return Math.round(this.minIntervalMs / 1000);
  }

  /**
   * Checks whether a request can be executed right now according to rate-limits and backoff.
   */
  public canExecute(): { allowed: boolean; waitMs: number; reason?: string } {
    const now = Date.now();

    // Check if in backoff cooldown
    if (now < this.backoffUntil) {
      const waitMs = this.backoffUntil - now;
      return {
        allowed: false,
        waitMs,
        reason: `In backoff cooldown after ${this.consecutiveFailures} failures. Please wait ${Math.ceil(waitMs / 1000)}s.`,
      };
    }

    // Check min interval between requests
    const timeSinceLast = now - this.lastRequestTime;
    if (this.lastRequestTime > 0 && timeSinceLast < this.minIntervalMs) {
      const waitMs = this.minIntervalMs - timeSinceLast;
      return {
        allowed: false,
        waitMs,
        reason: `Rate limit protection active. Next check allowed in ${Math.ceil(waitMs / 1000)}s.`,
      };
    }

    return { allowed: true, waitMs: 0 };
  }

  public recordSuccess() {
    this.consecutiveFailures = 0;
    this.backoffUntil = 0;
    this.lastRequestTime = Date.now();
  }

  public recordFailure(isAuthFailure: boolean = false): number {
    this.consecutiveFailures++;
    this.lastRequestTime = Date.now();

    if (isAuthFailure) {
      // Re-authentication needed; do not attempt automatic retries
      this.backoffUntil = Date.now() + 86400000; // Suspend until user re-authenticates
      return 0;
    }

    // Exponential backoff
    const delay = Math.min(
      this.config.initialDelayMs * Math.pow(this.config.multiplier, this.consecutiveFailures - 1),
      this.config.maxDelayMs
    );

    // Optional randomized jitter between 0% and 30%
    const jitterFactor = this.config.jitter ? 1 + Math.random() * 0.3 : 1;
    const computedDelay = Math.round(delay * jitterFactor);

    this.backoffUntil = Date.now() + computedDelay;
    return computedDelay;
  }

  public reset() {
    this.consecutiveFailures = 0;
    this.backoffUntil = 0;
    this.lastRequestTime = 0;
  }

  public getFailureCount(): number {
    return this.consecutiveFailures;
  }
}
