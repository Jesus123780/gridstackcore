/**
 * Storybook demo for the new GridEngine + ExternalStore architecture.
 * Shows render-isolated grid items using the pure TS engine.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { GridEngine } from './engine/grid-engine'
import { GridExternalStore } from './store/external-store'
import type { GridPosition } from './types'

// ─── Pixel helpers ───────────────────────────────────────────────────────────

interface PxConfig {
  cols: number
  rowHeight: number
  margin: [number, number]
  containerWidth: number
  containerPadding: [number, number]
}

function computeColWidth(config: PxConfig): number {
  const totalMargin = config.margin[0] * (config.cols - 1)
  const totalPadding = config.containerPadding[0] * 2
  return Math.max(40, (config.containerWidth - totalMargin - totalPadding) / config.cols)
}

function gridToPx(gridUnits: number, colWidth: number, margin: number, padding: number): number {
  return Math.round((colWidth + margin) * gridUnits + padding)
}

function widthPx(w: number, colWidth: number, marginX: number): number {
  return Math.round(colWidth * w + marginX * (w - 1))
}

function heightPx(h: number, rowHeight: number, marginY: number): number {
  return Math.round(rowHeight * h + marginY * (h - 1))
}

// ─── Render counter badge (para demo visual) ────────────────────────────────

function useRenderCount() {
  const count = useRef(0)
  count.current += 1
  return count.current
}

// ─── GridItemShell: solo se suscribe a su propio item ───────────────────────

interface ShellProps {
  id: string
  store: GridExternalStore
  pxConfig: PxConfig
  isDragging: boolean
  children: React.ReactNode
  onDragStart: (id: string, e: React.PointerEvent) => void
}

const GridItemShell = React.memo(function GridItemShell({
  id,
  store,
  pxConfig,
  isDragging,
  children,
  onDragStart,
}: ShellProps) {
  const position = useSyncExternalStore(
    (cb) => store.subscribeItem(id, cb),
    () => store.getItemSnapshot(id),
  )

  const renderCount = useRenderCount()

  if (!position) return null

  const colWidth = computeColWidth(pxConfig)
  const x = gridToPx(position.x, colWidth, pxConfig.margin[0], pxConfig.containerPadding[0])
  const y = gridToPx(position.y, pxConfig.rowHeight, pxConfig.margin[1], pxConfig.containerPadding[1])
  const w = widthPx(position.w, colWidth, pxConfig.margin[0])
  const h = heightPx(position.h, pxConfig.rowHeight, pxConfig.margin[1])

  return (
    <div
      style={{
        position: 'absolute',
        transform: `translate3d(${x}px, ${y}px, 0)`,
        width: w,
        height: h,
        transition: 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), width 300ms, height 300ms',
        opacity: isDragging ? 0.4 : 1,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}
      onPointerDown={(e) => onDragStart(id, e)}
    >
      {/* Render count badge */}
      <div style={{
        position: 'absolute',
        top: 4,
        right: 4,
        background: renderCount > 1 ? '#ef4444' : '#22c55e',
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 8,
        zIndex: 10,
        fontFamily: 'monospace',
      }}>
        renders: {renderCount}
      </div>
      {children}
    </div>
  )
})

// ─── GridItemContent: boundary memoizado ────────────────────────────────────

interface ContentProps {
  id: string
  color: string
  title: string
}

const GridItemContent = React.memo(function GridItemContent({ id, color, title }: ContentProps) {
  const renderCount = useRenderCount()

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      cursor: 'grab',
      userSelect: 'none',
    }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
      <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
        Content renders: {renderCount}
      </div>
      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
        id: {id}
      </div>
    </div>
  )
})

// ─── Grid Container ─────────────────────────────────────────────────────────

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']

const INITIAL_ITEMS: GridPosition[] = [
  { i: 'a', x: 0, y: 0, w: 4, h: 2 },
  { i: 'b', x: 4, y: 0, w: 4, h: 2 },
  { i: 'c', x: 8, y: 0, w: 4, h: 2 },
  { i: 'd', x: 0, y: 2, w: 6, h: 3 },
  { i: 'e', x: 6, y: 2, w: 6, h: 3 },
  { i: 'f', x: 0, y: 5, w: 12, h: 2 },
]

interface GridDemoProps {
  cols: number
  rowHeight: number
  margin: [number, number]
  collisionMode: 'push' | 'swap' | 'push-first' | 'none'
  showRenderCounts: boolean
}

