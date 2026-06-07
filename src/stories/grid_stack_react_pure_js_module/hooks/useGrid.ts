// src/hooks/useGrid.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveCollision, findPlacementBFS } from '../utils/collision';
import { cloneLayout } from '../utils/grid-utils';
import {
  collisionModeType,
  DragStateType,
  overlayAnchorType,
  PxHelpers,
  UseGridOptions,
} from '../types/useGrid.types';
import { GridItem, Overlay } from '../types/types';

const POINTER_CAPTURE_RETRY = 3;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PointerSnapshot {
  clientX: number;
  clientY: number;
  pointerId: number;
}

type OverlayOffset = number | { x?: number; y?: number };

const rectsOverlap = (
  a: Rect | null | undefined,
  b: Rect | null | undefined
): boolean => {
  if (!a || !b) return false;
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeOverlayOffset = (offset?: OverlayOffset) => {
  if (typeof offset === 'number') {
    return { x: offset, y: offset };
  }
  return {
    x: toNumber(offset?.x, 0),
    y: toNumber(offset?.y, 0),
  };
};

const normalizeNode = (node: Partial<GridItem>, idx = 0): GridItem => ({
  i: node.i ?? node.id ?? `auto-${idx}`,
  x: toNumber(node.x, 0),
  y: toNumber(node.y, 0),
  w: Math.max(1, toNumber(node.w, 3)),
  h: Math.max(1, toNumber(node.h, 4)),
  static: !!node.static,
});

/**
 * Ensure no overlap with optional upward "sticky" compaction.
 */
const ensureNoOverlap = (
  inputLayout: GridItem[] = [],
  cols = 12,
  reflowMaxDepth = 8,
  sticky = false
): GridItem[] => {
  const layout = (inputLayout || []).map((l) => ({ ...l }));
  layout.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  const placed: GridItem[] = [];

  for (const node of layout) {
    let candidate = { ...node };
    let attempts = 0;

    while (placed.some((p) => rectsOverlap(p, candidate)) && attempts < 400) {
      candidate = { ...candidate, y: candidate.y + 1 };
      attempts += 1;

      if (candidate.x + candidate.w > cols) {
        candidate.x = Math.max(0, cols - candidate.w);
      }
    }

    if (attempts >= 400) {
      const others = placed.map((p) => ({ ...p }));
      const fallback = findPlacementBFS(others, candidate, cols, reflowMaxDepth);

      if (fallback) {
        candidate = { ...fallback, i: candidate.i } as GridItem;
      } else {
        candidate.y = Math.max(0, candidate.y);
        candidate.x = Math.max(0, Math.min(cols - candidate.w, candidate.x));
      }
    }

    placed.push(candidate);
  }

  const byId = new Map(placed.map((p) => [p.i, p]));
  const out = inputLayout.map((orig) => ({ ...(byId.get(orig.i) || orig) }));

  if (sticky) {
    try {
      // eslint-disable-next-line global-require
      const { compactUp } = require('../utils/collision');
      const compacted = compactUp(out, cols);
      const byId2 = new Map(compacted.map((p: GridItem) => [p.i, p]));
      return inputLayout.map((orig) => ({ ...(byId2.get(orig.i) || orig) })) as GridItem[];
    } catch {
      return out;
    }
  }

  return out;
};

/**
 * Greedy cascade shift:
 * tries to relocate overlapping items near their original position.
 */
const cascadeSmartShift = (
  others: GridItem[] = [],
  candidate: GridItem,
  cols = 12,
  maxDepth = 6
): GridItem[] | null => {
  if (!candidate) return null;

  const layout = others.map((n) => ({ ...n }));
  const byId = new Map(layout.map((n) => [n.i, n]));

  const overlaps = (a: Rect, b: Rect) => {
    if (!a || !b) return false;
    return !(
      a.x + a.w <= b.x ||
      b.x + b.w <= a.x ||
      a.y + a.h <= b.y ||
      b.y + b.h <= a.y
    );
  };

  const canPlaceAt = (node: GridItem, arr: GridItem[]) =>
    !arr.some((p) => p.i !== node.i && overlaps(p, node));

  const clampX = (x: number, w: number) => clamp(Math.floor(x), 0, Math.max(0, cols - w));

  const findNearestHorizontal = (node: GridItem, arr: GridItem[]) => {
    const maxX = Math.max(0, cols - node.w);
    const originX = clampX(node.x, node.w);

    for (let r = 0; r <= cols; r++) {
      const candidates: number[] = [];
      const left = originX - r;
      const right = originX + r;

      if (left >= 0) candidates.push(left);
      if (right <= maxX && right !== left) candidates.push(right);

      for (const cx of candidates) {
        const test = { ...node, x: cx };
        if (canPlaceAt(test, arr)) return test;
      }

      if (originX - r < 0 && originX + r > maxX) break;
    }

    return null;
  };

  const findPlaceWithVertical = (
    item: GridItem,
    arr: GridItem[],
    maxD: number
  ) => {
    const origY = item.y;

    const sameRow = findNearestHorizontal({ ...item, y: origY }, arr);
    if (sameRow) return sameRow;

    for (let d = 1; d <= maxD; d++) {
      const ys = [origY + d, origY - d];
      for (const yTry of ys) {
        if (yTry < 0) continue;
        const res = findNearestHorizontal({ ...item, y: yTry }, arr);
        if (res) return res;
      }
    }

    return null;
  };

  layout.push({ ...candidate, i: candidate.i });

  const queue: Array<string | number> = [];
  for (const p of layout) {
    if (p.i === candidate.i) continue;
    if (overlaps(p, candidate)) queue.push(p.i);
  }

  const processed = new Set<string | number>();

  while (queue.length) {
    const id = queue.shift()!;
    if (processed.has(id)) continue;
    processed.add(id);

    const item = byId.get(id);
    if (!item) continue;

    const othersSnapshot = layout.filter((x) => x.i !== id);
    const found = findPlaceWithVertical(item, othersSnapshot, maxDepth);

    if (!found) return null;

    const idx = layout.findIndex((x) => x.i === id);
    if (idx >= 0) layout[idx] = { ...found, i: id };
    else layout.push({ ...found, i: id });

    byId.set(id, layout[idx] || layout.find((x) => x.i === id)!);

    const moved = layout[idx] || layout.find((x) => x.i === id)!;
    for (const p of layout) {
      if (p.i === id) continue;
      if (overlaps(p, moved) && !processed.has(p.i)) {
        queue.push(p.i);
      }
    }
  }

  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      if (overlaps(layout[i], layout[j])) return null;
    }
  }

  return layout;
};

