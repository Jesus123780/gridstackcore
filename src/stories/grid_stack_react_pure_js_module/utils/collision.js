// FILE: src/utils/collision.js
// GridStack.js-inspired collision engine.
// Philosophy: push-down only, single-pass BFS, compact-up gravity, deterministic.
import {
  cloneLayout,
  dedupeLayoutById,
  normalizeNode,
  rectsCollide,
} from './grid-utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

const getNodeId = (node) => node?.i ?? node?.id;

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const cloneNode = (node) => ({ ...normalizeNode(node) });

/**
 * AABB overlap test (strict — touching edges is NOT a collision).
 */
const hasAabbCollision = (a, b) => {
  if (!a || !b) return false;
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
};

const isWithinBounds = (node, cols) => {
  if (!node) return false;
  return node.x >= 0 && node.y >= 0 && node.w > 0 && node.h > 0 && node.x + node.w <= cols;
};

const collidesWithLayout = (layout, candidate, excludeId) =>
  layout.some((item) => getNodeId(item) !== excludeId && hasAabbCollision(item, candidate));

/**
 * Get all nodes colliding with `node`, excluding `excludeId`.
 */
export const getCollidingNodes = (layout = [], node, excludeId) =>
  (layout || []).filter((l) => getNodeId(l) !== excludeId && hasAabbCollision(l, node));

// ─── Core: Push-Down Resolution (GridStack.js style) ────────────────────────

/**
 * Resolves collisions by pushing affected items downward.
 * This is the core algorithm inspired by GridStack.js:
 * 1. Find items that overlap with the moved item
 * 2. Push them below the moved item (y = movedItem.y + movedItem.h)
 * 3. Recursively resolve any new collisions caused by the push
 * 4. Bounded to prevent infinite loops
 *
 * @param {Array} layout - current layout (will be mutated in-place for performance)
 * @param {Object} movedNode - the item that was moved/resized
 * @param {number} cols - grid column count
 * @param {number} maxDepth - max cascade depth
 * @returns {Array} resolved layout
 */
const pushDown = (layout, movedNode, cols, maxDepth = 20) => {
  const result = layout.map((n) => ({ ...n }));
  const movingId = getNodeId(movedNode);

  // BFS queue: items that need their collisions resolved
  const queue = [movingId];
  const processed = new Set();
  let iterations = 0;
  const maxIterations = result.length * maxDepth;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const currentId = queue.shift();
    if (processed.has(currentId)) continue;
    processed.add(currentId);

    const current = result.find((n) => getNodeId(n) === currentId);
    if (!current) continue;

    // Find all items that collide with current
    for (let i = 0; i < result.length; i++) {
      const other = result[i];
      if (getNodeId(other) === currentId) continue;
      if (other.static) continue;

      if (hasAabbCollision(current, other)) {
        // Push the other item directly below current (GridStack.js behavior)
        const newY = current.y + current.h;
        if (newY !== other.y) {
          result[i] = { ...other, y: newY };
          // Queue this item to resolve its own new collisions
          if (!processed.has(getNodeId(other))) {
            queue.push(getNodeId(other));
          }
        }
      }
    }
  }

  return result;
};

// ─── Core: Compact Up (Gravity) ─────────────────────────────────────────────

/**
 * Compact layout upward: move each non-static item as high as possible
 * without overlapping another item. Simple gravity simulation.
 *
 * This replaces the complex A*-based compactUp with a straightforward
 * approach that preserves horizontal positions (GridStack.js behavior).
 *
 * @param {Array} baseLayout
 * @param {number} cols
 * @returns {Array}
 */
const compactUp = (baseLayout = [], cols = 12) => {
  const layout = (baseLayout || []).map((n) => cloneNode(n));

  // Sort by y ascending, then x ascending (process top items first)
  layout.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  const compacted = [];

  for (const node of layout) {
    if (node.static) {
      compacted.push({ ...node });
      continue;
    }

    const candidate = { ...node };

    // Move up as far as possible without collision
    while (candidate.y > 0) {
      const test = { ...candidate, y: candidate.y - 1 };
      const collides = compacted.some((placed) => hasAabbCollision(test, placed));
      if (collides) break;
      candidate.y = test.y;
    }

    compacted.push(candidate);
  }

  // Return in original id order for stability
  const byId = new Map(compacted.map((n) => [getNodeId(n), n]));
  return baseLayout.map((orig) => {
    const found = byId.get(getNodeId(orig));
    return found ? { ...found } : cloneNode(orig);
  });
};

// ─── Core: Swap Resolution ──────────────────────────────────────────────────

/**
 * Attempt to swap two items' positions.
 * Only works when both items fit in each other's position.
 */
const trySwap = (layout, movingNode, target, cols) => {
  const moving = normalizeNode(movingNode);
  const tgt = normalizeNode(target);

  if (moving.i === tgt.i) return null;

  // Can they swap positions?
  const movingAtTarget = { ...moving, x: tgt.x, y: tgt.y };
  const targetAtMoving = { ...tgt, x: moving.x, y: moving.y };

  if (!isWithinBounds(movingAtTarget, cols) || !isWithinBounds(targetAtMoving, cols)) {
    return null;
  }

  // Check that the swap doesn't collide with other items
  const others = layout
    .map((n) => cloneNode(n))
    .filter((n) => getNodeId(n) !== moving.i && getNodeId(n) !== tgt.i);

  const movingCollides = others.some((n) => hasAabbCollision(n, movingAtTarget));
  const targetCollides = others.some((n) => hasAabbCollision(n, targetAtMoving));

  if (movingCollides || targetCollides) return null;

  return dedupeLayoutById([...others, movingAtTarget, targetAtMoving]);
};

