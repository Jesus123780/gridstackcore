/**
 * Types barrel export.
 * Re-exports all new engine types alongside existing types for backward compatibility.
 */

// New GridEngine types (zero React dependency)
export type {
  GridPosition,
  GridEngineConfig,
  LayoutSubscriber,
  StoreState,
  InteractionState,
  PxHelpers,
  Selector,
  Subscriber,
} from '../engine/types';

// Existing types (preserved for backward compatibility)
export type { StyleResult } from './GridStack.types';
export type { GridItem, Overlay, GridStackProps, PreviewModeType } from './types';
export { PreviewMode } from './types';
export type {
  UseGridOptions,
  DragStateType,
} from './useGrid.types';
export {
  overlayAnchorType,
  collisionModeType,
  dragModeType,
} from './useGrid.types';
