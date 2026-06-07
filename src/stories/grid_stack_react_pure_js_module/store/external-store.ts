/**
 * GridExternalStore — Framework-agnostic state container.
 * NO React imports allowed in this module.
 *
 * Holds committed layout positions and transient interaction state,
 * with independent subscription channels and per-item selectors.
 * Compatible with React's useSyncExternalStore.
 */

import type { GridPosition, InteractionState, Subscriber } from '../engine/types';

export class GridExternalStore {
  /** The committed layout array — same reference between commits. */
  private committedLayout: GridPosition[] = [];

  /** Per-item snapshot cache for referential stability. */
  private itemSnapshotCache: Map<string, GridPosition> = new Map();

  /** Subscribers to the committed layout channel. */
  private readonly committedSubscribers: Set<Subscriber> = new Set();

  /** Subscribers to the interaction state channel. */
  private readonly interactionSubscribers: Set<Subscriber> = new Set();

  /** Per-item subscribers. */
  private readonly itemSubscribers: Map<string, Set<Subscriber>> = new Map();

  /** Transient interaction state. */
  private interactionState: InteractionState | null = null;

  /** Whether we are currently inside a batch(fn) call. */
  private batching = false;

  /** Accumulated notification flags during a batch. */
  private pendingCommittedNotify = false;
  private pendingInteractionNotify = false;
  private readonly pendingItemNotifyIds: Set<string> = new Set();

  // ─── Committed Layout Channel ─────────────────────────────────────────

  /**
   * Subscribe to the committed layout channel.
   * The callback is invoked (with no arguments) whenever a new layout is committed.
   * Returns an unsubscribe function.
   */
  subscribeCommitted(callback: Subscriber): () => void {
    this.committedSubscribers.add(callback);
    return () => {
      this.committedSubscribers.delete(callback);
    };
  }

  /**
   * Returns the current committed layout snapshot.
   * Returns the same array reference between commits (referential stability).
   */
  getCommittedSnapshot(): GridPosition[] {
    return this.committedLayout;
  }

  // ─── Interaction State Channel ────────────────────────────────────────

  /**
   * Subscribe to interaction state changes.
   * Returns an unsubscribe function.
   */
  subscribeInteraction(callback: Subscriber): () => void {
    this.interactionSubscribers.add(callback);
    return () => {
      this.interactionSubscribers.delete(callback);
    };
  }

  /**
   * Returns the current interaction state snapshot, or null when idle.
   */
  getInteractionSnapshot(): InteractionState | null {
    return this.interactionState;
  }

  // ─── Per-Item Selectors ───────────────────────────────────────────────

  /**
   * Returns the position object for a given item id from the committed layout.
   * Returns the same object reference if the item hasn't changed (referential stability).
   * Returns null for non-existent ids without throwing.
   */
  getItemPosition(id: string): GridPosition | null {
    return this.itemSnapshotCache.get(id) ?? null;
  }

