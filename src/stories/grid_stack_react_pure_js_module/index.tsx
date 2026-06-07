// File: GridStack.jsx
// Pure React (client) GridStack component with collision detection, drag & resize,
// responsive breakpoints, compacting, and smooth native animations.
// No external dependencies. Uses CSS modules for styling (GridStack.module.css).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './GridStack.module.css';

/* ------------------------- Utility functions ------------------------- */
const rectsCollide = (a, b) => {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
};

const findCollision = (layout, node) => layout.find((l) => l.i !== node.i && rectsCollide(l, node));

const cloneLayout = (layout) => layout.map((l) => ({ ...l }));

// Compact items vertically (push up) for given column count
const compactLayout = (layout, cols) => {
  // sort by y then x
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const out = [];
  for (const item of sorted) {
    const placed = { ...item };
    // make sure x within bounds
    if (placed.x + placed.w > cols) placed.x = Math.max(0, cols - placed.w);
    // try to move up while not colliding
    while (placed.y > 0) {
      const test = { ...placed, y: placed.y - 1 };
      const collision = out.find((o) => rectsCollide(o, test));
      if (collision) break;
      placed.y -= 1;
    }
    out.push(placed);
  }
  return out;
};

/* ------------------------- GridStack component ------------------------- */
export default function GridStack({
  items = [], // array of { id, x, y, w, h, static?, title?, component? }
  cols = 12,
  breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
  colsByBreakpoint = { lg: 12, md: 8, sm: 6, xs: 2, xxs: 1 },
  rowHeight = 30,
  margin = [20, 20], // [x,y] px between items
  containerPadding = [10, 10],
  isDraggable = true,
  isResizable = true,
  preventCollision = true,
  useCSSTransforms = true,
  onLayoutChange = () => {},
  onBreakpointChange = () => {},
  componentMap = {}, // map id -> React component as in the user's example
}) {
  // internal layout state in grid units
  const [layout, setLayout] = useState(() =>
    items.map((it) => ({
      i: it.id,
      x: it.x ?? 0,
      y: it.y ?? 0,
      w: it.w ?? 3,
      h: it.h ?? 4,
      static: !!it.static,
    }))
  );

  // track container width and breakpoint
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [bp, setBp] = useState('lg');
  const [colsInUse, setColsInUse] = useState(colsByBreakpoint.lg || cols);

  // sync layout when items prop changes
  useEffect(() => {
    setLayout(
      items.map((it) => ({ i: it.id, x: it.x ?? 0, y: it.y ?? 0, w: it.w ?? 3, h: it.h ?? 4, static: !!it.static }))
    );
  }, [items]);

  // Resize observer to compute width and breakpoint
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(0, entry.contentRect.width);
        setContainerWidth(w);
        // determine breakpoint (largest matching)
        const sorted = Object.entries(breakpoints).sort((a, b) => b[1] - a[1]);
        for (const [name, minWidth] of sorted) {
          if (w >= minWidth) {
            if (name !== bp) {
              setBp(name);
              const nextCols = colsByBreakpoint[name] ?? cols;
              setColsInUse(nextCols);
              onBreakpointChange(name, nextCols);
            }
            break;
          }
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // helper: grid cell width in px
  const colWidth = useMemo(() => {
    const totalMargin = margin[0] * (colsInUse - 1);
    const totalPadding = containerPadding[0] * 2;
    const w = Math.max(40, (containerWidth - totalMargin - totalPadding) / colsInUse);
    return w;
  }, [containerWidth, colsInUse, margin, containerPadding]);

  // convert grid position to pixel styles
  const posToStyle = (node) => {
    const left = Math.round((colWidth + margin[0]) * node.x + containerPadding[0]);
    const top = Math.round((rowHeight + margin[1]) * node.y + containerPadding[1]);
    const width = Math.round(colWidth * node.w + margin[0] * (node.w - 1));
    const height = Math.round(rowHeight * node.h + margin[1] * (node.h - 1));
    if (useCSSTransforms) {
      return {
        transform: `translate(${left}px, ${top}px)`,
        width: `${width}px`,
        height: `${height}px`,
      };
    }
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  };

  // low-level collision-resolving move when dragging/resizing if preventCollision true
  const resolveCollision = (moving, layoutSnapshot) => {
    if (!preventCollision) return moving;
    let node = { ...moving };
    // naive approach: if collision, try to push colliding item downwards until no collision
    let collision = findCollision(layoutSnapshot, node);
    const other = layoutSnapshot.filter((l) => l.i !== node.i);
    while (collision) {
      // push the other item down by the height of the moving node
      const target = layoutSnapshot.find((l) => l.i === collision.i);
      if (!target) break;
      // move target downwards
      target.y = node.y + node.h;
      // after pushing target, we must ensure target itself doesn't collide -> chain reaction
      // if target collides with others, push them further
      target.__pushed = true;
      collision = findCollision(layoutSnapshot, node);
      // if stuck beyond a reasonable range, break
      if (target.y > 10000) break;
    }
    return node;
  };

  // compact on layout change for smoother UX
  const onLocalLayoutChange = useCallback(
    (nextLayout) => {
      const compacted = compactLayout(nextLayout, colsInUse);
      setLayout(compacted);
      onLayoutChange(compacted);
    },
    [colsInUse]
  );

  /* ------------------------- Drag & Resize handlers ------------------------- */
  const dragState = useRef(null);

  const startDrag = (e, item) => {
    if (!isDraggable || item.static) return;
    e.stopPropagation();
    const pointer = e.touches ? e.touches[0] : e;
    dragState.current = {
      type: 'drag',
      itemId: item.i,
      startX: pointer.clientX,
      startY: pointer.clientY,
      orig: { ...item },
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  };

  const startResize = (e, item, corner = 'se') => {
    if (!isResizable || item.static) return;
    e.stopPropagation();
    const pointer = e.touches ? e.touches[0] : e;
    dragState.current = {
      type: 'resize',
      itemId: item.i,
      startX: pointer.clientX,
      startY: pointer.clientY,
      orig: { ...item },
      corner,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  };

  const onPointerMove = (ev) => {
    const st = dragState.current;
    if (!st) return;
    const pointer = ev.touches ? ev.touches[0] : ev;
    const dx = pointer.clientX - st.startX;
    const dy = pointer.clientY - st.startY;
    // convert pixel delta to grid units
    const deltaX = Math.round(dx / (colWidth + margin[0]));
    const deltaY = Math.round(dy / (rowHeight + margin[1]));

    setLayout((prev) => {
      const next = cloneLayout(prev);
      const node = next.find((n) => n.i === st.itemId);
      if (!node) return prev;

      if (st.type === 'drag') {
        const candidate = { ...st.orig, x: Math.max(0, st.orig.x + deltaX), y: Math.max(0, st.orig.y + deltaY) };
        // ensure within bounds horizontally
        if (candidate.x + candidate.w > colsInUse) candidate.x = colsInUse - candidate.w;
        const resolved = resolveCollision(candidate, next);
        // apply
        node.x = resolved.x;
        node.y = resolved.y;
      } else if (st.type === 'resize') {
        // only southeast resizing supported for simplicity
        const candidate = { ...st.orig, w: Math.max(1, st.orig.w + deltaX), h: Math.max(1, st.orig.h + deltaY) };
        if (candidate.x + candidate.w > colsInUse) candidate.w = colsInUse - candidate.x;
        // avoid colliding by shrinking if needed
        let coll = findCollision(next, candidate);
        if (preventCollision && coll) {
          // try to reduce size until no collision
          while (coll && candidate.w > 1) {
            candidate.w -= 1;
            coll = findCollision(next, candidate);
          }
        }
        node.w = candidate.w;
        node.h = candidate.h;
      }

      return next;
    });
  };

  const onPointerUp = () => {
    // finalize: compact and call change callback
    dragState.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    onLocalLayoutChange(layout);
  };

  /* ------------------------- Render ------------------------- */
  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={styles.grid}
        style={{ height: Math.max(200, (rowHeight + margin[1]) * (Math.max(...layout.map((l) => l.y + l.h), 1)) + 40) }}
      >
        {layout.map((node) => {
          const style = posToStyle(node);
          const Comp = componentMap[node.i] || null;
          return (
            <div
              key={node.i}
              className={`${styles.gridItem} ${node.static ? styles.static : ''}`}
              style={style}
              data-grid-id={node.i}
            >
              <div className={styles.header} onPointerDown={(e) => startDrag(e, node)}>
                <div className={styles.title}>{items.find((it) => it.id === node.i)?.title || node.i}</div>
                <div className={styles.handle} aria-hidden />
              </div>
              <div className={styles.content}>
                {Comp ? <Comp {...(items.find((it) => it.id === node.i)?.component || {})} /> : null}
              </div>

              {isResizable && !node.static && (
                <div className={styles.resizeHandle} onPointerDown={(e) => startResize(e, node)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ------------------------- Usage Notes ------------------------- */
// - Import this GridStack.jsx and GridStack.module.css into your app.
// - Provide `items` same shape you had: { id, x, y, w, h, title, component, static }
// - Provide a componentMap prop mapping id -> React component (COMPONENT_MAP in your example).
// - Listen to onLayoutChange(layout) to update state / persist coordinates.
// - The implementation focuses on clarity and performance (CSS transform for positioning),
//   compacting, and basic collision resolution without external libs.
// - You may extend it: add keyboard support, smarter collision resolution, multiple resize handles,
//   or inertia/snap animations.



/* ------------------------- GridStack.module.css ------------------------- */

/*
.container { position: relative; width: 100%; }
.grid { position: relative; width: 100%; }
.gridItem { 
  position: absolute;
  box-sizing: border-box;
  background: var(--card-bg, #fff);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transition: transform 180ms cubic-bezier(.2,.8,.2,1), width 180ms, height 180ms;
  will-change: transform, width, height;
}
.header { 
  height: 36px; 
  display: flex; 
  align-items: center; 
  padding: 6px 10px; 
  cursor: grab; 
  user-select: none;
  background: linear-gradient(180deg, rgba(0,0,0,0.02), transparent);
}
.header:active { cursor: grabbing; }
.title { flex: 1; font-weight: 600; font-size: 14px; }
.handle { width: 24px; height: 24px; border-radius: 6px; opacity: 0.6; }
.content { padding: 12px; }
.resizeHandle {
  position: absolute;
  width: 14px;
  height: 14px;
  right: 6px;
  bottom: 6px;
  cursor: se-resize;
  border-radius: 3px;
}
.static { opacity: 0.9; }
*/
