import { describe, expect, it, vi } from "vitest";
import { PersistenceQueue } from "../src/lib/persistenceQueue";

describe("per-window persistence flush", () => {
  it("never rewrites a cached snapshot when an idle window prepares to update", async () => {
    const queue = new PersistenceQueue();
    const write = vi.fn(async () => undefined);
    await queue.enqueue(write);
    await queue.flush(); await queue.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(queue.needsProtection).toBe(false);
  });

  it("waits for edits queued while a save is in flight", async () => {
    const queue = new PersistenceQueue();
    let release!: () => void;
    const first = queue.enqueue(() => new Promise<void>(resolve => { release = resolve; }));
    await Promise.resolve();
    expect(queue.needsProtection).toBe(true);
    const flushed = vi.fn();
    const flush = queue.flush().then(flushed);
    let releaseSecond!: () => void;
    const second = queue.enqueue(() => new Promise<void>(resolve => { releaseSecond = resolve; }));
    release(); await first; await Promise.resolve();
    expect(flushed).not.toHaveBeenCalled();
    releaseSecond(); await second; await flush;
    expect(flushed).toHaveBeenCalledTimes(1);
    expect(queue.needsProtection).toBe(false);
  });

  it("blocks a reload after a failed write until an explicit successful retry", async () => {
    const queue = new PersistenceQueue();
    const quota = new Error("quota");
    await expect(queue.enqueue(async () => { throw quota; })).rejects.toBe(quota);
    expect(queue.needsProtection).toBe(true);
    await expect(queue.flush()).rejects.toBe(quota);
    await queue.enqueue(async () => undefined);
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(queue.needsProtection).toBe(false);
  });
});
