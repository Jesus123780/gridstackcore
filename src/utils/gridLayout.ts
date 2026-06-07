/**
 * Collision Detection and Grid Layout Utilities
 * Core algorithms for grid management
 */

export interface GridNode {
  x?: number;
  y?: number;
  w: number;
  h: number;
  id?: string;
  [key: string]: any;
}

export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CollisionResult {
  collides: boolean;
  node?: GridNode;
  overlapArea?: number;
}

/**
 * Grid layout and collision detection utilities
 */
export const GridLayoutUtils = {
  /**
   * Check if two grid items collide
   */
  collides(rect1: GridRect, rect2: GridRect): boolean {
    return !(
      rect1.x + rect1.w <= rect2.x ||
      rect2.x + rect2.w <= rect1.x ||
      rect1.y + rect1.h <= rect2.y ||
      rect2.y + rect2.h <= rect1.y
    );
  },

  /**
   * Calculate overlap area between two rectangles
   */
  overlapArea(rect1: GridRect, rect2: GridRect): number {
    const overlapWidth = Math.max(
      0,
      Math.min(rect1.x + rect1.w, rect2.x + rect2.w) - Math.max(rect1.x, rect2.x)
    );
    const overlapHeight = Math.max(
      0,
      Math.min(rect1.y + rect1.h, rect2.y + rect2.h) - Math.max(rect1.y, rect2.y)
    );
    return overlapWidth * overlapHeight;
  },

  /**
   * Check if a position would collide with any node in list
   */
  getCollisionsWithList(
    newPos: GridRect,
    nodeList: GridNode[],
    excludeId?: string
  ): GridNode[] {
    return nodeList.filter(node => {
      if (excludeId && node.id === excludeId) return false;
      const nodeRect: GridRect = {
        x: node.x || 0,
        y: node.y || 0,
        w: node.w,
        h: node.h,
      };
      return this.collides(newPos, nodeRect);
    });
  },

  /**
   * Push colliding node out of the way
   */
  push(movingNode: GridNode, staticNode: GridNode, direction: 'x' | 'y' = 'y'): GridNode | null {
    if (direction === 'y') {
      // Push down
      if ((movingNode.y || 0) < (staticNode.y || 0)) {
        // Moving node is above, push moving node down
        return {
          ...movingNode,
          y: (staticNode.y || 0) + staticNode.h,
        };
      } else {
        // Moving node is below, push static node up
        return {
          ...staticNode,
          y: (movingNode.y || 0) - staticNode.h,
        };
      }
    } else {
      // Push right
      if ((movingNode.x || 0) < (staticNode.x || 0)) {
        return {
          ...movingNode,
          x: (staticNode.x || 0) + staticNode.w,
        };
      } else {
        return {
          ...staticNode,
          x: (movingNode.x || 0) - staticNode.w,
        };
      }
    }
  },

  /**
   * Compact layout - fill empty spaces
   */
  compact(nodes: GridNode[], cols: number = 12): GridNode[] {
    const sorted = [...nodes].sort((a, b) => {
      const aY = a.y || 0;
      const bY = b.y || 0;
      if (aY !== bY) return aY - bY;
      return (a.x || 0) - (b.x || 0);
    });

    const result: GridNode[] = [];

    sorted.forEach(node => {
      let y = node.y || 0;
      let hasCollision = true;

      while (hasCollision) {
        hasCollision = false;
        for (const placed of result) {
          if (this.collides(
            { x: node.x || 0, y, w: node.w, h: node.h },
            { x: placed.x || 0, y: placed.y || 0, w: placed.w, h: placed.h }
          )) {
            y = (placed.y || 0) + placed.h;
            hasCollision = true;
            break;
          }
        }
      }

      result.push({ ...node, y });
    });

    return result;
  },

  /**
   * Fix position constraints (min/max, bounds)
   */
  constrainPosition(
    node: GridNode,
    opts: {
      minW?: number;
      maxW?: number;
      minH?: number;
      maxH?: number;
      cols?: number;
      maxRow?: number;
    }
  ): GridNode {
    const result = { ...node };

    // Width constraints
    result.w = Math.max(
      opts.minW || 1,
      Math.min(result.w || 1, opts.maxW || opts.cols || 12)
    );

    // Height constraints
    result.h = Math.max(opts.minH || 1, result.h || 1);
    if (opts.maxH) {
      result.h = Math.min(result.h, opts.maxH);
    }

    // Position constraints
    if (result.x && result.x < 0) result.x = 0;
    if (result.y && result.y < 0) result.y = 0;

    const cols = opts.cols || 12;
    if (result.x && result.x + result.w > cols) {
      result.x = Math.max(0, cols - result.w);
    }

    if (opts.maxRow && result.y && result.y + result.h > opts.maxRow) {
      result.y = Math.max(0, opts.maxRow - result.h);
    }

    return result;
  },

  /**
   * Find empty position for a node
   */
  findPosition(
    node: GridNode,
    occupied: GridNode[],
    cols: number = 12,
    maxRow: number = Infinity
  ): { x: number; y: number } {
    let x = node.x || 0;
    let y = node.y || 0;
    let found = false;

    while (!found && y < maxRow) {
      found = true;
      for (const occupied_item of occupied) {
        if (this.collides(
          { x, y, w: node.w, h: node.h },
          {
            x: occupied_item.x || 0,
            y: occupied_item.y || 0,
            w: occupied_item.w,
            h: occupied_item.h,
          }
        )) {
          found = false;
          // Move to next available column
          x = (occupied_item.x || 0) + occupied_item.w;
          if (x + node.w > cols) {
            x = 0;
            y = (occupied_item.y || 0) + occupied_item.h;
          }
          break;
        }
      }
    }

    return { x, y };
  },

  /**
   * Calculate grid height needed
   */
  getGridHeight(nodes: GridNode[]): number {
    let maxY = 0;
    nodes.forEach(node => {
      const bottom = (node.y || 0) + node.h;
      maxY = Math.max(maxY, bottom);
    });
    return maxY;
  },

  /**
   * Check if area is empty
   */
  isAreaEmpty(
    area: GridRect,
    nodes: GridNode[],
    excludeId?: string
  ): boolean {
    return !nodes.some(node => {
      if (excludeId && node.id === excludeId) return false;
      return this.collides(area, {
        x: node.x || 0,
        y: node.y || 0,
        w: node.w,
        h: node.h,
      });
    });
  },

  /**
   * Move node and handle collisions (push approach)
   */
  moveNodeWithPush(
    movingNode: GridNode,
    targetPos: { x: number; y: number },
    otherNodes: GridNode[],
    cols: number
  ): { moved: GridNode; displaced: GridNode[] } {
    const moved = { ...movingNode, ...targetPos };
    const displaced: GridNode[] = [];

    // Check for collisions
    let hasCollision = true;
    while (hasCollision) {
      hasCollision = false;
      for (const other of otherNodes) {
        if (other.id === movingNode.id) continue;
        if (this.collides(
          { x: moved.x || 0, y: moved.y || 0, w: moved.w, h: moved.h },
          { x: other.x || 0, y: other.y || 0, w: other.w, h: other.h }
        )) {
          hasCollision = true;
          // Push the other node down
          const pushed = this.push(moved, other, 'y');
          if (pushed && pushed.id === other.id) {
            const newNode = { ...other, ...pushed };
            const idx = otherNodes.findIndex(n => n.id === other.id);
            if (idx >= 0) {
              otherNodes[idx] = newNode;
              displaced.push(newNode);
            }
          }
          break;
        }
      }
    }

    return { moved, displaced };
  },
};

export default GridLayoutUtils;
