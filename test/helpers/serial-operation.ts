// Test-only guard: a runner timeout does not cancel an async test body.
// Drain it before touching shared fixtures; quarantine the fixture if it will not drain.
export class SerialOperation {
  private active: Promise<unknown> | undefined;
  private poisoned = false;
  assertHealthy() { if (this.poisoned) throw new Error('Fixture quarantined after drain timeout'); }
  run<T>(operation: () => Promise<T>): Promise<T> {
    this.assertHealthy();
    if (this.active) throw new Error('Previous fixture operation is still active');
    const promise = Promise.resolve().then(operation);
    this.active = promise;
    void promise.then(() => { this.active = undefined; }, () => { this.active = undefined; });
    return promise;
  }
  async drain(timeoutMs = 10000): Promise<void> {
    this.assertHealthy();
    if (!this.active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.active.catch(() => undefined), // The original test owns its assertion failure.
        new Promise<never>((_, reject) => { timer = setTimeout(() => {
          this.poisoned = true;
          reject(new Error('Fixture operation did not drain; refusing further fixture work'));
        }, timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
  }
}
