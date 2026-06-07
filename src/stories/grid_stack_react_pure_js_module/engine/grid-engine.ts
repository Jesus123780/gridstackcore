/**
 * GridEngine — Pure TypeScript layout computation engine.
 * NO React imports allowed in this module or its dependency graph.
 *
 * Handles: layout state, collision detection, placement search,
 * compaction, reflow, and subscription notifications.
 */

import type { GridPosition, GridEngineConfig, LayoutSubscriber } from './types';

/** Resolved configuration with all required fields populated. */
type ResolvedConfig = Readonly<Required<GridEngineConfig>>;

const DEFAULT_CONFIG: ResolvedConfig = {
  cols: 12,
  rowHeight: 60,
  margin: [10, 10] as [number, number],
  collisionMode: 'push',
  maxReflowDepth: 8,
};

/** Clamp a number between min and max inclusive. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class GridEngine {
  private readonly config: ResolvedConfig;
  private layout: GridPosition[] = [];
  private readonly subscribers: Set<LayoutSubscriber> = new Set();

  constructor(userConfig: GridEngineConfig = {}) {
    const cols = Number.isFinite(userConfig.cols)
      ? clamp(userConfig.cols!, 1, 48)
      : DEFAULT_CONFIG.cols;

    const rowHeight = Number.isFinite(userConfig.rowHeight)
      ? clamp(userConfig.rowHeight!, 1, 1000)
      : DEFAULT_CONFIG.rowHeight;

    const margin: [number, number] =
      Array.isArray(userConfig.margin) && userConfig.margin.length === 2
        ? [userConfig.margin[0], userConfig.margin[1]]
        : [...DEFAULT_CONFIG.margin];

    const collisionMode =
      userConfig.collisionMode &&
      ['push', 'swap', 'push-first', 'none'].includes(userConfig.collisionMode)
        ? userConfig.collisionMode
        : DEFAULT_CONFIG.collisionMode;

    const maxReflowDepth = Number.isFinite(userConfig.maxReflowDepth)
      ? clamp(userConfig.maxReflowDepth!, 1, 50)
      : DEFAULT_CONFIG.maxReflowDepth;

    this.config = Object.freeze({
      cols,
      rowHeight,
      margin,
      collisionMode,
      maxReflowDepth,
    });
  }

  /** Returns a defensive copy of the current layout. */
  getLayout(): GridPosition[] {
    return this.layout.map((item) => ({ ...item }));
  }

  /** Returns the resolved (frozen) engine configuration. */
  getConfig(): ResolvedConfig {
    return this.config;
  }

  /**
   * Replaces the current layout with the provided one and notifies subscribers.
   * Stores a defensive copy so external mutations don't affect internal state.
   */
  setLayout(layout: GridPosition[]): void {
    this.layout = layout.map((item) => ({ ...item }));
    this.notifySubscribers();
  }

  /**
   * Register a subscriber callback that is invoked on every layout mutation.
   * Returns an unsubscribe function.
   */
  subscribe(callback: LayoutSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // --- Mutations (Task 2.2) ---

  /**
   * Move an item to a new (x, y) position.
   * Clamps to grid bounds, resolves collisions, compacts, and notifies subscribers.
   */
  moveItem(id: string, x: number, y: number): GridPosition[] {
    const itemIndex = this.layout.findIndex((item) => item.i === id);
    if (itemIndex === -1) {
      // Item not found — return current layout without notifying
      return this.getLayout();
    }

    const item = this.layout[itemIndex];

    // Static items cannot be moved
    if (item.static) {
      return this.getLayout();
    }

    // Build the moved item with new position
    const movedItem: GridPosition = {
      ...item,
      x,
      y,
    };

    // Clamp to valid bounds
    const clampedItem = this.clampToBounds(movedItem);

    // Build layout with the moved item replaced
    const layoutWithoutItem = this.layout.filter((_, idx) => idx !== itemIndex);
    const updatedLayout = [...layoutWithoutItem, clampedItem];

    // Resolve collisions and compact
    const resolvedLayout = this.resolveCollisions(updatedLayout, clampedItem);
    const compactedLayout = this.compact(resolvedLayout);

    // Store and notify
    this.layout = compactedLayout;
    this.notifySubscribers();
    return this.getLayout();
  }

  /**
   * Resize an item to new (w, h) dimensions.
   * Clamps to valid bounds (w>=1, h>=1, x+w<=cols), resolves collisions, compacts, and notifies subscribers.
   */
  resizeItem(id: string, w: number, h: number): GridPosition[] {
    const itemIndex = this.layout.findIndex((item) => item.i === id);
    if (itemIndex === -1) {
      // Item not found — return current layout without notifying
      return this.getLayout();
    }

    const item = this.layout[itemIndex];

    // Static items cannot be resized
    if (item.static) {
      return this.getLayout();
    }

    // Build the resized item
    const resizedItem: GridPosition = {
      ...item,
      w: Math.max(1, w),
      h: Math.max(1, h),
    };

    // Clamp to valid bounds
    const clampedItem = this.clampToBounds(resizedItem);

    // Build layout with the resized item replaced
    const layoutWithoutItem = this.layout.filter((_, idx) => idx !== itemIndex);
    const updatedLayout = [...layoutWithoutItem, clampedItem];

    // Resolve collisions and compact
    const resolvedLayout = this.resolveCollisions(updatedLayout, clampedItem);
    const compactedLayout = this.compact(resolvedLayout);

    // Store and notify
    this.layout = compactedLayout;
    this.notifySubscribers();
    return this.getLayout();
  }

  /**
   * Add a new item to the grid.
   * Clamps to bounds, attempts placement search if overlapping, resolves collisions,
   * compacts, and notifies subscribers.
   * Returns null if placement is impossible.
   */
  addItem(item: GridPosition): GridPosition[] | null {
    // Check if the original requested width exceeds grid columns (impossible to place)
    if (item.w > this.config.cols) {
      return null;
    }

    // Clamp the item to valid bounds
    const clampedItem = this.clampToBounds({ ...item });

    // Attempt to find a valid placement
    const placedItem = this.findPlacement(clampedItem, this.layout);
    if (placedItem === null) {
      // Cannot place the item — return null without modifying layout
      return null;
    }

    // Build layout with the new item added
    const updatedLayout = [...this.layout, placedItem];

    // Resolve collisions and compact
    const resolvedLayout = this.resolveCollisions(updatedLayout, placedItem);
    const compactedLayout = this.compact(resolvedLayout);

    // Store and notify
    this.layout = compactedLayout;
    this.notifySubscribers();
    return this.getLayout();
  }

  /**
   * Remove an item from the grid by id.
   * Returns null if the item is not found. Otherwise compacts remaining items,
   * stores the new layout, notifies subscribers, and returns the new layout.
   */
  removeItem(id: string): GridPosition[] | null {
    const itemIndex = this.layout.findIndex((item) => item.i === id);
    if (itemIndex === -1) {
      // Item not found — return null without notifying
      return null;
    }

    // Remove the item
    const layoutWithoutItem = this.layout.filter((_, idx) => idx !== itemIndex);

    // Compact remaining items
    const compactedLayout = this.compact(layoutWithoutItem);

    // Store and notify
    this.layout = compactedLayout;
    this.notifySubscribers();
    return this.getLayout();
  }

  // --- Private helpers (Task 2.3) ---

  /**
   * Clamp an item's position and size to valid grid bounds.
   * Ensures: x >= 0, y >= 0, w >= 1, h >= 1, x + w <= cols.
   */
  private clampToBounds(item: GridPosition): GridPosition {
    // Enforce minimum dimensions first
    const w = clamp(Math.round(item.w), 1, this.config.cols);
    const h = Math.max(1, Math.round(item.h));

    // Clamp position to keep item within grid
    const x = clamp(Math.round(item.x), 0, this.config.cols - w);
    const y = Math.max(0, Math.round(item.y));

    return { ...item, x, y, w, h };
  }

  /**
   * Resolve collisions in the layout after an item has been moved or resized.
   * Supports four modes: push, swap, push-first, none.
   * Bounded to O(n * maxReflowDepth) total iterations to prevent infinite loops.
   */
  private resolveCollisions(
    layout: GridPosition[],
    movedItem: GridPosition,
  ): GridPosition[] {
    const mode = this.config.collisionMode;

    if (mode === 'none') {
      return layout;
    }

    if (mode === 'swap') {
      return this.resolveSwap(layout, movedItem);
    }

    if (mode === 'push-first') {
      return this.resolvePushFirst(layout, movedItem);
    }

    // Default: 'push' mode
    return this.resolvePush(layout, movedItem);
  }

  /**
   * Push mode: push colliding items downward recursively until no overlaps remain.
   * Bounded to n * maxReflowDepth iterations.
   */
  private resolvePush(
    layout: GridPosition[],
    movedItem: GridPosition,
  ): GridPosition[] {
    const maxIterations = layout.length * this.config.maxReflowDepth;
    let iterations = 0;
    const result = layout.map((item) => ({ ...item }));

    // Process collisions iteratively using a queue
    const queue: string[] = [movedItem.i];
    const processed = new Set<string>();

    while (queue.length > 0 && iterations < maxIterations) {
      const currentId = queue.shift()!;
      if (processed.has(currentId)) {
        iterations++;
        continue;
      }
      processed.add(currentId);
      iterations++;

      const current = result.find((item) => item.i === currentId);
      if (!current) continue;

      for (let i = 0; i < result.length; i++) {
        if (result[i].i === current.i) continue;
        if (result[i].static) continue;

        if (this.itemsOverlap(current, result[i])) {
          iterations++;
          if (iterations > maxIterations) break;

          // Push the colliding item below the current item
          result[i] = { ...result[i], y: current.y + current.h };
          queue.push(result[i].i);
        }
      }
    }

    return result;
  }

  /**
   * Swap mode: swap positions between the moved item and the first
   * colliding non-static item. Only one swap occurs.
   */
  private resolveSwap(
    layout: GridPosition[],
    movedItem: GridPosition,
  ): GridPosition[] {
    const result = layout.map((item) => ({ ...item }));
    const movedIdx = result.findIndex((item) => item.i === movedItem.i);
    if (movedIdx === -1) return result;

    for (let i = 0; i < result.length; i++) {
      if (i === movedIdx) continue;
      if (result[i].static) continue;

      if (this.itemsOverlap(result[movedIdx], result[i])) {
        // Save the colliding item's position
        const otherX = result[i].x;
        const otherY = result[i].y;

        // Move the colliding item to where the moved item currently is
        // (the moved item already has its new position set)
        // The swap means: other item goes to a position that avoids overlap.
        // Standard swap: other takes moved item's old position equivalent.
        // Since we don't track old position, place the other item at a y
        // below or swap x/y coordinates based on dimensions.
        result[i] = this.clampToBounds({
          ...result[i],
          x: movedItem.x,
          y: movedItem.y + movedItem.h,
        });

        // If items are same size, do a true position swap
        if (result[movedIdx].w === result[i].w && result[movedIdx].h === result[i].h) {
          result[i] = { ...result[i], x: otherX, y: otherY };
          // movedItem keeps its new position (already set)
        }

        break; // Only one swap per move
      }
    }

    return result;
  }

  /**
   * Push-first mode: try pushing colliding items sideways first (right, then left).
   * If lateral placement fails, fall back to pushing down (same as push mode).
   * Bounded to n * maxReflowDepth iterations.
   */
  private resolvePushFirst(
    layout: GridPosition[],
    movedItem: GridPosition,
  ): GridPosition[] {
    const maxIterations = layout.length * this.config.maxReflowDepth;
    let iterations = 0;
    const result = layout.map((item) => ({ ...item }));

    const queue: string[] = [movedItem.i];
    const processed = new Set<string>();

    while (queue.length > 0 && iterations < maxIterations) {
      const currentId = queue.shift()!;
      if (processed.has(currentId)) {
        iterations++;
        continue;
      }
      processed.add(currentId);
      iterations++;

      const current = result.find((item) => item.i === currentId);
      if (!current) continue;

      for (let i = 0; i < result.length; i++) {
        if (result[i].i === current.i) continue;
        if (result[i].static) continue;

        if (this.itemsOverlap(current, result[i])) {
          iterations++;
          if (iterations > maxIterations) break;

          let resolved = false;

          // Try pushing right
          const rightX = current.x + current.w;
          if (rightX + result[i].w <= this.config.cols) {
            const candidate = { ...result[i], x: rightX };
            if (!this.hasCollisionExcluding(result, candidate, [current.i, candidate.i])) {
              result[i] = candidate;
              resolved = true;
            }
          }

          // Try pushing left
          if (!resolved) {
            const leftX = current.x - result[i].w;
            if (leftX >= 0) {
              const candidate = { ...result[i], x: leftX };
              if (!this.hasCollisionExcluding(result, candidate, [current.i, candidate.i])) {
                result[i] = candidate;
                resolved = true;
              }
            }
          }

          // Fallback: push down (same as push mode)
          if (!resolved) {
            result[i] = { ...result[i], y: current.y + current.h };
            queue.push(result[i].i);
          }
        }
      }
    }

    return result;
  }

  /**
   * Vertical compaction: moves items upward to fill gaps (gravity effect).
   * Items are sorted by y then x, and each is moved to the highest
   * possible y that doesn't overlap another already-compacted item.
   * Static items are not moved.
   */
  private compact(layout: GridPosition[]): GridPosition[] {
    if (layout.length === 0) return [];

    // Sort by y (top to bottom), then x (left to right)
    const sorted = [...layout].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    const compacted: GridPosition[] = [];

    for (const item of sorted) {
      if (item.static) {
        compacted.push({ ...item });
        continue;
      }

      const compactedItem = { ...item };

      // Try to move the item as high as possible
      let bestY = 0;
      while (bestY < compactedItem.y) {
        const candidate = { ...compactedItem, y: bestY };
        const hasCollision = compacted.some((placed) =>
          this.itemsOverlap(candidate, placed),
        );
        if (!hasCollision) {
          // Found a valid higher position
          compactedItem.y = bestY;
          break;
        }
        bestY++;
      }

      // If bestY reached the original y, check if the original position
      // collides with already-compacted items and push down if needed
      if (bestY >= compactedItem.y) {
        while (
          compacted.some((placed) => this.itemsOverlap(compactedItem, placed))
        ) {
          compactedItem.y++;
        }
      }

      compacted.push(compactedItem);
    }

    // Restore original order by matching item ids
    return layout.map((original) => {
      const found = compacted.find((c) => c.i === original.i);
      return found ? found : { ...original };
    });
  }

  /**
   * Find a valid placement for an item in the layout.
   * First tries the item's requested position; if that overlaps,
   * scans row by row (top-left to bottom-right) for the first
   * position where the item fits without overlapping existing items.
   * Returns the placed item with valid coordinates, or null if no fit exists.
   */
  private findPlacement(
    item: GridPosition,
    layout: GridPosition[],
  ): GridPosition | null {
    const cols = this.config.cols;

    // If item width exceeds cols, impossible to place
    if (item.w > cols) {
      return null;
    }

    // First try the item's requested position
    if (!this.hasCollisionWith(layout, item)) {
      return item;
    }

    // Scan for first available position (row by row, column by column)
    // Limit scan to a reasonable area: existing max y + item height + buffer
    const maxY = layout.reduce((max, it) => Math.max(max, it.y + it.h), 0);
    const scanLimit = maxY + item.h + 10;

    for (let y = 0; y <= scanLimit; y++) {
      for (let x = 0; x <= cols - item.w; x++) {
        const candidate: GridPosition = { ...item, x, y };
        if (!this.hasCollisionWith(layout, candidate)) {
          return candidate;
        }
      }
    }

    // No valid placement found
    return null;
  }

  // --- Collision detection utilities ---

  /** Check if two items overlap (axis-aligned bounding box intersection). */
  private itemsOverlap(a: GridPosition, b: GridPosition): boolean {
    if (a.i === b.i) return false; // same item doesn't overlap with itself
    return !(
      a.x >= b.x + b.w ||
      a.x + a.w <= b.x ||
      a.y >= b.y + b.h ||
      a.y + a.h <= b.y
    );
  }

  /** Check if an item collides with any item in the layout. */
  private hasCollisionWith(
    layout: GridPosition[],
    item: GridPosition,
  ): boolean {
    return layout.some((other) => this.itemsOverlap(item, other));
  }

  /**
   * Check if an item collides with any item in the layout,
   * excluding items whose ids are in the exclusion list.
   */
  private hasCollisionExcluding(
    layout: GridPosition[],
    item: GridPosition,
    excludeIds: string[],
  ): boolean {
    return layout.some(
      (other) => !excludeIds.includes(other.i) && this.itemsOverlap(item, other),
    );
  }

  /** Notify all current subscribers with a defensive copy of the layout. */
  private notifySubscribers(): void {
    const snapshot = this.getLayout();
    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(snapshot);
      } catch {
        // Subscriber errors are caught and silently swallowed to
        // prevent one bad subscriber from breaking others.
      }
    });
  }
}
