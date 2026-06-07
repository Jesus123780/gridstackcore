import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  memo,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { useGrid } from '../../hooks/useGrid'
import DragLayer from '../DragLayer'
import DropIndicator from '../DropIndicator/DropIndicator'
import ResizeHandles from '../ResizeHandles/ResizeHandles'
import {
  Corner,
  corners,
  InitialAnimationValue,
} from '../../utils/constants'
import {
  GridItem,
  GridStackProps,
  Overlay,
  PreviewMode,
  PreviewModeType,
} from '../../types/types'
import styles from './GridStack.module.css'
import {
  collisionModeType,
  dragModeType,
  overlayAnchorType,
  PxHelpers,
} from '../../types/useGrid.types'
import { StyleResult } from '../../types/GridStack.types'

type Rect = {
  left: number
  top: number
  width: number
  height: number
}

type MotionVector = {
  x: number
  y: number
  speed: number
  timestamp: number
}

type MotionProfile = {
  dx: number
  dy: number
  delay: number
  duration: number
  scale: number
  angle: number
  distance: number
  cost: number
}

type CleanupEntry = (() => void) | number

type MotionDecision = {
  movementDistance: number
  overlapPenalty: number
  layoutShiftPenalty: number
  directionPenalty: number
  cost: number
}

const EPSILON = 0.5
const SCALE_EPSILON = 0.01
const DEFAULT_BASE_DURATION = 260
const DEFAULT_EASING = 'cubic-bezier(.2,.9,.25,1)'
const DRAG_INERTIA_CAP = 42
const JITTER_THRESHOLD_PX = 3

/**
 * Clamp a numeric value to a range.
 */
function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * Safely coerce a value to a finite number.
 */
function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Create a stable layout signature for change detection.
 */
function layoutSignature(layout: ReadonlyArray<GridItem> | null | undefined): string {
  if (!layout || layout.length === 0) return ''
  return layout
    .map((n) => `${n.i}:${n.x},${n.y},${n.w},${n.h}${n.static ? ':s' : ''}`)
    .join('|')
}

/**
 * Compare two layouts at cell precision.
 */
function layoutsAlmostEqual(
  a: ReadonlyArray<GridItem> | null | undefined,
  b: ReadonlyArray<GridItem> | null | undefined,
  threshold = 0,
) {
  if (!a || !b) return false
  if (a.length !== b.length) return false

  const byIdB = new Map(b.map((n) => [n.i, n]))
  for (const na of a) {
    const nb = byIdB.get(na.i)
    if (!nb) return false
    if (
      Math.abs(safeNumber(na.x) - safeNumber(nb.x)) > threshold ||
      Math.abs(safeNumber(na.y) - safeNumber(nb.y)) > threshold ||
      Math.abs(safeNumber(na.w) - safeNumber(nb.w)) > threshold ||
      Math.abs(safeNumber(na.h) - safeNumber(nb.h)) > threshold
    ) {
      return false
    }
  }
  return true
}

/**
 * Merge and deduplicate ids from two layouts.
 */
function unionIds(a: ReadonlyArray<GridItem>, b: ReadonlyArray<GridItem>): string[] {
  const s = new Set<string>()
  a.forEach((n) => s.add(String(n.i)))
  b.forEach((n) => s.add(String(n.i)))
  return Array.from(s)
}

/**
 * Compute axis-aligned rectangle intersection area.
 */
function intersectionArea(a?: Rect | null, b?: Rect | null): number {
  if (!a || !b) return 0
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.left + a.width, b.left + b.width)
  const bottom = Math.min(a.top + a.height, b.top + b.height)
  const w = Math.max(0, right - left)
  const h = Math.max(0, bottom - top)
  return w * h
}

/**
 * Distance between rectangle centers.
 */
function rectDistance(a?: Rect | null, b?: Rect | null): number {
  if (!a || !b) return 0
  const ax = a.left + a.width / 2
  const ay = a.top + a.height / 2
  const bx = b.left + b.width / 2
  const by = b.top + b.height / 2
  return Math.hypot(ax - bx, ay - by)
}

/**
 * Convert a grid item into an approximate pixel rectangle.
 */
function gridItemToRect(item: GridItem, px: PxHelpers): Rect {
  return {
    left: Math.round(px.gridToPx(safeNumber(item.x))),
    top: Math.round(px.gridToPx(safeNumber(item.y), true)),
    width: Math.round(px.widthPx(safeNumber(item.w))),
    height: Math.round(px.heightPx(safeNumber(item.h))),
  }
}

/**
 * Invalidate and execute cleanup entries.
 */
function flushCleanup(store: Record<string, CleanupEntry>) {
  Object.keys(store).forEach((key) => {
    const entry = store[key]
    try {
      if (typeof entry === 'function') entry()
      else if (typeof entry === 'number') clearTimeout(entry)
    } catch {
      // noop
    }
    delete store[key]
  })
}

/**
 * Get an item's layout entry by id.
 */
function getLayoutEntry(layout: ReadonlyArray<GridItem> | null | undefined, id: string | null | undefined) {
  if (!layout || !id) return null
  return layout.find((n) => n.i === id) || null
}

/**
 * Build a preview-aware lookup map.
 */
function buildLayoutMap(layout: ReadonlyArray<GridItem> | null | undefined) {
  const map = new Map<string, GridItem>()
    ; (layout || []).forEach((item) => map.set(item.i, item))
  return map
}

/**
 * Estimate a dominant row height from a set of rectangles.
 */
