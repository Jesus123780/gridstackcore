/**
 * Core type definitions for the GridEngine.
 * ZERO React dependency — these types are pure TypeScript.
 */

/**
 * Represents a single item's position and size within the grid.
 *
 * Invariants:
 * - x >= 0, y >= 0
 * - w >= 1, h >= 1
 * - x + w <= cols (enforced by GridEngine)
 * - All `i` values are unique within a layout
 */
export interface GridPosition {
  /** Unique identifier for the grid item */
  i: string;
  /** Column index (0-based, integer >= 0) */
  x: number;
  /** Row index (0-based, integer >= 0) */
  y: number;
  /** Width in columns (integer >= 1) */
  w: number;
  /** Height in rows (integer >= 1) */
  h: number;
  /** If true, the item cannot be moved or displaced */
  static?: boolean;
}

/**
 * Configuration for the GridEngine instance.
 */
export interface GridEngineConfig {
  /** Number of columns in the grid. Default 12, range 1-48. */
  cols?: number;
  /** Height of each row in pixels. Default 60, range 1-1000. */
  rowHeight?: number;
  /** Margins as [horizontal, vertical] in pixels. Default [10, 10]. */
  margin?: [number, number];
  /** Collision resolution strategy. Default 'push'. */
  collisionMode?: 'push' | 'swap' | 'push-first' | 'none';
  /** Maximum depth for reflow propagation. Default 8, range 1-50. */
  maxReflowDepth?: number;
}

/**
 * Callback type for layout subscriptions on the GridEngine.
 */
export type LayoutSubscriber = (layout: GridPosition[]) => void;

/**
 * State held by the ExternalStore.
 */
export interface StoreState {
  /** The committed (finalized) layout positions */
  committedLayout: GridPosition[];
  /** Transient interaction state, null when no interaction is active */
  interactionState: InteractionState | null;
}

/**
 * Transient state during drag or resize interactions.
 * Exists only for the duration of the interaction.
 */
export interface InteractionState {
  /** Identifier of the item currently being interacted with */
  activeItemId: string;
  /** Type of interaction */
  type: 'drag' | 'resize';
  /** Speculative preview positions (for visual feedback during drag) */
  previewPositions: GridPosition[] | null;
  /** Offset of the pointer relative to the item's origin */
  pointerOffset: { x: number; y: number };
}

/**
 * Pixel-level helpers derived from the GridEngine configuration.
 * Used to convert between grid units and pixel coordinates.
 */
export interface PxHelpers {
  /** Width of a single column in pixels */
  colWidth: number;
  /** Height of a single row in pixels */
  rowHeight: number;
  /** Horizontal margin in pixels */
  marginX: number;
  /** Vertical margin in pixels */
  marginY: number;
  /** Container padding as [horizontal, vertical] */
  containerPadding: [number, number];
  /** Convert a grid position to pixel value */
  gridToPx(pos: number, isVertical?: boolean): number;
  /** Convert a pixel value to grid position */
  pxToGrid(px: number, isVertical?: boolean): number;
  /** Get pixel width for a given column span */
  widthPx(w: number): number;
  /** Get pixel height for a given row span */
  heightPx(h: number): number;
}

/**
 * Generic selector type for the ExternalStore.
 */
export type Selector<T> = (state: StoreState) => T;

/**
 * Generic subscriber type (no-argument callback).
 */
export type Subscriber = () => void;
