/** A per-window save queue. Flushing waits for local work without writing a
 * cached snapshot back over changes made by another window. */
export class PersistenceQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private error: Error | null = null;

  enqueue(work: () => Promise<void>): Promise<void> {
    this.pending += 1;
    const write = this.tail.then(work);
    this.tail = write.then(
      () => { this.error = null; this.pending -= 1; },
      (cause: unknown) => {
        this.error = cause instanceof Error ? cause : new Error(String(cause));
        this.pending -= 1;
      },
    );
    return write;
  }

  get needsProtection(): boolean { return this.pending > 0 || this.error !== null; }

  async flush(): Promise<void> {
    // Include edits queued while an earlier save was still completing.
    let observed: Promise<void>;
    do { observed = this.tail; await observed; } while (observed !== this.tail);
    if (this.error) throw this.error;
  }
}
