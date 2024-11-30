export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly threshold: number;
  private readonly timeout: number;

  constructor(threshold: number, timeout: number) {
    this.threshold = threshold;
    this.timeout = timeout;
  }

  public async execute<T>(
    action: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    if (this.isOpen()) {
      return fallback();
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      return fallback();
    }
  }

  private isOpen(): boolean {
    if (this.state === 'CLOSED') {
      return false;
    }

    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.timeout) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }

    return false;
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  public getState(): string {
    return this.state;
  }

  public reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
}
