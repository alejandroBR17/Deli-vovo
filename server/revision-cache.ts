// Validate a single revision on every read. Only the complete payload is cached,
// so a second server sees a committed change without waiting for a local TTL.
export class RevisionCache<T> {
  private cached?: {revision: number; value: T};
  private pending?: {revision: number; generation: number; promise: Promise<T>};
  private generation = 0;
  constructor(private revision: () => Promise<number>, private load: () => Promise<T>) {}

  async read(): Promise<T> {
    const generation = this.generation;
    const revision = await this.revision();
    if (generation !== this.generation) return this.read();
    if (this.cached?.revision === revision) return this.cached.value;
    if (this.pending?.revision === revision && this.pending.generation === generation) return this.pending.promise;
    const pending = {revision, generation, promise: undefined as unknown as Promise<T>};
    pending.promise = this.load().then(value => {
      if (this.pending === pending && this.generation === generation) this.cached = {revision, value};
      return value;
    }).finally(() => { if (this.pending === pending) this.pending = undefined; });
    this.pending = pending;
    return pending.promise;
  }

  invalidate() {
    this.generation++;
    this.cached = undefined;
    this.pending = undefined;
  }
}
