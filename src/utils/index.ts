/**
 * GridStack Core Utilities
 * Extraction of vanilla GridStack logic for reuse in React
 */

export { GridEventEmitter, EventEmitter, type GridStackEventMap, type GridStackEventType } from './eventSystem';
export { GridStackUtils } from './gridstackUtils';
export { GridLayoutUtils, type GridNode, type GridRect, type CollisionResult } from './gridLayout';
export { DDUtils, type DDPosition, type DDSize, type DDEvent, type DragTransform } from './dragDropHelpers';

// Re-export as namespace
export * as EventUtils from './eventSystem';
export * as LayoutUtils from './gridLayout';
export * as DragDropUtils from './dragDropHelpers';
