// src/utils/compact.js
import { rectsCollide } from './grid-utils.js'

/**
 * pushCollidingItems - pushes colliding items downwards until no overlap
 * Respects `stackBelow` preference: stacked items are placed below column bottom.
 *
 * @param {Object} movedItem
 * @param {Array<Object>} others
 * @param {number} cols
 * @returns {Array<Object>}
 */
const pushCollidingItems = (movedItem, others, cols) => {
  const result = others.map(o => ({ ...o }))

  const getColKey = (node) => Math.round(node.x || 0)
  const maxPasses = 100
  let pass = 0
  let changed = true

  while (pass++ < maxPasses && changed) {
    changed = false

    // push items colliding with movedItem
    for (let i = 0; i < result.length; i++) {
      const current = result[i]
      if (rectsCollide(current, movedItem)) {
        if (current.stackBelow) {
          const colKey = getColKey(current)
          const inCol = result.filter((r, idx) => idx !== i && getColKey(r) === colKey)
          const maxBottom = Math.max(
            inCol.reduce((m, p) => Math.max(m, (p.y || 0) + (p.h || 1)), 0),
            (movedItem.y || 0) + (movedItem.h || 0)
          )
          const targetY = maxBottom + (Number(current.stackOffset || 0))
          if (current.y !== targetY) {
            result[i] = { ...current, y: targetY }
            changed = true
          }
        } else {
          const newY = movedItem.y + movedItem.h
          if (newY !== current.y) {
            result[i] = { ...current, y: newY }
            changed = true
          }
        }
      }
    }

    // resolve collisions between pushed items greedily
    for (let i = 0; i < result.length; i++) {
      for (let j = 0; j < result.length; j++) {
        if (i === j) continue
        const a = result[i]
        const b = result[j]
        if (rectsCollide(a, b)) {
          // priority: avoid flipping stacked preference
          if (b.stackBelow && !a.stackBelow) {
            result[i] = { ...a, y: b.y + b.h }
            changed = true
          } else if (a.stackBelow && !b.stackBelow) {
            result[j] = { ...b, y: a.y + a.h }
            changed = true
          } else {
            if (a.y <= b.y) {
              result[j] = { ...b, y: a.y + a.h }
              changed = true
            } else {
              result[i] = { ...a, y: b.y + b.h }
              changed = true
            }
          }
        }
      }
    }
  }

  return result.map(r => {
    if (r.x + r.w > cols) return { ...r, x: Math.max(0, cols - r.w) }
    return r
  })
}

/**
 * moveItem - move an item respecting collisions (respects stackBelow)
 *
 * @param {Object} item
 * @param {number} newX
 * @param {number} newY
 * @param {Array<Object>} layout
 * @param {number} cols
 * @returns {Array<Object>}
 */
export const moveItem = (item, newX, newY, layout = [], cols = 12) => {
  if (!item) return Array.isArray(layout) ? [...layout] : []
  const id = item.id ?? item.i
  const moved = { ...item, x: Number(newX) || 0, y: Number(newY) || 0 }

  if (moved.x < 0) moved.x = 0
  if (moved.x + moved.w > cols) moved.x = Math.max(0, cols - moved.w)

  const others = (layout || []).filter((i) => (i.id ?? i.i) !== id)
  const updatedLayout = pushCollidingItems(moved, others, cols)

  return [moved, ...updatedLayout]
}

export default {
  moveItem,
  pushCollidingItems,
}
