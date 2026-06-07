// FILE: src/utils/placement.js
import { findPlacementBFS } from '../collision';
import {
  normalizeNode,
  rectsCollide,
  dedupeLayoutById,
} from '../grid-utils'

/**
 * @typedef {Object} PlaceResult
 * @property {boolean} success - whether placement succeeded
 * @property {Array<Object>} layout - new deduped layout (does not mutate input)
 * @property {Object|null} placedNode - normalized node that was inserted (null on failure)
 * @property {string|null} error - error message if any
 */

/**
 * Try to place a new node into a layout at a free spot.
 * Strategy:
 *  1. Validate inputs.
 *  2. If requested origin fits without collisions -> place there.
 *  3. Try BFS placement (findPlacementBFS).
 *  4. Fallback: deterministic scan (rows then cols) up to maxRows.
 *
 * Returns a PlaceResult; never throws for recoverable conditions (returns error message).
 *
 * @param {Array<Object>} baseLayout - current layout (array of normalized-ish nodes)
 * @param {Object} nodeRaw - node to place ({ i | id, x, y, w, h, static? })
 * @param {number} cols - number of grid columns
 * @param {Object} [opts]
 * @param {number} [opts.maxDepth=20] - BFS depth for searches
 * @param {number} [opts.maxRows=50] - row scan limit for fallback
 * @param {boolean} [opts.forceId=false] - if true and id collision found -> return error instead of auto-renaming
 * @returns {PlaceResult}
 */
export const placeNewComponent = (
  baseLayout = [],
  nodeRaw = {},
  cols = 12,
  opts = {
    maxDepth: 20,
    maxRows: 50,
    forceId: false,
  },
) => {
  const { maxDepth = 20, maxRows = 50, forceId = false } = opts;

  try {
    // Basic input validation
    if (!Array.isArray(baseLayout)) {
      return { success: false, layout: baseLayout, placedNode: null, error: 'baseLayout must be an array' };
    }
    if (typeof nodeRaw !== 'object' || nodeRaw == null) {
      return { success: false, layout: baseLayout, placedNode: null, error: 'node must be an object' };
    }
    if (!Number.isInteger(cols) || cols <= 0) {
      return { success: false, layout: baseLayout, placedNode: null, error: 'cols must be a positive integer' };
    }

    // Normalize and ensure id exists
    const node = normalizeNode({ ...nodeRaw });
    if (!node.i) {
      // prefer crypto.randomUUID when available
      const generatedId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `node-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      node.i = generatedId;
    }

    // check width/height bounds
    if (!Number.isInteger(node.w) || node.w <= 0 || !Number.isInteger(node.h) || node.h <= 0) {
      return { success: false, layout: baseLayout, placedNode: null, error: 'node width (w) and height (h) must be positive integers' };
    }
    if (node.w > cols) {
      return { success: false, layout: baseLayout, placedNode: null, error: `node width (w=${node.w}) exceeds cols (${cols})` };
    }

    // ensure id uniqueness (don't mutate input layout)
    const idExists = baseLayout.some((l) => (l.i ?? l.id) === node.i);
    if (idExists) {
      if (forceId) {
        return { success: false, layout: baseLayout, placedNode: null, error: `id '${node.i}' already exists in layout` };
      }
      // auto-generate alternate id
      node.i = `${node.i}-${Math.floor(Math.random() * 10000)}`;
    }

    // quick check: try requested origin (if provided)
    const inBoundsOrigin = (candidate) => candidate.x >= 0 && candidate.y >= 0 && candidate.x + candidate.w <= cols;
    if (Number.isInteger(node.x) && Number.isInteger(node.y) && inBoundsOrigin(node)) {
      const coll = baseLayout.find((l) => rectsCollide(l, node));
      if (!coll) {
        const out = dedupeLayoutById([...baseLayout, node]);
        return { success: true, layout: out, placedNode: node, error: null };
      }
    }

    // 1) Try BFS placement (respects node.x/node.y as starting point inside)
    const candidateBFS = findPlacementBFS(baseLayout, node, cols, maxDepth);
    if (candidateBFS) {
      const out = dedupeLayoutById([...baseLayout, candidateBFS]);
      return { success: true, layout: out, placedNode: candidateBFS, error: null };
    }

    // 2) Fallback: deterministic scan row-major (y then x)
    // Compute a safe maxRows to scan: either provided or a bit above current highest row
    const highestRow = Math.max(0, ...baseLayout.map((l) => (Number.isFinite(l.y) && Number.isFinite(l.h) ? l.y + l.h : 0)));
    const rowsToScan = Math.min(maxRows, Math.max(maxRows, Math.ceil(highestRow + Math.max(5, node.h))));

    for (let y = 0; y <= rowsToScan; y += 1) {
      for (let x = 0; x <= cols - node.w; x += 1) {
        const cand = { ...node, x, y };
        if (!inBoundsOrigin(cand)) continue;
        const coll = baseLayout.find((l) => rectsCollide(l, cand));
        if (!coll) {
          const out = dedupeLayoutById([...baseLayout, cand]);
          return { success: true, layout: out, placedNode: cand, error: null };
        }
      }
    }

    // Could not place
    return { success: false, layout: baseLayout, placedNode: null, error: 'no free space found within scan limits' };
  } catch (err) {
    return { success: false, layout: baseLayout, placedNode: null, error: `unexpected error: ${err?.message || String(err)}` };
  }
}
