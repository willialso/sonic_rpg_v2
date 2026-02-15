import type { GameStateData } from "../../types/game";

type Subscriber = (state: GameStateData) => void;

export class GameState {
  private value: GameStateData;
  private subscribers: Set<Subscriber>;

  constructor(initial: GameStateData) {
    this.value = initial;
    this.subscribers = new Set();
  }

  get(): GameStateData {
    return this.value;
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.value);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  patch(mutator: (draft: GameStateData) => void): void {
    const cloned = structuredClone(this.value);
    mutator(cloned);
    this.value = cloned;
    this.subscribers.forEach((s) => s(this.value));
  }

  set(next: GameStateData): void {
    this.value = structuredClone(next);
    this.subscribers.forEach((s) => s(this.value));
  }
}
