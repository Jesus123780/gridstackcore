import { GridItem } from '../types/types';

interface ResolveCollisionResult {
  layout: GridItem[];
  movedNode: GridItem;
  success: boolean;
  changes?: { moved: string[] };
}

interface ResolveCollisionOpts {
  cols?: number;
  collisionMode?: string;
  maxDepth?: number;
  allowOverlap?: boolean;
  reflow?: boolean;
  reflowSymmetry?: boolean;
  sticky?: boolean;
  [key: string]: unknown;
}

export function resolveCollision(
  layout: GridItem[],
  movingNode: Partial<GridItem>,
  opts?: ResolveCollisionOpts
): ResolveCollisionResult;

export function findPlacementBFS(
  baseLayout: GridItem[],
  node: Partial<GridItem>,
  cols: number,
  maxDepth?: number
): GridItem | null;

export function compactUp(layout: GridItem[], cols?: number): GridItem[];

export function getCollidingNodes(
  layout: GridItem[],
  node: Partial<GridItem>,
  excludeId?: string
): GridItem[];

declare const _default: {
  resolveCollision: typeof resolveCollision;
};

export default _default;
