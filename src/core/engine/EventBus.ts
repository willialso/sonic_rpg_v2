type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler<unknown>>>();

  emit<T>(eventName: string, payload: T): void {
    const set = this.handlers.get(eventName);
    if (!set) return;
    set.forEach((handler) => {
      (handler as Handler<T>)(payload);
    });
  }

  on<T>(eventName: string, handler: Handler<T>): () => void {
    const set = this.handlers.get(eventName) ?? new Set<Handler<unknown>>();
    set.add(handler as Handler<unknown>);
    this.handlers.set(eventName, set);
    return () => {
      const existing = this.handlers.get(eventName);
      if (!existing) return;
      existing.delete(handler as Handler<unknown>);
      if (existing.size === 0) this.handlers.delete(eventName);
    };
  }
}
