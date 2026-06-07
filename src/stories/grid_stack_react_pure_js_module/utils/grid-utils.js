/**
 * src/utils/grid-utils.js
 * Small, pure helpers used by collision system.
 */

/**
 * @typedef {Object} Node
 * @property {string} i - id
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {boolean} [static]
 */

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Normalize a node: ensure integer coordinates, required fields, and stable id field.
 * Rounds inputs to nearest integer (grid coordinates must be integers).
 *
 * @param {Partial<Node>|any} raw
 * @returns {Node}
 */
export const normalizeNode = (raw = {}) => {
  if (!raw || typeof raw !== 'object') raw = {};
  // Fix: el fallback anterior producía String(undefined) = "undefined"
  const rawId = raw.i !== undefined && raw.i !== null ? raw.i
    : raw.id !== undefined && raw.id !== null ? raw.id
    : null;
  const i = rawId !== null ? String(rawId) : `node-${Math.random().toString(36).slice(2, 9)}`;
  const x = isNumber(raw.x) ? Math.round(raw.x) : 0;
  const y = isNumber(raw.y) ? Math.round(raw.y) : 0;
  const w = isNumber(raw.w) ? Math.max(1, Math.round(raw.w)) : 1;
  const h = isNumber(raw.h) ? Math.max(1, Math.round(raw.h)) : 1;
  const st = !!raw.static;
  return { i, x, y, w, h, static: st };
};

/**
 * Return true if two nodes' rects strictly overlap (touching edges is NOT a collision).
 *
 * @param {Node} a
 * @param {Node} b
 * @returns {boolean}
 */
export const rectsCollide = (a, b) => {
  if (!a || !b) return false;
  // Non-overlap conditions; touching edges -> allowed (no collision)
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
};

/**
 * Clone layout deeply (returns new array and objects)
 *
 * @param {Array<Partial<Node>>} layout
 * @returns {Array<Node>}
 */
export const cloneLayout = (layout = []) =>
  (layout || []).map((n) => ({ ...normalizeNode(n) }));

/**
 * Deduplicate layout by id, preserving first occurrence and normalized values.
 *
 * @param {Array<Partial<Node>>} layout
 * @returns {Array<Node>}
 */
export const dedupeLayoutById = (layout = []) => {
  const seen = new Map();
  const out = [];
  for (const raw of (layout || [])) {
    const n = normalizeNode(raw);
    if (!seen.has(n.i)) {
      seen.set(n.i, true);
      out.push(n);
    } else {
      // merge missing fields if needed (keeps first found)
    }
  }
  return out;
};

/**
 * inBounds: ensure node is inside horizontal bounds and non-negative Y.
 *
 * @param {Node} node
 * @param {number} cols
 * @returns {boolean}
 */
export const inBounds = (node, cols = 12) => {
  if (!node) return false;
  if (!Number.isInteger(cols) || cols <= 0) throw new Error('cols must be positive integer');
  if (node.x < 0) return false;
  if (node.y < 0) return false;
  if (node.x + node.w > cols) return false;
  return true;
};

export default {
  normalizeNode,
  rectsCollide,
  cloneLayout,
  dedupeLayoutById,
  inBounds,
};