// ─── Core: Placement Search (BFS) ──────────────────────────────────────────

/**
 * Find a valid placement for a node using simple BFS.
 * Scans positions in order: same row left-to-right, then next row, etc.
 * Returns null if no placement found within reasonable bounds.
 *
 * @param {Array} baseLayout
 * @param {Object} node
 * @param {number} cols
 * @param {number} maxDepth - max rows to scan below current position
 * @returns {Object|null}
 */
export const findPlacementBFS = (baseLayout = [], node, cols, maxDepth = 8) => {
  const normNode = normalizeNode(node);

  if (normNode.w > cols) return null;

  // First try the requested position
  if (!collidesWithLayout(baseLayout, normNode, normNode.i)) {
    return normNode;
  }

  // Scan row by row, column by column
  const maxY = baseLayout.reduce((max, n) => Math.max(max, toNumber(n.y) + toNumber(n.h)), 0);
  const scanLimit = maxY + normNode.h + maxDepth;

  for (let y = 0; y <= scanLimit; y++) {
    for (let x = 0; x <= cols - normNode.w; x++) {
      const candidate = { ...normNode, x, y };
      if (!collidesWithLayout(baseLayout, candidate, normNode.i)) {
        return candidate;
      }
    }
  }

  return null;
};

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Main collision resolver.
 *
 * Behavior (inspired by GridStack.js):
 * 1. No collision → insert directly
 * 2. Swap mode → attempt position swap
 * 3. Static collision → find nearest free position
 * 4. Push mode → push colliding items down, then compact up
 * 5. None mode → allow overlap or reject
 *
 * @param {Array} layout
 * @param {Object} movingNodeRaw
 * @param {Object} opts
 * @returns {{ layout: Array, movedNode: Object, success: boolean, changes?: Object }}
 */
export function resolveCollision(layout = [], movingNodeRaw, opts = {}) {
  const {
    cols = 12,
    collisionMode = 'push',
    maxDepth = 20,
    allowOverlap = false,
    reflow = true,
    reflowSymmetry = true,
    sticky = false,
  } = opts;

  const base = cloneLayout(layout || []);
  const movingNode = normalizeNode(movingNodeRaw);
  const movingId = getNodeId(movingNode);
  const others = base.filter((l) => getNodeId(l) !== movingId);

  // 1. No collision — insert directly
  const initialColls = getCollidingNodes(others, movingNode, movingId);

  if (initialColls.length === 0) {
    const out = dedupeLayoutById([...others, movingNode]);
    const final = sticky ? compactUp(out, cols) : out;
    return { layout: final, movedNode: movingNode, success: true };
  }

  // 2. None mode — allow overlap or reject
  if (collisionMode === 'none' || collisionMode === 'disable') {
    return {
      layout: allowOverlap
        ? dedupeLayoutById([...others, movingNode])
        : dedupeLayoutById([...base]),
      movedNode: movingNode,
      success: allowOverlap,
    };
  }

  // 3. Swap mode — attempt position swap with first colliding item
  if (collisionMode === 'swap') {
    for (const target of initialColls) {
      if (target.static) continue;
      const swapped = trySwap(base, movingNode, target, cols);
      if (swapped) {
        const final = sticky ? compactUp(swapped, cols) : swapped;
        return { layout: final, movedNode: movingNode, success: true };
      }
    }
    // If swap fails, fall through to push
  }

  // 4. Static collision — find nearest free position for moving node
  if (initialColls.some((n) => n.static)) {
    const placement = findPlacementBFS(others, movingNode, cols, maxDepth);
    if (placement) {
      const out = dedupeLayoutById([...others, placement]);
      const final = sticky ? compactUp(out, cols) : out;
      return { layout: final, movedNode: placement, success: true };
    }
    return { layout: dedupeLayoutById([...base]), movedNode: movingNode, success: false };
  }

  // 5. Push mode (default) — push colliding items down, then compact
  if (reflow) {
    // Insert the moving node into the layout
    const withMoving = [...others, movingNode];

    // Push down all colliding items
    const pushed = pushDown(withMoving, movingNode, cols, maxDepth);

    // Compact up to fill gaps (but don't move the active item up during drag)
    const final = sticky ? compactUp(pushed, cols) : pushed;

    // Verify success (no remaining collisions with moving node)
    const finalMoving = final.find((n) => getNodeId(n) === movingId) || movingNode;
    const remainingColls = final.filter(
      (n) => getNodeId(n) !== movingId && hasAabbCollision(n, finalMoving)
    );

    if (remainingColls.length === 0) {
      const movedIds = new Set();
      others.forEach((orig) => {
        const updated = final.find((n) => getNodeId(n) === getNodeId(orig));
        if (updated && (updated.x !== orig.x || updated.y !== orig.y)) {
          movedIds.add(getNodeId(orig));
        }
      });

      return {
        layout: dedupeLayoutById(final),
        movedNode: movingNode,
        success: true,
        changes: { moved: Array.from(movedIds) },
      };
    }
  }

  // 6. Fallback: find any valid placement
  const fallback = findPlacementBFS(others, movingNode, cols, maxDepth);
  if (fallback) {
    const out = dedupeLayoutById([...others, fallback]);
    const final = sticky ? compactUp(out, cols) : out;
    return { layout: final, movedNode: fallback, success: true, changes: { moved: [] } };
  }

  // Complete failure — return original layout
  return {
    layout: dedupeLayoutById([...base]),
    movedNode: movingNode,
    success: false,
  };
}

export { compactUp };

export default {
  resolveCollision,
};