export function useGrid({
  items = [],
  cols = 12,
  preventCollision = true,
  collisionMode = collisionModeType.push,
  dragThrottleMs = 0,
  onLayoutChange = () => {},
  allowOverlapDuringDrag = false,
  animateOnDrop = true,
  collisionSolverOpts = {},
  overlayAnchor = overlayAnchorType.grab,
  reflowDuringDrag = true,
  reflowMaxDepth = 8,
  reflowSymmetry = true,
  snapEnabled = true,
  sticky = false,
  snapThreshold = 0,
  dragOverlayOffset = 0,
}: UseGridOptions & { dragOverlayOffset?: OverlayOffset } = {}) {
  const overlayOffset = normalizeOverlayOffset(dragOverlayOffset);

  const initial = ensureNoOverlap(
    (items || []).map((it: GridItem, idx) => normalizeNode(it, idx)),
    cols,
    reflowMaxDepth,
    sticky
  );

  const [layout, setLayout] = useState<GridItem[]>(initial);
  const layoutRef = useRef(layout);
  // Track the last layout WE committed internally, to avoid circular resets
  const lastInternalCommitRef = useRef<string>('');

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const dragState = useRef<DragStateType | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastThrottleRef = useRef(0);

  useEffect(() => {
    // Build a signature of incoming items to detect external changes
    const normalized = (items || []).map((it, idx) => normalizeNode(it, idx));
    const incomingSignature = normalized
      .map((n) => `${n.i}:${n.x},${n.y},${n.w},${n.h}`)
      .sort()
      .join('|');

    // If the incoming items match what we last committed, skip the reset.
    // This prevents the circular: commit → onLayoutChange → parent updates items → useEffect resets layout
    if (incomingSignature === lastInternalCommitRef.current) {
      return;
    }

    const resolved = ensureNoOverlap(normalized, cols, reflowMaxDepth, sticky);
    setLayout(resolved);
  }, [items]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const commitLayout = useCallback(
    (nextLayout: GridItem[]) => {
      const bounded = cloneLayout(nextLayout).map((n) => {
        const out = { ...n };

        if (out.x < 0) out.x = 0;
        if (out.y < 0) out.y = 0;
        if (out.x + out.w > cols) out.x = Math.max(0, cols - out.w);

        return out;
      }) as GridItem[];

      const fixed = ensureNoOverlap(bounded, cols, reflowMaxDepth, sticky);

      // Store signature of what we're committing so the items sync useEffect
      // won't reset our own committed layout back to the old positions.
      lastInternalCommitRef.current = fixed
        .map((n) => `${n.i}:${n.x},${n.y},${n.w},${n.h}`)
        .sort()
        .join('|');

      setLayout(fixed);
      onLayoutChange(fixed);
    },
    [cols, onLayoutChange, reflowMaxDepth, sticky]
  );

  const schedule = useCallback(
    (fn: () => void) => {
      if (dragThrottleMs > 0) {
        const now = Date.now();
        if (now - lastThrottleRef.current >= dragThrottleMs) {
          lastThrottleRef.current = now;
          fn();
        }
        return;
      }

      if (rafRef.current) return;

      rafRef.current = requestAnimationFrame(() => {
        fn();
        rafRef.current = null;
      });
    },
    [dragThrottleMs]
  );

  const pxToGrid = useCallback(
    (pxValue: number, pxHelpers: PxHelpers, isVertical = false) => {
      const offset = isVertical
        ? pxHelpers.containerPadding[1]
        : pxHelpers.containerPadding[0];
      const cell = isVertical ? pxHelpers.rowHeight : pxHelpers.colWidth;
      const gap = isVertical ? pxHelpers.marginY : pxHelpers.marginX;
      const effective = pxValue - offset;
      const grid = effective / (cell + gap);

      if (!snapEnabled) return Math.max(0, grid);

      const floored = Math.floor(grid);
      const fraction = grid - floored;
      const thresholdNorm = clamp(snapThreshold, 0, 1);
      const shouldIncrement = thresholdNorm > 0 && fraction >= 1 - thresholdNorm;

      return Math.max(0, shouldIncrement ? floored + 1 : floored);
    },
    [snapEnabled, snapThreshold]
  );

  const gridToPx = useCallback(
    (gridPos: number, pxHelpers: PxHelpers, isVertical = false) => {
      const offset = isVertical
        ? pxHelpers.containerPadding[1]
        : pxHelpers.containerPadding[0];
      const cell = isVertical ? pxHelpers.rowHeight : pxHelpers.colWidth;
      const gap = isVertical ? pxHelpers.marginY : pxHelpers.marginX;
      return offset + gridPos * (cell + gap);
    },
    []
  );

  const validateBounds = useCallback(
    (node: GridItem) => {
      const out = { ...node };
      if (out.x < 0) out.x = 0;
      if (out.y < 0) out.y = 0;
      if (out.x + out.w > cols) out.x = Math.max(0, cols - out.w);
      return out;
    },
    [cols]
  );

  const cancelInteraction = useCallback(() => {
    dragState.current = null;
    setOverlay(null);
  }, []);

  const startDrag = useCallback(
    (e: React.PointerEvent, node: GridItem, pxHelpers: PxHelpers) => {
      if (!node || node.static) return;

      const pointerId = e.pointerId;

      for (let i = 0; i < POINTER_CAPTURE_RETRY; i++) {
        try {
          e.currentTarget?.setPointerCapture?.(pointerId);
          break;
        } catch (err) {
          if (i === POINTER_CAPTURE_RETRY - 1) {
            console.warn('Pointer capture failed on drag start', err);
          }
        }
      }

      const leftGridPx = pxHelpers.gridToPx(node.x);
      const topGridPx = pxHelpers.gridToPx(node.y, true);
      const widthPx = pxHelpers.widthPx(node.w);
      const heightPx = pxHelpers.heightPx(node.h);
      const containerRect = pxHelpers.containerRect || { left: 0, top: 0 };

      let grabOffsetX: number;
      let grabOffsetY: number;

      if (overlayAnchor === 'center') {
        grabOffsetX = widthPx / 2;
        grabOffsetY = heightPx / 2;
      } else {
        grabOffsetX = e.clientX - (containerRect.left + leftGridPx);
        grabOffsetY = e.clientY - (containerRect.top + topGridPx);
      }

      dragState.current = {
        pointerId,
        type: 'drag',
        itemId: node.i,
        orig: { ...node },
        grabOffsetX,
        grabOffsetY,
        pxHelpers,
        containerRect,
      } as DragStateType;

      setOverlay({
        i: node.i,
        pxLeft: leftGridPx,
        pxTop: topGridPx,
        widthPx,
        heightPx,
        committedLayout: cloneLayout(layoutRef.current),
        targetGrid: { x: node.x, y: node.y, w: node.w, h: node.h } as GridItem,
      });
    },
    [overlayAnchor]
  );

  const startResize = useCallback(
    (
      e: React.PointerEvent,
      node: GridItem,
      corner: string | undefined,
      pxHelpers: PxHelpers
    ) => {
      if (!node || node.static) return;

      const actualCorner = corner ?? 'se';

      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId);
      } catch (err) {
        console.warn('Pointer capture failed on resize start', err);
      }

      dragState.current = {
        pointerId: e.pointerId,
        type: 'resize',
        itemId: node.i,
        orig: { ...node },
        corner: actualCorner,
        pxHelpers,
        containerRect: pxHelpers.containerRect || { left: 0, top: 0 },
        startClientX: e.clientX,
        startClientY: e.clientY,
      } as DragStateType;

      setOverlay({
        i: node.i,
        pxLeft: gridToPx(node.x, pxHelpers),
        pxTop: gridToPx(node.y, pxHelpers, true),
        widthPx: pxHelpers.widthPx(node.w),
        heightPx: pxHelpers.heightPx(node.h),
        committedLayout: cloneLayout(layoutRef.current),
        targetGrid: { x: node.x, y: node.y, w: node.w, h: node.h } as GridItem,
      });
    },
    [gridToPx]
  );

  const handleDragMove = useCallback(
    (point: PointerSnapshot, st: DragStateType) => {
      const { pxHelpers, containerRect, grabOffsetX, grabOffsetY, orig, itemId } = st;

      const pxLeft =
        point.clientX - (containerRect.left ?? 0) - grabOffsetX + overlayOffset.x;
      const pxTop =
        point.clientY - (containerRect.top ?? 0) - grabOffsetY + overlayOffset.y;

      const gridX = pxToGrid(pxLeft, pxHelpers);
      const gridY = pxToGrid(pxTop, pxHelpers, true);

      let candidate = validateBounds({ ...orig, x: gridX, y: gridY });

      if (!snapEnabled) {
        const base = cloneLayout(layoutRef.current);
        const idx = base.findIndex((n) => n.i === itemId);

        if (idx >= 0) {
          base[idx] = { ...base[idx], ...candidate };
        } else {
          base.push({ ...candidate, i: itemId });
        }

        setOverlay({
          i: itemId,
          pxLeft,
          pxTop,
          widthPx: pxHelpers.widthPx(candidate.w),
          heightPx: pxHelpers.heightPx(candidate.h),
          committedLayout: base,
          targetGrid: candidate,
          fallback: false,
        });

        return;
      }

      const rcOpts = {
        cols,
        collisionMode: preventCollision ? collisionMode : collisionModeType.none,
        allowOverlap: allowOverlapDuringDrag,
        maxDepth: reflowMaxDepth,
        reflow: reflowDuringDrag,
        reflowSymmetry,
        sticky,
        ...collisionSolverOpts,
      };

      const resolved = resolveCollision(layoutRef.current, candidate, rcOpts);

      if (resolved?.success) {
        const finalLayout = ensureNoOverlap(
          resolved.layout,
          cols,
          reflowMaxDepth,
          sticky
        );

        const targetItem = finalLayout.find((n) => n.i === itemId) || candidate;

        setOverlay({
          i: itemId,
          pxLeft,
          pxTop,
          widthPx: pxHelpers.widthPx(candidate.w),
          heightPx: pxHelpers.heightPx(candidate.h),
          committedLayout: finalLayout,
          targetGrid: targetItem,
        });

        return;
      }

      const others = layoutRef.current.filter((n) => n.i !== itemId);
      const smartPreview = cascadeSmartShift(
        others,
        { ...candidate, i: itemId },
        cols,
        reflowMaxDepth
      );

      if (smartPreview) {
        const preview = ensureNoOverlap(smartPreview, cols, reflowMaxDepth, sticky);

        setOverlay({
          i: itemId,
          pxLeft,
          pxTop,
          widthPx: pxHelpers.widthPx(candidate.w),
          heightPx: pxHelpers.heightPx(candidate.h),
          committedLayout: preview,
          targetGrid: preview.find((p) => p.i === itemId) || candidate,
          fallback: true,
        });
        return;
      }

      const fallback = findPlacementBFS(others, candidate, cols, reflowMaxDepth);

      if (fallback) {
        let preview = [...others.map((n) => ({ ...n })), { ...fallback, i: itemId }];
        preview = ensureNoOverlap(preview, cols, reflowMaxDepth, sticky);

        setOverlay({
          i: itemId,
          pxLeft,
          pxTop,
          widthPx: pxHelpers.widthPx(fallback.w),
          heightPx: pxHelpers.heightPx(fallback.h),
          committedLayout: preview,
          targetGrid: fallback,
          fallback: true,
        });
      } else {
        setOverlay({
          i: itemId,
          pxLeft,
          pxTop,
          widthPx: pxHelpers.widthPx(candidate.w),
          heightPx: pxHelpers.heightPx(candidate.h),
          committedLayout: cloneLayout(layoutRef.current),
          targetGrid: candidate,
          fallback: false,
        });
      }
    },
    [
      allowOverlapDuringDrag,
      collisionMode,
      collisionSolverOpts,
      cols,
      overlayOffset.x,
      overlayOffset.y,
      preventCollision,
      pxToGrid,
      reflowDuringDrag,
      reflowMaxDepth,
      snapEnabled,
      sticky,
      validateBounds,
    ]
  );

  const handleResizeMove = useCallback(
    (point: PointerSnapshot, st: DragStateType) => {
      const { pxHelpers, startClientX, startClientY, orig, corner, itemId } = st;

      const dx = point.clientX - startClientX;
      const dy = point.clientY - startClientY;

      const deltaW = Math.round(dx / (pxHelpers.colWidth + pxHelpers.marginX));
      const deltaH = Math.round(dy / (pxHelpers.rowHeight + pxHelpers.marginY));

      let candidate = { ...orig };

      if (corner.includes('e')) candidate.w = Math.max(1, orig.w + deltaW);
      if (corner.includes('s')) candidate.h = Math.max(1, orig.h + deltaH);

      candidate = validateBounds(candidate);

      const rcOpts = {
        cols,
        collisionMode: preventCollision ? collisionMode : collisionModeType.none,
        allowOverlap: allowOverlapDuringDrag,
        maxDepth: reflowMaxDepth,
        reflow: reflowDuringDrag,
        reflowSymmetry,
        sticky,
        ...collisionSolverOpts,
      };

      const resolved = resolveCollision(layoutRef.current, candidate, rcOpts);

      if (resolved?.success) {
        const finalLayout = ensureNoOverlap(
          resolved.layout,
          cols,
          reflowMaxDepth,
          sticky
        );

        const targetItem = finalLayout.find((n) => n.i === itemId) || candidate;

        setOverlay({
          i: itemId,
          pxLeft: pxHelpers.gridToPx(targetItem.x),
          pxTop: pxHelpers.gridToPx(targetItem.y, true),
          widthPx: pxHelpers.widthPx(targetItem.w),
          heightPx: pxHelpers.heightPx(targetItem.h),
          committedLayout: finalLayout,
          targetGrid: targetItem,
        });

        return;
      }

      const others = layoutRef.current.filter((n) => n.i !== itemId);

      const smartPreview = cascadeSmartShift(
        others,
        { ...candidate, i: itemId },
        cols,
        reflowMaxDepth
      );

      if (smartPreview) {
        const preview = ensureNoOverlap(smartPreview, cols, reflowMaxDepth, sticky);
        const target = preview.find((p) => p.i === itemId) || candidate;

        setOverlay({
          i: itemId,
          pxLeft: pxHelpers.gridToPx(target.x),
          pxTop: pxHelpers.gridToPx(target.y, true),
          widthPx: pxHelpers.widthPx(target.w),
          heightPx: pxHelpers.heightPx(target.h),
          committedLayout: preview,
          targetGrid: target,
          fallback: true,
        });
        return;
      }

      const bfsPlace = findPlacementBFS(others, candidate, cols, reflowMaxDepth);

      if (bfsPlace) {
        let preview = [...others.map((n) => ({ ...n })), { ...bfsPlace, i: itemId }];
        preview = ensureNoOverlap(preview, cols, reflowMaxDepth, sticky);
        const target = preview.find((p) => p.i === itemId) || bfsPlace;

        setOverlay({
          i: itemId,
          pxLeft: pxHelpers.gridToPx(target.x),
          pxTop: pxHelpers.gridToPx(target.y, true),
          widthPx: pxHelpers.widthPx(target.w),
          heightPx: pxHelpers.heightPx(target.h),
          committedLayout: preview,
          targetGrid: target,
          fallback: true,
        });
        return;
      }

      setOverlay({
        i: itemId,
        pxLeft: pxHelpers.gridToPx(candidate.x),
        pxTop: pxHelpers.gridToPx(candidate.y, true),
        widthPx: pxHelpers.widthPx(candidate.w),
        heightPx: pxHelpers.heightPx(candidate.h),
        committedLayout: cloneLayout(layoutRef.current),
        targetGrid: candidate,
        fallback: false,
      });
    },
    [
      allowOverlapDuringDrag,
      collisionMode,
      collisionSolverOpts,
      cols,
      preventCollision,
      reflowDuringDrag,
      reflowMaxDepth,
      sticky,
      validateBounds,
    ]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const st = dragState.current;
      if (!st) return;
      if (typeof e.pointerId === 'number' && st.pointerId !== e.pointerId) return;

      const snapshot: PointerSnapshot = {
        clientX: e.clientX,
        clientY: e.clientY,
        pointerId: e.pointerId,
      };

      schedule(() => {
        const active = dragState.current;
        if (!active) return;
        if (active.type === 'drag') {
          handleDragMove(snapshot, active);
        } else if (active.type === 'resize') {
          handleResizeMove(snapshot, active);
        }
      });
    },
    [handleDragMove, handleResizeMove, schedule]
  );

  const endInteraction = useCallback(
    (e: React.PointerEvent) => {
      const st = dragState.current;

      if (st && typeof e?.pointerId === 'number') {
        try {
          e.currentTarget?.releasePointerCapture?.(e.pointerId);
        } catch (err) {
          console.warn('Failed to release pointer capture', err);
        }
      }

      dragState.current = null;

      try {
        const source = overlay?.committedLayout || layoutRef.current;
        const committed = ensureNoOverlap(
          cloneLayout(source),
          cols,
          reflowMaxDepth,
          sticky
        );
        commitLayout(committed);
      } catch (err) {
        console.error('Failed to commit layout after interaction', err);
        commitLayout(layoutRef.current);
      }

      if (animateOnDrop) {
        setTimeout(() => setOverlay(null), 40);
      } else {
        setOverlay(null);
      }
    },
    [animateOnDrop, cols, commitLayout, overlay, reflowMaxDepth, sticky]
  );

  return {
    layout,
    overlay,
    startDrag,
    startResize,
    onPointerMove,
    endInteraction,
    cancelInteraction,
    setLayout: commitLayout,
  };
}

export default {
  useGrid,
};