function GridEngineDemo({
  cols = 12,
  rowHeight = 80,
  margin = [12, 12],
  collisionMode = 'push',
  showRenderCounts = true,
}: Readonly<GridDemoProps>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(900)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [layoutLog, setLayoutLog] = useState<string[]>([])
  const dragStartRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Create engine + store (stable across renders)
  const { engine, store } = useMemo(() => {
    const eng = new GridEngine({ cols, collisionMode, rowHeight, margin, maxReflowDepth: 8 })
    const st = new GridExternalStore()
    eng.setLayout(INITIAL_ITEMS)
    st.commitLayout(eng.getLayout())
    return { engine: eng, store: st }
  }, [cols, collisionMode, rowHeight, margin])

  // Subscribe engine to store
  useEffect(() => {
    const unsub = engine.subscribe((layout) => {
      store.commitLayout(layout)
    })
    return unsub
  }, [engine, store])

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.max(200, entry.contentRect.width))
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const pxConfig: PxConfig = useMemo(() => ({
    cols,
    rowHeight,
    margin,
    containerWidth,
    containerPadding: [12, 12] as [number, number],
  }), [cols, rowHeight, margin, containerWidth])

  // Drag handling
  const handleDragStart = useCallback((id: string, e: React.PointerEvent) => {
    const pos = store.getItemSnapshot(id)
    if (!pos) return
    setDraggingId(id)
    dragStartRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    }

    const colWidth = computeColWidth(pxConfig)

    const onMove = (ev: PointerEvent) => {
      const st = dragStartRef.current
      if (!st) return
      const dx = ev.clientX - st.startX
      const dy = ev.clientY - st.startY
      const deltaX = Math.round(dx / (colWidth + margin[0]))
      const deltaY = Math.round(dy / (rowHeight + margin[1]))
      const newX = Math.max(0, st.origX + deltaX)
      const newY = Math.max(0, st.origY + deltaY)
      engine.moveItem(st.id, newX, newY)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDraggingId(null)
      dragStartRef.current = null
      const layout = engine.getLayout()
      setLayoutLog((prev) => [
        `[${new Date().toLocaleTimeString()}] Layout commit: ${layout.map(i => `${i.i}(${i.x},${i.y})`).join(' ')}`,
        ...prev.slice(0, 9),
      ])
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [engine, store, pxConfig, margin, rowHeight])

  // Grid height
  const layout = useSyncExternalStore(
    (cb) => store.subscribeCommitted(cb),
    () => store.getCommittedSnapshot(),
  )

  const gridHeight = useMemo(() => {
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
    return (rowHeight + margin[1]) * maxY + 24
  }, [layout, rowHeight, margin])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Controls */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
        <strong>🎯 Performance Isolation Demo</strong>
        <p style={{ margin: '8px 0 0', color: '#64748b' }}>
          Arrastra los items y observa los contadores de render. Solo el Shell del item arrastrado incrementa.
          El contenido (Content renders) NO incrementa durante drag — esa es la isolation.
        </p>
      </div>

      {/* Grid container */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: gridHeight,
          background: '#f1f5f9',
          borderRadius: 12,
          border: '2px dashed #e2e8f0',
        }}
      >
        {INITIAL_ITEMS.map((item, idx) => (
          <GridItemShell
            key={item.i}
            id={item.i}
            store={store}
            pxConfig={pxConfig}
            isDragging={draggingId === item.i}
            onDragStart={handleDragStart}
          >
            <GridItemContent
              id={item.i}
              color={COLORS[idx % COLORS.length]}
              title={`Widget ${item.i.toUpperCase()}`}
            />
          </GridItemShell>
        ))}
      </div>

      {/* Layout log */}
      <div style={{ marginTop: 16, padding: 12, background: '#1e293b', borderRadius: 8, maxHeight: 160, overflow: 'auto' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>Layout Commits Log:</div>
        {layoutLog.length === 0 && (
          <div style={{ fontSize: 11, color: '#64748b' }}>Drag an item to see layout commits here...</div>
        )}
        {layoutLog.map((log, i) => (
          <div key={i} style={{ fontSize: 11, color: '#e2e8f0', fontFamily: 'monospace', marginTop: 2 }}>
            {log}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Storybook Meta ─────────────────────────────────────────────────────────

const meta = {
  title: 'organisms/GridStack/Engine Demo',
  component: GridEngineDemo,
  parameters: {
    docs: {
      description: {
        component: `
## GridEngine Performance Isolation

Esta demo muestra la nueva arquitectura de render isolation:

- **GridEngine**: Motor puro TS que calcula layout sin React
- **ExternalStore**: Estado con suscripciones per-item (useSyncExternalStore)
- **GridItemShell**: Solo se re-renderiza cuando SU posición cambia
- **GridItemContent**: React.memo — NO se re-renderiza durante drag

### Cómo verificar isolation:
1. Observa el badge verde "renders: N" en cada item
2. Arrastra un item
3. Solo el Shell del item arrastrado incrementa su contador
4. Los "Content renders" de otros items **nunca** incrementan
        `,
      },
    },
  },
  argTypes: {
    cols: {
      control: { type: 'range', min: 4, max: 24, step: 1 },
      description: 'Número de columnas del grid',
    },
    rowHeight: {
      control: { type: 'range', min: 40, max: 200, step: 10 },
      description: 'Altura de cada fila en pixels',
    },
    collisionMode: {
      control: { type: 'select' },
      options: ['push', 'swap', 'push-first', 'none'],
      description: 'Estrategia de resolución de colisiones',
    },
    showRenderCounts: {
      control: 'boolean',
      description: 'Mostrar contadores de render',
    },
  },
} satisfies Meta<typeof GridEngineDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    cols: 12,
    rowHeight: 80,
    margin: [12, 12],
    collisionMode: 'push',
    showRenderCounts: true,
  },
}

export const SwapMode: Story = {
  args: {
    cols: 12,
    rowHeight: 80,
    margin: [12, 12],
    collisionMode: 'swap',
    showRenderCounts: true,
  },
}

export const DenseGrid: Story = {
  args: {
    cols: 6,
    rowHeight: 100,
    margin: [8, 8],
    collisionMode: 'push',
    showRenderCounts: true,
  },
}

export const NoCollision: Story = {
  args: {
    cols: 12,
    rowHeight: 80,
    margin: [12, 12],
    collisionMode: 'none',
    showRenderCounts: true,
  },
}
