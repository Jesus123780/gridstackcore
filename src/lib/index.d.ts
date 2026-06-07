/**
 * gridstackcore — Type Declarations
 */
import React from 'react';

// ─── Grid Item ───────────────────────────────────────────────────────────────

export interface GridItem {
  title?: string;
  id?: string;
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
  component?: Record<string, any>;
}

// ─── Overlay ─────────────────────────────────────────────────────────────────

export interface Overlay {
  i: string;
  pxLeft: number;
  pxTop: number;
  widthPx?: number;
  heightPx?: number;
  committedLayout?: GridItem[];
  targetGrid: GridItem | null;
  fallback?: boolean;
  grabOffsetX?: number;
  grabOffsetY?: number;
  displacedIds?: string[];
}

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum overlayAnchorType {
  grab = 'grab',
  pointer = 'pointer',
  center = 'center',
}

export enum collisionModeType {
  push = 'push',
  swap = 'swap',
  'push-first' = 'push-first',
  none = 'none',
}

export enum dragModeType {
  preview = 'preview',
  overlay = 'overlay',
  real = 'real',
}

// ─── GridStack Props ─────────────────────────────────────────────────────────

export interface GridStackProps {
  items: GridItem[];
  cols?: number;
  rowHeight?: number;
  radio?: number;
  margin?: [number, number];
  containerPadding?: [number, number];
  isDraggable?: boolean;
  isResizable?: boolean;
  preventCollision?: boolean;
  onLayoutChange?: (layout: GridItem[]) => void;
  componentMap?: Record<string, React.ComponentType<any>>;
  dragMode?: dragModeType;
  collisionMode?: collisionModeType;
  animation?: { duration: number; easing: string };
  dragThrottleMs?: number;
  allowOverlapDuringDrag?: boolean;
  animateOnDrop?: boolean;
  overlayAnchor?: overlayAnchorType;
  snapEnabled?: boolean;
  snapThreshold?: number;
  showGrid?: boolean;
  enableRollOnPush?: boolean;
  rollAngleMax?: number;
  rollDuration?: number;
  rollStagger?: number;
  enableHitOnPush?: boolean;
  hitMultiplier?: number;
  hitDuration?: number;
  hitThresholdPx?: number;
  sticky?: boolean;
  dragOverlayOffset?: { x: number; y: number };
}

// ─── Style Result ────────────────────────────────────────────────────────────

export interface StyleResult {
  transform: string;
  width: string;
  height: string;
  transition?: string;
  borderRadius?: number;
  willChange?: string;
  transformOrigin?: string;
}

// ─── PxHelpers ───────────────────────────────────────────────────────────────

export interface PxHelpers {
  colWidth: number;
  rowHeight: number;
  marginX: number;
  marginY: number;
  containerPadding: [number, number];
  containerRect?: { left: number; top: number };
  gridToPx(pos: number, isVertical?: boolean): number;
  widthPx(w: number): number;
  heightPx(h: number): number;
}

// ─── UseGrid Options & Return ────────────────────────────────────────────────

export interface UseGridOptions {
  items?: GridItem[];
  cols?: number;
  preventCollision?: boolean;
  rowHeight?: number;
  collisionMode?: collisionModeType;
  dragThrottleMs?: number;
  onLayoutChange?: (layout: GridItem[]) => void;
  allowOverlapDuringDrag?: boolean;
  animateOnDrop?: boolean;
  collisionSolverOpts?: Record<string, unknown>;
  overlayAnchor?: overlayAnchorType;
  reflowDuringDrag?: boolean;
  reflowMaxDepth?: number;
  reflowSymmetry?: boolean;
  snapEnabled?: boolean;
  snapThreshold?: number;
  sticky?: boolean;
  margin?: [number, number];
  containerPadding?: [number, number];
  dragMode?: dragModeType;
  animation?: { duration?: number; easing?: string };
  dragOverlayOffset?: number | { x?: number; y?: number };
}

export interface DragStateType {
  pointerId: number;
  type: 'drag' | 'resize';
  itemId: string;
  orig: GridItem;
  pxHelpers: PxHelpers;
  containerRect: { left: number; top: number };
  grabOffsetX: number;
  grabOffsetY: number;
  corner: string;
  startClientX: number;
  startClientY: number;
}

export interface UseGridReturn {
  layout: GridItem[];
  overlay: Overlay | null;
  startDrag: (e: React.PointerEvent, node: GridItem, pxHelpers: PxHelpers) => void;
  startResize: (e: React.PointerEvent, node: GridItem, corner: string | undefined, pxHelpers: PxHelpers) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  endInteraction: (e: React.PointerEvent) => void;
  cancelInteraction: () => void;
  setLayout: (layout: GridItem[]) => void;
}

// ─── Engine Types ────────────────────────────────────────────────────────────

export interface GridPosition {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
}

export interface GridEngineConfig {
  cols?: number;
  rowHeight?: number;
  margin?: [number, number];
  collisionMode?: 'push' | 'swap' | 'push-first' | 'none';
  maxReflowDepth?: number;
}

export type LayoutSubscriber = (layout: GridPosition[]) => void;

export interface StoreState {
  committedLayout: GridPosition[];
  interactionState: InteractionState | null;
}

export interface InteractionState {
  activeItemId: string;
  type: 'drag' | 'resize';
  previewPositions: GridPosition[] | null;
  pointerOffset: { x: number; y: number };
}

export type Selector<T> = (state: StoreState) => T;
export type Subscriber = () => void;

// ─── Preview Mode ────────────────────────────────────────────────────────────

export declare const PreviewMode: {
  readonly None: 'none';
  readonly Live: 'live';
  readonly Reverting: 'reverting';
};

export type PreviewModeType = typeof PreviewMode[keyof typeof PreviewMode];

// ─── Constants ───────────────────────────────────────────────────────────────

export type Corner = 'se' | 'sw' | 'ne' | 'nw';

export declare const corners: string[];

export declare const InitialAnimationValue: {
  duration: number;
  easing: string;
};

// ─── Utilities ───────────────────────────────────────────────────────────────

export declare function getGlobalStyle(token: string): string;

// ─── Main Exports ────────────────────────────────────────────────────────────

export declare function useGrid(options?: UseGridOptions): UseGridReturn;

export declare class GridEngine {
  constructor(config?: GridEngineConfig);
  getLayout(): GridPosition[];
  setLayout(layout: GridPosition[]): void;
  moveItem(id: string, x: number, y: number): GridPosition[];
  resizeItem(id: string, w: number, h: number): GridPosition[];
  addItem(item: GridPosition): GridPosition[];
  removeItem(id: string): GridPosition[];
  subscribe(fn: LayoutSubscriber): () => void;
}

export declare class GridExternalStore {
  getSnapshot(): StoreState;
  subscribe(fn: Subscriber): () => void;
}

declare const GridStack: React.FC<GridStackProps>;
export { GridStack };
export default GridStack;
