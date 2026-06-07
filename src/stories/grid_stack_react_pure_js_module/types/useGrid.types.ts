import { Corner } from '../utils/constants';
import { GridItem } from './types'

export enum overlayAnchorType {
  'grab' = 'grab',
  'pointer' = 'pointer',
  'center' = 'center'
}
export enum collisionModeType {
  'push' = 'push',
  'swap' = 'swap',
  'push-first' = 'push-first',
  'none' = 'none'
}

export enum dragModeType {
  'preview' = 'preview',
  'overlay' = 'overlay',
  'real' = 'real'
}

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
  enableRollOnPush?: boolean;
  rollAngleMax?: number;
  rollDuration?: number;
  rollStagger?: number;
  enableHitOnPush?: boolean;
  hitMultiplier?: number;
  hitDuration?: number;
  hitThresholdPx?: number;
  enableSoftDisplacement?: boolean;
  softDisplacementStrength?: number;
  softDisplacementMaxDistancePx?: number;
  flipMinThreshold?: number;
  flipBaseDuration?: number;
  maxStaggerMs?: number;
  displacementEasing?: string;
}

export interface PxHelpers {
  gridToPx(pos: number, isVertical?: boolean): number;
  widthPx(w: number): number;
  heightPx(h: number): number;
  colWidth: number;
  rowHeight: number;
  marginX: number;
  marginY: number;
  containerPadding: [number, number];
  containerRect?: {left: number; top: number};
}

export interface DragStateType {
  pointerId: number;
  type: 'drag' | 'resize';
  itemId: string;
  orig: GridItem;
  pxHelpers: PxHelpers;
  containerRect: {left: number; top: number};
  // Drag specific
  grabOffsetX: number;
  grabOffsetY: number;
  lastClientX?: number;
  lastClientY?: number;
  // Resize specific
  corner: Corner;
  startClientX: number;
  startClientY: number;
}