function estimateRowHeight(rects: Array<Rect | null | undefined>) {
  const heights = rects
    .map((r) => (r ? r.height : 0))
    .filter((h) => Number.isFinite(h) && h > 0)
  if (!heights.length) return 40
  return heights.reduce((a, b) => a + b, 0) / heights.length
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance: stable empty object to avoid re-creating on every render
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_PROPS: Record<string, any> = {}

// ─────────────────────────────────────────────────────────────────────────────
// Performance: Memoized content wrapper prevents widget re-renders during drag
// ─────────────────────────────────────────────────────────────────────────────
const MemoizedContent = memo(function MemoizedContent({
  ItemComp,
  componentProps,
}: {
  ItemComp: React.ComponentType<any> | null
  componentProps: Record<string, any>
}) {
  if (!ItemComp) return null
  return <ItemComp {...componentProps} />
}, (prev, next) => {
  // Only re-render if the component itself or its props changed
  if (prev.ItemComp !== next.ItemComp) return false
  if (prev.componentProps === next.componentProps) return true
  // Shallow compare componentProps
  const prevKeys = Object.keys(prev.componentProps)
  const nextKeys = Object.keys(next.componentProps)
  if (prevKeys.length !== nextKeys.length) return false
  return prevKeys.every(key => prev.componentProps[key] === next.componentProps[key])
})

// ─────────────────────────────────────────────────────────────────────────────
// Performance: Memoized grid item node — prevents re-render of items whose
// position/style hasn't changed during drag (the key optimization).
// ─────────────────────────────────────────────────────────────────────────────
interface GridItemNodeProps {
  nodeId: string
  style: StyleResult
  className: string
  radio: number
  isBeingDragged: boolean
  isDraggable: boolean
  isResizable: boolean
  isStatic: boolean
  ItemComp: React.ComponentType<any> | null
  componentProps: Record<string, any>
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onResizePointerDown: (e: React.PointerEvent, corner: Corner) => void
  itemInnerRefCb: (el: HTMLElement | null) => void
}

const GridItemNode = memo(function GridItemNode({
  nodeId,
  style,
  className,
  radio,
  isBeingDragged,
  isDraggable,
  isResizable,
  isStatic,
  ItemComp,
  componentProps,
  onPointerDown,
  onResizePointerDown,
  itemInnerRefCb,
}: GridItemNodeProps) {
  return (
    <div
      className={className}
      style={{
        ...style,
        borderRadius: radio,
      }}
      data-grid-id={nodeId}
    >
      <div
        className={styles.gridItemInner}
        ref={itemInnerRefCb}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={onPointerDown}
      >
        <div
          className={styles.content}
          onContextMenu={(e) => e.preventDefault()}
        >
          <MemoizedContent ItemComp={ItemComp} componentProps={componentProps} />
        </div>

        {isResizable && !isStatic && (
          <ResizeHandles
            corners={corners as Corner[]}
            onPointerDown={onResizePointerDown}
            radio={radio}
          />
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  // Custom comparator: skip re-render if position/style haven't changed
  return (
    prev.style.transform === next.style.transform &&
    prev.style.width === next.style.width &&
    prev.style.height === next.style.height &&
    prev.style.transition === next.style.transition &&
    prev.className === next.className &&
    prev.isBeingDragged === next.isBeingDragged &&
    prev.ItemComp === next.ItemComp &&
    prev.componentProps === next.componentProps &&
    prev.radio === next.radio &&
    prev.isDraggable === next.isDraggable &&
    prev.isResizable === next.isResizable &&
    prev.isStatic === next.isStatic
  )
})

/**
 * GridStack: production-ready interactive grid layout surface.
 */
export default function GridStack(props: Readonly<GridStackProps>) {
  const {
    items = [],
    cols = 12,
    rowHeight = 30,
    margin = [20, 20],
    containerPadding = [0, 0],
    isDraggable = true,
    isResizable = true,
    preventCollision = true,
    onLayoutChange = () => { },
    componentMap = {},
    dragMode = dragModeType.overlay,
    collisionMode = collisionModeType.push,
    animation = InitialAnimationValue,
    dragThrottleMs = 0,
    allowOverlapDuringDrag = false,
    animateOnDrop = true,
    overlayAnchor = overlayAnchorType.grab,
    snapEnabled = true,
    snapThreshold = 12,
    showGrid = false,
    enableRollOnPush = false,
    rollAngleMax = 20,
    rollDuration = 320,
    rollStagger = 30,
    sticky = false,
    radio = 15,
    dragOverlayOffset = { x: 8, y: 8 },
  } = props

  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemInnerRefs = useRef<Record<string, HTMLElement>>({})
  const animCleanupRef = useRef<Record<string, CleanupEntry>>({})
  const dragSnapshotRef = useRef<Array<GridItem> | null>(null)
  const lastCommittedLayoutRef = useRef<Array<GridItem> | null>(null)
  const lastCommittedSignatureRef = useRef<string>('')
  const lastAppliedSignatureRef = useRef<string>('')
  const lastPointerRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastMotionVectorRef = useRef<MotionVector | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const pendingPreviewTimeoutRef = useRef<number | null>(null)
  const pendingRafRef = useRef<number[]>([])
  const lastDropTimeoutRef = useRef<number | null>(null)
  // Cache de pxHelpers — se actualiza en ResizeObserver, no en cada render
  const pxHelpersRef = useRef<PxHelpers | null>(null)

  const [previewCommittedLayout, setPreviewCommittedLayout] = useState<Array<GridItem> | null>(null)
  const [previewMode, setPreviewMode] = useState<PreviewModeType | null>(null)
  const [lastDropId, setLastDropId] = useState<string | null>(null)
  const [containerVersion, setContainerVersion] = useState(0)

  const reducedMotion = useMemo(() => {
    try {
      return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    } catch {
      return false
    }
  }, [])

  /**
   * Resolve the latest container metrics and cell geometry.
   */
  const getPxHelpers = useCallback((): PxHelpers => {
    const containerWidth = Math.max(1, containerRef.current?.clientWidth || 0)
    const padX = safeNumber(containerPadding?.[0], 0)
    const padY = safeNumber(containerPadding?.[1], 0)
    const marginX = safeNumber(margin?.[0], 0)
    const marginY = safeNumber(margin?.[1], 0)
    const usableWidth = Math.max(1, containerWidth - padX * 2 - marginX * Math.max(0, cols - 1))
    const colWidth = Math.max(8, usableWidth / Math.max(1, cols))
    return {
      colWidth,
      rowHeight: safeNumber(rowHeight, 30),
      marginX,
      marginY,
      containerPadding,
      gridToPx: (gridX: number, isY = false) =>
        Math.round(
          (isY ? (safeNumber(rowHeight, 30) + marginY) : (colWidth + marginX)) * safeNumber(gridX) +
          (isY ? padY : padX),
        ),
      widthPx: (w: number) => Math.round(colWidth * safeNumber(w) + marginX * Math.max(0, safeNumber(w) - 1)),
      heightPx: (h: number) => Math.round(safeNumber(rowHeight, 30) * safeNumber(h) + marginY * Math.max(0, safeNumber(h) - 1)),
      containerRect: (containerRef.current?.getBoundingClientRect?.() || ({ left: 0, top: 0 } as DOMRect)),
    }
  }, [cols, containerPadding, margin, rowHeight])

  const grid = useGrid({
    items,
    cols,
    rowHeight,
    margin,
    containerPadding,
    preventCollision,
    dragMode,
    collisionMode,
    dragThrottleMs,
    onLayoutChange,
    allowOverlapDuringDrag,
    animateOnDrop,
    overlayAnchor,
    snapEnabled,
    snapThreshold,
    reflowDuringDrag: true,
    sticky,
    reflowMaxDepth: 20,
    dragOverlayOffset: { x: 8, y: 8 },
  })

  /**
   * Save a snapshot of the current resolved layout for cancel/revert flows.
   */
  const saveDragSnapshot = useCallback(() => {
    try {
      dragSnapshotRef.current = grid.layout.map((n) => ({ ...n }))
    } catch {
      dragSnapshotRef.current = null
    }
  }, [grid.layout])

  /**
   * Store the last pointer motion to feed motion-aware animations.
   */
  const updatePointerMotion = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const x = safeNumber(e.clientX)
    const y = safeNumber(e.clientY)
    const last = lastPointerRef.current
    if (last) {
      const dt = Math.max(1, now - last.time)
      const dx = x - last.x
      const dy = y - last.y
      const speed = Math.hypot(dx, dy) / dt
      lastMotionVectorRef.current = {
        x: dx,
        y: dy,
        speed,
        timestamp: now,
      }
    }
    lastPointerRef.current = { x, y, time: now }
  }, [])

  /**
   * Measure rendered rectangles for FLIP.
   */
  const measureRects = useCallback((ids: string[]) => {
    const rects: Record<string, Rect> = {}
    const containerRect = containerRef.current?.getBoundingClientRect?.()
    if (!containerRect) return rects

    for (const id of ids) {
      const el = itemInnerRefs.current[id]
      if (!el) continue
      const r = el.getBoundingClientRect()
      rects[id] = {
        left: r.left - containerRect.left,
        top: r.top - containerRect.top,
        width: r.width,
        height: r.height,
      }
    }
    return rects
  }, [])

  /**
   * Return the duration to use for a motion profile.
   */
  const durationFromCost = useCallback((base: number, cost: number) => {
    return clamp(Math.round(base + cost * 0.12), 140, 620)
  }, [])

  /**
   * Compute a physics-like cost for a layout delta.
   */
  const computeMotionDecision = useCallback(
    (
      firstRect: Rect,
      lastRect: Rect,
      movingRect?: Rect | null,
      velocity?: MotionVector | null,
    ): MotionDecision => {
      const movementDistance = rectDistance(firstRect, lastRect)

      const overlapPenalty = movingRect ? clamp(intersectionArea(lastRect, movingRect) / Math.max(1, lastRect.width * lastRect.height), 0, 1) : 0

      const layoutShiftPenalty =
        (Math.abs(lastRect.left - firstRect.left) + Math.abs(lastRect.top - firstRect.top)) /
        Math.max(1, estimateRowHeight([firstRect, lastRect]))

      const motion = velocity ?? lastMotionVectorRef.current
      const dx = lastRect.left - firstRect.left
      const dy = lastRect.top - firstRect.top
      let directionPenalty = 0.25

      if (motion) {
        const mag = Math.max(1, Math.hypot(motion.x, motion.y))
        const nmx = motion.x / mag
        const nmy = motion.y / mag
        const mv = Math.hypot(dx, dy) || 1
        const ndx = dx / mv
        const ndy = dy / mv
        const alignment = clamp(nmx * ndx + nmy * ndy, -1, 1)
        directionPenalty = (1 - alignment) / 2
      }

      return {
        movementDistance,
        overlapPenalty,
        layoutShiftPenalty,
        directionPenalty,
        cost:
          movementDistance +
          overlapPenalty * 1000 +
          layoutShiftPenalty * 24 +
          directionPenalty * 40,
      }
    },
    [],
  )

  /**
   * Compute the final FLIP motion profile map using movement cost, direction and inertia.
   */
  const computeSoftDisplacement = useCallback(
    (
      firstRects: Record<string, Rect> = {},
      lastRects: Record<string, Rect> = {},
      movingId: string | null = null,
    ) => {
      const out: Record<string, MotionProfile> = {}
      const ids = Object.keys(lastRects)
      if (!ids.length) return out

      const movingRect = movingId ? (lastRects[movingId] || firstRects[movingId] || null) : null
      const approxRow = estimateRowHeight([
        ...ids.map((id) => firstRects[id]),
        ...ids.map((id) => lastRects[id]),
      ])

      const scored = ids
        .filter((id) => id !== movingId)
        .map((id) => {
          const first = firstRects[id]
          const last = lastRects[id]
          if (!first || !last) return null

          const dx = last.left - first.left
          const dy = last.top - first.top
          if (Math.abs(dx) < JITTER_THRESHOLD_PX && Math.abs(dy) < JITTER_THRESHOLD_PX) {
            return null
          }

          const decision = computeMotionDecision(first, last, movingRect, lastMotionVectorRef.current)
          const depthBias = movingRect ? rectDistance(last, movingRect) / Math.max(1, approxRow) : 0
          const inertia = clamp(lastMotionVectorRef.current?.speed ?? 0, 0, DRAG_INERTIA_CAP)

          return {
            id,
            first,
            last,
            dx,
            dy,
            cost: decision.cost + depthBias * 8 - inertia * 2,
            decision,
          }
        })
        .filter(Boolean) as Array<{
          id: string
          first: Rect
          last: Rect
          dx: number
          dy: number
          cost: number
          decision: MotionDecision
        }>

      scored.sort((a, b) => a.cost - b.cost)

      for (let i = 0; i < scored.length; i += 1) {
        const entry = scored[i]
        const distance = Math.hypot(entry.dx, entry.dy)
        const overlapInfluence = clamp(entry.decision.overlapPenalty, 0, 1)
        const directionInfluence = clamp(entry.decision.directionPenalty, 0, 1)
        const inertiaInfluence = clamp((lastMotionVectorRef.current?.speed ?? 0) / DRAG_INERTIA_CAP, 0, 1)

        const delay = Math.round(
          clamp(
            i * rollStagger * 0.55 + (distance / Math.max(1, approxRow)) * 12 * (1 - inertiaInfluence),
            0,
            360,
          ),
        )

        const angleBase = clamp((entry.dy / Math.max(1, approxRow)) * 3.5, -8, 8)
        const angle = Math.round(
          angleBase * (1 - 0.4 * directionInfluence) + (entry.dy > 0 ? 1 : -1) * overlapInfluence * 2,
        )

        const duration = durationFromCost(animation?.duration ?? DEFAULT_BASE_DURATION, entry.cost)
        const scale = clamp(1 - overlapInfluence * 0.015, 0.97, 1)

        out[entry.id] = {
          dx: Math.round(entry.dx * 0.96),
          dy: Math.round(entry.dy * 0.96),
          delay,
          duration,
          scale,
          angle,
          distance,
          cost: entry.cost,
        }
      }

      return out
    },
    [animation?.duration, computeMotionDecision, durationFromCost, rollStagger],
  )

  /**
   * Compute roll map for secondary 3D depth cue on push-like reflow.
   */
  const computeRollMap = useCallback(
    (
      fromLayout: ReadonlyArray<GridItem>,
      toLayout: ReadonlyArray<GridItem>,
      movingId: string | null,
    ): Record<string, { deltaRows: number; angle: number; delay: number; axis: 'x' | 'y' }> => {
      if (!enableRollOnPush || !fromLayout || !toLayout) return {}
      const byIdFrom = buildLayoutMap(fromLayout)
      const byIdTo = buildLayoutMap(toLayout)
      const roll: Record<string, { deltaRows: number; angle: number; delay: number; axis: 'x' | 'y' }> = {}
      const movingFrom = movingId ? byIdFrom.get(movingId) || null : null

      const entries = Array.from(byIdTo.entries()).filter(([id]) => id !== movingId)
      const scored = entries
        .map(([id, to]) => {
          const fr = byIdFrom.get(id)
          if (!fr) return null
          const deltaRows = safeNumber(to.y) - safeNumber(fr.y)
          if (deltaRows === 0) return null
          const relX = safeNumber(fr.x) - safeNumber(movingFrom?.x ?? to.x)
          const relY = safeNumber(fr.y) - safeNumber(movingFrom?.y ?? to.y)
          const primaryAxis: 'x' | 'y' = Math.abs(relY) >= Math.abs(relX) ? 'y' : 'x'
          const cost = Math.abs(deltaRows) * 10 + Math.hypot(relX, relY)
          return { id, fr, to, deltaRows, relX, relY, primaryAxis, cost }
        })
        .filter(Boolean) as Array<{
          id: string
          fr: GridItem
          to: GridItem
          deltaRows: number
          relX: number
          relY: number
          primaryAxis: 'x' | 'y'
          cost: number
        }>

      scored.sort((a, b) => a.cost - b.cost)

      scored.forEach((entry, index) => {
        const magnitude = clamp(entry.deltaRows * (rollAngleMax / 2), -rollAngleMax, rollAngleMax)
        const angle =
          entry.primaryAxis === 'y'
            ? entry.relY > 0
              ? Math.abs(magnitude)
              : -Math.abs(magnitude)
            : entry.relX > 0
              ? Math.abs(magnitude)
              : -Math.abs(magnitude)

        const distance = Math.hypot(entry.relX, entry.relY)
        const delay = Math.round(clamp(index * rollStagger + distance * 2, 0, 350))

        roll[entry.id] = {
          deltaRows: entry.deltaRows,
          angle,
          delay,
          axis: entry.primaryAxis,
        }
      })

      return roll
    },
    [enableRollOnPush, rollAngleMax, rollStagger],
  )

  /**
   * Cancel all running motion timers and cleanup inline styles.
   */
  const clearMotionArtifacts = useCallback(() => {
    flushCleanup(animCleanupRef.current)

    if (pendingPreviewTimeoutRef.current != null) {
      clearTimeout(pendingPreviewTimeoutRef.current)
      pendingPreviewTimeoutRef.current = null
    }

    if (lastDropTimeoutRef.current != null) {
      clearTimeout(lastDropTimeoutRef.current)
      lastDropTimeoutRef.current = null
    }

    pendingRafRef.current.forEach((id) => cancelAnimationFrame(id))
    pendingRafRef.current = []
  }, [])

  /**
   * Play FLIP animation for a layout delta with cost-aware durations and cleanup.
   */
  const playFLIP = useCallback(
    (
      firstRects: Record<string, Rect>,
      lastRects: Record<string, Rect>,
      options: {
        duration?: number
        easing?: string
        delayMap?: Record<string, number>
      } = {},
    ) => {
      if (reducedMotion) {
        Object.keys(lastRects).forEach((id) => {
          const el = itemInnerRefs.current[id]
          if (!el) return
          el.style.transition = 'none'
          el.style.transform = ''
          el.style.opacity = '1'
          el.style.willChange = ''
        })
        return
      }

      const baseDuration = options.duration ?? animation?.duration ?? DEFAULT_BASE_DURATION
      const easing = options.easing ?? animation?.easing ?? DEFAULT_EASING
      const delayMap = options.delayMap || {}

      flushCleanup(animCleanupRef.current)

      const entries: Array<{
        id: string
        el: HTMLElement
        dx: number
        dy: number
        sx: number
        sy: number
        dynDuration: number
        delay: number
      }> = []

      Object.keys(lastRects).forEach((id) => {
        const el = itemInnerRefs.current[id]
        const first = firstRects[id]
        const last = lastRects[id]
        if (!el || !first || !last) return

        const dx = Math.round(first.left - last.left)
        const dy = Math.round(first.top - last.top)
        const sx = last.width > 0 ? first.width / last.width : 1
        const sy = last.height > 0 ? first.height / last.height : 1

        if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON && Math.abs(1 - sx) < SCALE_EPSILON && Math.abs(1 - sy) < SCALE_EPSILON) {
          return
        }

        const movingDecision = computeMotionDecision(first, last, null, lastMotionVectorRef.current)
        const dynamicDuration = durationFromCost(baseDuration, movingDecision.cost)
        const delay = Math.max(0, safeNumber(delayMap[id], 0))

        entries.push({
          id,
          el,
          dx,
          dy,
          sx: Number.isFinite(sx) ? sx : 1,
          sy: Number.isFinite(sy) ? sy : 1,
          dynDuration: dynamicDuration,
          delay,
        })
      })

      if (!entries.length) return

      entries.forEach(({ el, dx, dy, sx, sy }) => {
        el.style.transition = 'none'
        el.style.transformOrigin = '50% 50%'
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`
        el.style.opacity = '0.995'
        el.style.willChange = 'transform, opacity'
      })

      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          entries.forEach(({ id, el, dynDuration, delay }) => {
            const opacityDuration = Math.max(120, Math.round(dynDuration * 0.6))
            el.style.transition = `transform ${dynDuration}ms ${easing} ${delay}ms, opacity ${opacityDuration}ms ease-out ${delay}ms`
            el.style.transform = 'translate3d(0, 0, 0) scale(1, 1)'
            el.style.opacity = '1'

            let finished = false
            const cleanup = () => {
              if (finished) return
              finished = true
              try {
                el.removeEventListener('transitionend', onEnd)
              } catch {
                // noop
              }
              try {
                el.style.transition = ''
                el.style.willChange = ''
                el.style.transform = ''
                el.style.opacity = ''
                el.style.transformOrigin = ''
              } catch {
                // noop
              }
            }

            const onEnd = (ev: TransitionEvent) => {
              if (ev.propertyName && ev.propertyName !== 'transform') return
              cleanup()
            }

            el.addEventListener('transitionend', onEnd)

            const tid = window.setTimeout(cleanup, dynDuration + delay + 180)
            animCleanupRef.current[`flip-${id}`] = () => {
              try {
                el.removeEventListener('transitionend', onEnd)
              } catch {
                // noop
              }
              clearTimeout(tid)
              cleanup()
            }
          })
        })
        pendingRafRef.current.push(raf2)
      })

      pendingRafRef.current.push(raf1)
    },
    [animation?.duration, animation?.easing, computeMotionDecision, durationFromCost, reducedMotion],
  )

  /**
   * Resolve the style of a grid item using the live preview layout when available.
   */
  const posToStyle = useCallback(
    (node: GridItem, sourceLayout?: ReadonlyArray<GridItem> | null): StyleResult => {
      const px = getPxHelpers()
      const layoutSource = sourceLayout ?? (previewMode === PreviewMode.Live || previewMode === PreviewMode.Reverting ? previewCommittedLayout : null)
      const item = getLayoutEntry(layoutSource, node.i) || node
      const rect = gridItemToRect(item, px)

      const isPreviewActive = Boolean(previewCommittedLayout && (previewMode === PreviewMode.Live || previewMode === PreviewMode.Reverting))
      const baseDuration = isPreviewActive ? animation?.duration ?? DEFAULT_BASE_DURATION : Math.max(180, Math.round((animation?.duration ?? DEFAULT_BASE_DURATION) * 0.85))
      const easing = animation?.easing ?? DEFAULT_EASING
      const isDragged = grid.overlay?.i === node.i

      return {
        transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transition: isDragged
          ? 'none'
          : `transform ${baseDuration}ms ${easing}, width ${baseDuration}ms ${easing}, height ${baseDuration}ms ${easing}, opacity ${Math.max(120, Math.round(baseDuration * 0.65))}ms ease`,
        willChange: isDragged ? 'transform' : 'transform, width, height',
      }
    },
    [animation?.duration, animation?.easing, getPxHelpers, grid.overlay?.i, previewCommittedLayout, previewMode],
  )

  /**
   * Compute a preview style from a target layout.
   */
  const previewStyleFor = useCallback(
    (node: GridItem, px: PxHelpers, sourceLayout: ReadonlyArray<GridItem> | null): StyleResult => {
      const found = getLayoutEntry(sourceLayout, node.i)
      if (!found) return posToStyle(node, sourceLayout)
      const rect = gridItemToRect(found, px)
      const baseDuration = animation?.duration ?? DEFAULT_BASE_DURATION
      const easing = animation?.easing ?? DEFAULT_EASING
      return {
        transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transition: `transform ${baseDuration}ms ${easing}, width ${baseDuration}ms ${easing}, height ${baseDuration}ms ${easing}`,
        willChange: 'transform, width, height',
      }
    },
    [animation?.duration, animation?.easing, posToStyle],
  )

  /**
   * Handle drag start with pointer capture and snapshotting.
   */
  const handleHeaderPointerDown = useCallback(
    (e: ReactPointerEvent, node: GridItem) => {
      if (!isDraggable || node.static) return
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId)
      } catch {
        // noop
      }

      // Clear any pending drop-settle state from a previous interaction
      clearMotionArtifacts()
      setPreviewCommittedLayout(null)
      setPreviewMode(null)
      saveDragSnapshot()
      lastPointerRef.current = { x: safeNumber(e.clientX), y: safeNumber(e.clientY), time: typeof performance !== 'undefined' ? performance.now() : Date.now() }
      lastMotionVectorRef.current = null

      const pxHelpers = getPxHelpers()
      grid.startDrag(e, node, pxHelpers)
    },
    [clearMotionArtifacts, getPxHelpers, grid, isDraggable, saveDragSnapshot],
  )

  /**
   * Handle resize start with pointer capture and snapshotting.
   */
  const handleResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, node: GridItem, corner: string) => {
      if (!isResizable || node.static) return
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId)
      } catch {
        // noop
      }

      // Clear any pending drop-settle state from a previous interaction
      clearMotionArtifacts()
      setPreviewCommittedLayout(null)
      setPreviewMode(null)
      saveDragSnapshot()
      lastPointerRef.current = { x: safeNumber(e.clientX), y: safeNumber(e.clientY), time: typeof performance !== 'undefined' ? performance.now() : Date.now() }
      lastMotionVectorRef.current = null

      const pxHelpers = getPxHelpers()
      grid.startResize(e, node, corner, pxHelpers)
    },
    [clearMotionArtifacts, getPxHelpers, grid, isResizable, saveDragSnapshot],
  )

  /**
   * Handle pointer move and keep motion metadata updated.
   */
  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      updatePointerMotion(e)
      grid.onPointerMove(e)
    },
    [grid, updatePointerMotion],
  )

  /**
   * Revert the last interaction using the captured drag snapshot.
   */
  const handlePointerCancel = useCallback(() => {
    grid.cancelInteraction?.()

    const original = dragSnapshotRef.current
    const preview = lastCommittedLayoutRef.current
    if (!original || !preview) {
      setPreviewCommittedLayout(null)
      setPreviewMode(null)
      clearMotionArtifacts()
      return
    }

    const ids = unionIds(preview, original)
    const firstRects = measureRects(ids)

    setPreviewCommittedLayout(preview)
    setPreviewMode(PreviewMode.Reverting)

    const raf1 = requestAnimationFrame(() => {
      setPreviewCommittedLayout(original)
      const raf2 = requestAnimationFrame(() => {
        const lastRects = measureRects(ids)
        const draggedId = grid.overlay?.i ?? null
        if (draggedId) {
          delete firstRects[draggedId]
          delete lastRects[draggedId]
        }

        playFLIP(firstRects, lastRects, {
          duration: animation?.duration ?? DEFAULT_BASE_DURATION,
          easing: animation?.easing ?? DEFAULT_EASING,
        })

        pendingPreviewTimeoutRef.current = window.setTimeout(() => {
          setPreviewCommittedLayout(null)
          setPreviewMode(null)
          dragSnapshotRef.current = null
          lastCommittedLayoutRef.current = null
          clearMotionArtifacts()
        }, Math.max(160, (animation?.duration ?? DEFAULT_BASE_DURATION) + 40))
        pendingRafRef.current.push(raf2)
      })
      pendingRafRef.current.push(raf1)
    })
  }, [animation?.duration, animation?.easing, clearMotionArtifacts, grid, measureRects, playFLIP])

  /**
   * Handle pointer up: commit and cleanup.
   *
   * We defer clearing the preview state by one frame so that items transition
   * smoothly from their preview positions to the final committed positions
   * instead of snapping instantly (which causes the flash/jump).
   */
  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const droppedId = grid.overlay?.i ?? null
      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId)
      } catch {
        // noop
      }

      grid.endInteraction(e)

      if (droppedId) {
        setLastDropId(droppedId)
        if (lastDropTimeoutRef.current != null) {
          clearTimeout(lastDropTimeoutRef.current)
        }
        lastDropTimeoutRef.current = window.setTimeout(() => setLastDropId(null), Math.max(160, (animation?.duration ?? DEFAULT_BASE_DURATION) + 40))
      }

      // Defer preview cleanup by two frames so the CSS transitions on .gridItem
      // can interpolate between the last preview position and the committed position.
      // This prevents the flash caused by the preview being removed in the same
      // frame that items re-render at their final positions.
      dragSnapshotRef.current = null
      lastCommittedLayoutRef.current = null

      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          setPreviewCommittedLayout(null)
          setPreviewMode(null)
          clearMotionArtifacts()
        })
        pendingRafRef.current.push(raf2)
      })
      pendingRafRef.current.push(raf1)
    },
    [animation?.duration, clearMotionArtifacts, grid],
  )

  /**
   * Apply CSS variables to keep the background grid perfectly aligned with the grid math.
   */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const applyCssVars = () => {
      const px = getPxHelpers()
      // Cachear pxHelpers para que visibleItems no llame clientWidth en cada render
      pxHelpersRef.current = px
      const cellW = Math.round(px.colWidth + px.marginX)
      const cellH = Math.round(px.rowHeight + px.marginY)
      const padX = safeNumber(px.containerPadding?.[0], 0)
      const padY = safeNumber(px.containerPadding?.[1], 0)

      el.style.setProperty('--gs-cell-w', `${cellW}px`)
      el.style.setProperty('--gs-cell-h', `${cellH}px`)
      el.style.setProperty('--gs-offset-x', `${padX}px`)
      el.style.setProperty('--gs-offset-y', `${padY}px`)
      el.style.setProperty('--gs-grid-color', 'rgba(15,23,42,0.04)')
      el.style.setProperty('--gs-grid-line', '1px')
    }

    applyCssVars()

    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = new ResizeObserver(() => {
      applyCssVars()
      setContainerVersion((v) => v + 1)
    })

    resizeObserverRef.current.observe(el)
    const onWindowResize = () => applyCssVars()
    window.addEventListener('resize', onWindowResize)

    return () => {
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      window.removeEventListener('resize', onWindowResize)
    }
  }, [containerPadding, cols, getPxHelpers, margin, rowHeight])

  /**
   * React to committed layout changes emitted by the grid engine.
   * The preview layout is treated as the authoritative visual target during interaction.
   */
  useLayoutEffect(() => {
    const committed = grid.overlay?.committedLayout ?? null
    if (!committed || !committed.length) return

    const committedSignature = layoutSignature(committed)
    if (committedSignature && committedSignature === lastAppliedSignatureRef.current) {
      return
    }

    const currentLayout = grid.layout
    const ids = unionIds(currentLayout, committed)
    const firstRects = measureRects(ids)

    setPreviewCommittedLayout(committed)
    setPreviewMode(PreviewMode.Live)
    lastCommittedLayoutRef.current = committed
    lastCommittedSignatureRef.current = committedSignature
    lastAppliedSignatureRef.current = committedSignature

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        const lastRects = measureRects(ids)
        const draggedId = grid.overlay?.i ?? null

        if (draggedId) {
          delete firstRects[draggedId]
          delete lastRects[draggedId]
        }

        // Ignore tiny deltas to suppress jitter near collision boundaries.
        const stableIds = Object.keys(lastRects).filter((id) => {
          const a = firstRects[id]
          const b = lastRects[id]
          if (!a || !b) return false
          return Math.hypot(a.left - b.left, a.top - b.top) >= JITTER_THRESHOLD_PX || Math.abs(a.width - b.width) >= 1 || Math.abs(a.height - b.height) >= 1
        })

        if (stableIds.length) {
          const filteredFirst: Record<string, Rect> = {}
          const filteredLast: Record<string, Rect> = {}
          stableIds.forEach((id) => {
            filteredFirst[id] = firstRects[id]
            filteredLast[id] = lastRects[id]
          })

          const softMap = computeSoftDisplacement(filteredFirst, filteredLast, draggedId)
          const delayMap: Record<string, number> = {}
          Object.entries(softMap).forEach(([id, motion]) => {
            delayMap[id] = motion.delay
          })

          playFLIP(filteredFirst, filteredLast, {
            duration: animation?.duration ?? DEFAULT_BASE_DURATION,
            easing: animation?.easing ?? DEFAULT_EASING,
            delayMap,
          })

          if (enableRollOnPush) {
            const rollMap = computeRollMap(currentLayout, committed, draggedId)
            Object.entries(rollMap).forEach(([id, payload]) => {
              const el = itemInnerRefs.current[id]
              if (!el) return
              const rotateStr = payload.axis === 'y' ? `rotateX(${payload.angle}deg)` : `rotateY(${payload.angle}deg)`
              el.style.transition = `transform ${rollDuration}ms cubic-bezier(.2,.9,.25,1) ${payload.delay}ms`
              el.style.transform = rotateStr
              el.style.transformOrigin = '50% 50%'
              const tid = window.setTimeout(() => {
                try {
                  el.style.transition = ''
                  el.style.transform = ''
                  el.style.transformOrigin = ''
                } catch {
                  // noop
                }
              }, rollDuration + payload.delay + 40)
              animCleanupRef.current[`roll-${id}`] = () => clearTimeout(tid)
            })
          }
        }
      })
      pendingRafRef.current.push(raf2)
    })
    pendingRafRef.current.push(raf1)

    return () => {
      // keep current preview state until the next frame; clear only when replaced by a new commit.
    }
  }, [
    animation?.duration,
    animation?.easing,
    computeRollMap,
    computeSoftDisplacement,
    enableRollOnPush,
    grid.layout,
    grid.overlay?.committedLayout,
    grid.overlay?.i,
    measureRects,
    playFLIP,
  ])

  /**
   * Escape key should revert the in-flight interaction.
   */
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') handlePointerCancel()
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [handlePointerCancel])

  /**
   * Keep cleanup on unmount to avoid stray inline transforms.
   */
  useEffect(() => {
    return () => {
      clearMotionArtifacts()
      flushCleanup(animCleanupRef.current)
      if (resizeObserverRef.current) {
        try {
          resizeObserverRef.current.disconnect()
        } catch {
          // noop
        }
        resizeObserverRef.current = null
      }
    }
  }, [clearMotionArtifacts])

  const layoutForMetrics = previewCommittedLayout ?? grid.layout
  const highestRow = Math.max(1, ...layoutForMetrics.map((l) => safeNumber(l.y) + safeNumber(l.h)))
  const gridHeight = Math.max(200, (safeNumber(rowHeight, 30) + safeNumber(margin?.[1], 0)) * highestRow + 40)
  const gridClassName = `${styles.grid} ${grid.overlay ? styles.gridDragging : ''}`
  const containerClassName = `${styles.container} ${showGrid ? styles.showGrid : ''}`

  const draggedNodeId = grid.overlay?.i ?? null
  const draggedItemData = useMemo(
    () => items.find((it) => it.id === draggedNodeId) || null,
    [draggedNodeId, items],
  )

  const currentRollMap = useMemo<Record<string, { deltaRows: number; angle: number; delay: number; axis: 'x' | 'y' }>>(() => {
    if (!enableRollOnPush || !previewCommittedLayout || !draggedNodeId) return {}
    return computeRollMap(grid.layout, previewCommittedLayout, String(draggedNodeId))
  }, [computeRollMap, draggedNodeId, enableRollOnPush, grid.layout, previewCommittedLayout])

  const visibleItems = useMemo<Array<{
    node: GridItem
    ItemComp: any
    itemData: any
    isBeingDragged: boolean
    style: StyleResult
    className: string
  }>>(() => {
    return grid.layout.map((node) => {
      // Usar pxHelpersRef en lugar de getPxHelpers() para evitar clientWidth en cada render
      const px = pxHelpersRef.current ?? getPxHelpers()
      const isBeingDragged = draggedNodeId === node.i
      const ItemComp = componentMap[node.i] || null
      const itemData = items.find((it) => it.id === node.i) || {}

      let style = posToStyle(node)
      const classNames = [
        styles.gridItem,
        node.static ? styles.static : '',
        isBeingDragged ? styles.draggingItem : '',
        lastDropId === node.i ? styles.dropSuccess : '',
      ]

      if (previewCommittedLayout && previewMode === PreviewMode.Live && !isBeingDragged) {
        style = previewStyleFor(node, px, previewCommittedLayout)
        classNames.push(styles.previewMoving)
      } else if (previewMode === PreviewMode.Reverting && previewCommittedLayout && !isBeingDragged) {
        classNames.push(styles.previewReverting)
      }

      const roll = currentRollMap[node.i]
      if (roll && !isBeingDragged) {
        style = {
          ...style,
          transform: `${style.transform} ${roll.axis === 'y' ? `rotateX(${roll.angle}deg)` : `rotateY(${roll.angle}deg)`}`,
          transition: `${style.transition}, transform ${rollDuration}ms cubic-bezier(.2,.9,.25,1) ${roll.delay}ms`,
          willChange: 'transform, width, height',
        }
      }

      return {
        node,
        ItemComp,
        itemData,
        isBeingDragged,
        style,
        className: classNames.filter(Boolean).join(' '),
      }
    })
  }, [
    componentMap,
    currentRollMap,
    draggedNodeId,
    items,
    lastDropId,
    posToStyle,
    previewCommittedLayout,
    previewMode,
    previewStyleFor,
    rollDuration,
    getPxHelpers,
    grid.layout,
    containerVersion,
  ])

  // ─── Stable ref callback factory ──────────────────────────────────────────
  // Avoids creating a new function per item per render for the inner ref.
  const getItemRefCallback = useCallback(
    (nodeId: string) => (el: HTMLElement | null) => {
      if (el) itemInnerRefs.current[nodeId] = el
      else delete itemInnerRefs.current[nodeId]
    },
    [],
  )

  // ─── Stable per-item ref callbacks (memoized map) ───────────────────────
  const itemRefCallbacks = useMemo(() => {
    const map: Record<string, (el: HTMLElement | null) => void> = {}
    grid.layout.forEach((node) => {
      map[node.i] = getItemRefCallback(node.i)
    })
    return map
  }, [grid.layout, getItemRefCallback])

  // ─── Stable per-item pointerDown callbacks ──────────────────────────────
  const itemPointerDownCallbacks = useMemo(() => {
    const map: Record<string, (e: ReactPointerEvent<HTMLDivElement>) => void> = {}
    grid.layout.forEach((node) => {
      map[node.i] = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!isDraggable || node.static) return
        if ((e.target as HTMLElement | null)?.closest('[data-resize-handle]')) return
        updatePointerMotion(e as ReactPointerEvent<HTMLElement>)
        handleHeaderPointerDown(e, node)
      }
    })
    return map
  }, [grid.layout, isDraggable, updatePointerMotion, handleHeaderPointerDown])

  // ─── Stable per-item resize pointerDown callbacks ───────────────────────
  const itemResizeCallbacks = useMemo(() => {
    const map: Record<string, (e: React.PointerEvent, corner: Corner) => void> = {}
    grid.layout.forEach((node) => {
      map[node.i] = (e: React.PointerEvent, corner: Corner) => {
        updatePointerMotion(e as ReactPointerEvent<HTMLElement>)
        handleResizePointerDown(e as ReactPointerEvent<HTMLDivElement>, node, corner)
      }
    })
    return map
  }, [grid.layout, updatePointerMotion, handleResizePointerDown])

  return (
    <div
      className={containerClassName}
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      onContextMenu={(e) => {
        e.preventDefault()
      }}
      data-container-version={containerVersion}
    >
      <div className={gridClassName} style={{ height: gridHeight, transition: 'height 0.3s ease-out' }}>
        {visibleItems.map(({ node, ItemComp, itemData, isBeingDragged, style, className }) => (
          <GridItemNode
            key={node.i}
            nodeId={node.i}
            style={style}
            className={className}
            radio={radio}
            isBeingDragged={isBeingDragged}
            isDraggable={isDraggable}
            isResizable={isResizable}
            isStatic={!!node.static}
            ItemComp={ItemComp}
            componentProps={itemData.component || EMPTY_PROPS}
            onPointerDown={itemPointerDownCallbacks[node.i]}
            onResizePointerDown={itemResizeCallbacks[node.i]}
            itemInnerRefCb={itemRefCallbacks[node.i]}
          />
        ))}
      </div>

      {grid.overlay?.targetGrid && (
        <DropIndicator
          target={grid.overlay.targetGrid}
          pxHelpers={getPxHelpers()}
          animation={animation}
          radio={radio}
        />
      )}

      <DragLayer overlay={grid.overlay as Overlay} animation={animation}>
        {draggedNodeId && (() => {
          const Comp = componentMap[draggedNodeId] as React.ComponentType<any> | null || null
          const data = draggedItemData?.component || {}
          if (!Comp) {
            return (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {draggedItemData?.title || draggedNodeId}
              </div>
            )
          }
          return (
            <div style={{ width: '100%', height: '100%' }}>
              <Comp {...data} />
            </div>
          )
        })()}
      </DragLayer>
    </div>
  )
}

GridStack.defaultProps = {
  items: [],
  cols: 12,
  rowHeight: 30,
  margin: [20, 20],
  containerPadding: [10, 10],
  isDraggable: true,
  isResizable: true,
  preventCollision: true,
  onLayoutChange: () => { },
  componentMap: {},
  dragMode: 'overlay',
  collisionMode: 'push',
  animation: { duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)' },
  dragThrottleMs: 0,
  allowOverlapDuringDrag: false,
  animateOnDrop: true,
  overlayAnchor: 'grab',
  snapEnabled: true,
  snapThreshold: 12,
  showGrid: false,
  enableRollOnPush: false,
  rollAngleMax: 20,
  rollDuration: 320,
  rollStagger: 30,
}