  /**
   * Subscribe to changes for a specific item by id.
   * The callback is invoked when that item's position changes.
   * Returns an unsubscribe function.
   */
  subscribeItem(id: string, callback: Subscriber): () => void {
    let subscribers = this.itemSubscribers.get(id);
    if (!subscribers) {
      subscribers = new Set();
      this.itemSubscribers.set(id, subscribers);
    }
    subscribers.add(callback);

    return () => {
      const subs = this.itemSubscribers.get(id);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.itemSubscribers.delete(id);
        }
      }
    };
  }

  /**
   * Returns the snapshot for a given item id.
   * Alias for getItemPosition — same referential stability guarantees.
   * Returns null for non-existent ids without throwing.
   */
  getItemSnapshot(id: string): GridPosition | null {
    return this.itemSnapshotCache.get(id) ?? null;
  }

  // ─── Mutations ────────────────────────────────────────────────────────

  /**
   * Commit a new layout to the store.
   * - Creates defensive copies of each item (external mutations don't affect internal state)
   * - Preserves referential stability: unchanged items keep the same object reference
   * - Notifies committed-channel subscribers and per-item subscribers for changed items
   * - When batching is active, defers notifications until the batch completes
   */
  commitLayout(layout: GridPosition[]): void {
    const newCache = new Map<string, GridPosition>();
    const changedIds: string[] = [];

    for (const item of layout) {
      const existing = this.itemSnapshotCache.get(item.i);

      if (existing && this.positionsEqual(existing, item)) {
        // Item unchanged — reuse same reference for referential stability
        newCache.set(item.i, existing);
      } else {
        // Item changed or new — create a frozen defensive copy
        const snapshot = Object.freeze({ ...item });
        newCache.set(item.i, snapshot);
        changedIds.push(item.i);
      }
    }

    // Detect removed items (present in old cache but not in new layout)
    this.itemSnapshotCache.forEach((_value, oldId) => {
      if (!newCache.has(oldId)) {
        changedIds.push(oldId);
      }
    });

    // Update internal state
    this.itemSnapshotCache = newCache;

    // Build the committed layout as a frozen array of the cached snapshots
    this.committedLayout = Object.freeze(
      layout.map((item) => newCache.get(item.i)!),
    ) as GridPosition[];

    if (this.batching) {
      // Defer notifications — accumulate flags
      this.pendingCommittedNotify = true;
      for (const id of changedIds) {
        this.pendingItemNotifyIds.add(id);
      }
    } else {
      // Notify immediately
      this.notifyCommittedSubscribers();
      for (const id of changedIds) {
        this.notifyItemSubscribers(id);
      }
    }
  }

  /**
   * Set the transient interaction state.
   * Notifies ONLY interaction-channel subscribers — never committed subscribers.
   * When batching is active, defers notification until the batch completes.
   */
  setInteractionState(state: InteractionState | null): void {
    this.interactionState = state;

    if (this.batching) {
      this.pendingInteractionNotify = true;
    } else {
      this.notifyInteractionSubscribers();
    }
  }

  /**
   * Group multiple mutations into a single notification batch.
   * During execution of `fn`, all subscriber notifications are deferred.
   * After `fn` returns, accumulated notifications fire exactly once per channel.
   */
  batch(fn: () => void): void {
    if (this.batching) {
      // Already inside a batch — just execute fn, notifications still deferred
      fn();
      return;
    }

    this.batching = true;
    this.pendingCommittedNotify = false;
    this.pendingInteractionNotify = false;
    this.pendingItemNotifyIds.clear();

    try {
      fn();
    } finally {
      this.batching = false;

      // Fire accumulated notifications once
      if (this.pendingCommittedNotify) {
        this.notifyCommittedSubscribers();
      }

      if (this.pendingInteractionNotify) {
        this.notifyInteractionSubscribers();
      }

      this.pendingItemNotifyIds.forEach((id) => {
        this.notifyItemSubscribers(id);
      });

      // Reset pending state
      this.pendingCommittedNotify = false;
      this.pendingInteractionNotify = false;
      this.pendingItemNotifyIds.clear();
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  /**
   * Compare two GridPosition objects for equality (shallow value comparison).
   */
  private positionsEqual(a: GridPosition, b: GridPosition): boolean {
    return (
      a.i === b.i &&
      a.x === b.x &&
      a.y === b.y &&
      a.w === b.w &&
      a.h === b.h &&
      a.static === b.static
    );
  }

  /**
   * Notify all committed-channel subscribers.
   * Subscriber errors are caught to prevent one bad subscriber from breaking others.
   */
  private notifyCommittedSubscribers(): void {
    this.committedSubscribers.forEach((subscriber) => {
      try {
        subscriber();
      } catch {
        // Subscriber errors are caught and silently swallowed
      }
    });
  }

  /**
   * Notify all interaction-channel subscribers.
   * Subscriber errors are caught to prevent one bad subscriber from breaking others.
   */
  private notifyInteractionSubscribers(): void {
    this.interactionSubscribers.forEach((subscriber) => {
      try {
        subscriber();
      } catch {
        // Subscriber errors are caught and silently swallowed
      }
    });
  }

  /**
   * Notify per-item subscribers for a specific item.
   * Subscriber errors are caught to prevent one bad subscriber from breaking others.
   */
  private notifyItemSubscribers(id: string): void {
    const subscribers = this.itemSubscribers.get(id);
    if (!subscribers) return;

    subscribers.forEach((subscriber) => {
      try {
        subscriber();
      } catch {
        // Subscriber errors are caught and silently swallowed
      }
    });
  }
}
