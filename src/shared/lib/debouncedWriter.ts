/** Serialize writes and make close/blur able to await every pending edit. */
export function createDebouncedWriter<T>(write: (value: T) => Promise<void>, onError: (error: unknown) => void, delay = 350) {
  let pending: { value: T } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  const flush = async (): Promise<void> => {
    clearTimeout(timer);
    if (running) { await running; if (pending) await flush(); return; }
    if (!pending) return;
    const job = pending;
    pending = undefined;
    running = write(job.value).catch((error) => {
      pending ??= job;
      throw error;
    });
    try { await running; } finally { running = undefined; }
    if (pending) await flush();
  };
  return {
    schedule(value: T) {
      pending = { value };
      clearTimeout(timer);
      timer = setTimeout(() => { void flush().catch(onError); }, delay);
    },
    flush,
    get dirty() { return !!pending || !!running; },
    cancel() { clearTimeout(timer); pending = undefined; },
  };
}
