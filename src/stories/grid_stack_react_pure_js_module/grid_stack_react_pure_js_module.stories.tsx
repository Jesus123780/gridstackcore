// src/stories/GridStack.stories.tsx
import React from 'react'
import type { GridItem } from './types/types'
import GridStack from './components/GridStack/GridStack'
import { type Meta, type StoryObj } from '@storybook/react'

// --- Componente Card mejorado
interface CardProps {
  title?: string
  color?: string
  children?: React.ReactNode
}

const Card: React.FC<CardProps> = ({
  title,
  color = '#6366f1',
  children
}) => (
  <div style={{
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${color}, ${adjustBrightness(color, -20)})`,
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    fontSize: 14,
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif, PFont-regular',
    cursor: 'grab',
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{title}</div>
      {children && <div style={{ fontSize: 12, opacity: 0.9 }}>{children}</div>}
    </div>
  </div>
)

// Utilidad para ajustar brillo de color
function adjustBrightness(color: string, amount: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount))
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// Mapping id -> componente con colores variados
const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  a: (props: any) => <Card {...props} color="#6366f1" />,
  b: (props: any) => <Card {...props} color="#ec4899" />,
  c: (props: any) => <Card {...props} color="#14b8a6" />,
  d: (props: any) => <Card {...props} color="#f59e0b" />,
  f: (props: any) => <Card {...props} color="#10b981" />,
  g: (props: any) => <Card {...props} color="#3b82f6" />,
  h: (props: any) => <Card {...props} color="#8b5cf6" />,
}

// Items de ejemplo
const SAMPLE_ITEMS: GridItem[] = [
  { i: 'a', id: 'a', x: 0, y: 0, w: 4, h: 2, title: 'Widget A', component: { title: 'Widget A', children: 'Drag me!' } },
  { i: 'b', id: 'b', x: 4, y: 0, w: 4, h: 2, title: 'Widget B', component: { title: 'Widget B', children: 'Resize me!' } },
  { i: 'c', id: 'c', x: 8, y: 0, w: 4, h: 2, title: 'Widget C', component: { title: 'Widget C', children: 'Interact!' } },
  { i: 'd', id: 'd', x: 0, y: 2, w: 6, h: 3, title: 'Widget D', component: { title: 'Widget D', children: 'I am bigger!' } },
  { i: 'f', id: 'f', x: 6, y: 2, w: 6, h: 3, title: 'Widget F', component: { title: 'Widget F', children: 'I am bigger!' } },
  { i: 'g', id: 'g', x: 0, y: 5, w: 12, h: 2, title: 'Widget G', component: { title: 'Widget G', children: 'I am wide!' } },
  { i: 'h', id: 'h', x: 0, y: 7, w: 12, h: 2, title: 'Widget H', component: { title: 'Widget H', children: 'I am wide!' } },
]

const meta = {
  title: 'organisms/GridStack',
  component: GridStack,
  parameters: {
    docs: {
      description: {
        component: 'GridStack — grid interactivo con drag/resize, animaciones FLIP y overlay drag.',
      },
    },
  },
  argTypes: {
    dragMode: {
      control: { type: 'select' },
      options: ['overlay', 'move', 'ghost'],
      description: 'Modo de drag',
      table: { defaultValue: { summary: 'overlay' } },
    },
    collisionMode: {
      control: { type: 'select' },
      options: ['push', 'none'],
      description: 'Estrategia de colisión',
      table: { defaultValue: { summary: 'push' } },
    },
    items: {
      control: 'object',
      description: 'Items del grid',
    },
  },
} satisfies Meta<typeof GridStack>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,

    /* layout base (más limpio y proporcional al sample) */
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    onLayoutChange: (layout: GridItem[]) => console.log('Layout changed:', layout),

    /* snap / magnetismo */
    snapEnabled: false,
    snapThreshold: 0, // Pequeño para movimientos fluidos

    /* interacción */
    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    dragThrottleMs: 0,
    allowOverlapDuringDrag: false,
    animateOnDrop: true,
    preventCollision: true,
    isDraggable: true,
    isResizable: true,

    /* estilo visual */
    radio: 14,
    showGrid: true,

    /* animación - configuración optimizada para suavidad */
    animation: { duration: 380, easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)' }, // Spring easing suave

    /* soft displacement - controla la suavidad del empuje */
    softDisplacementStrength: 0.94, // 0.9-0.97 recomendado

    /* roll animation - rotación 3D sutil al empujar */
    enableRollOnPush: false, // Deshabilitado para movimiento más limpio
    rollAngleMax: 6,
    rollDuration: 320,
    rollStagger: 30,

    /* hit feedback - efecto "bump" al empujar */
    enableHitOnPush: true,
    hitMultiplier: 1.06, // 1.03-1.12 para bump perceptible
    hitDuration: 160, // Duración del efecto bump
    hitThresholdPx: 6, // Umbral mínimo de movimiento para activar

    /* sticky compaction */
    sticky: false,
    animation: { duration: 380, easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)' },
    softDisplacementStrength: 0.94,
    enableHitOnPush: true,
  },
}

export const SecondarySticky: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,

    /* layout */
    cols: 12,
    rowHeight: 100,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 16,
    showGrid: true,

    /* interacción */
    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    isDraggable: true,
    isResizable: true,
    preventCollision: true,
    snapEnabled: true,
    snapThreshold: 5,

    /* sticky mode - compactación automática */
    sticky: true,

    /* animación optimizada con bounce spring */
    animation: { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }, // Bounce spring

    /* soft displacement */
    softDisplacementStrength: 0.96, // Más suave para sticky mode

    /* roll animation - rotación 3D visible */
    enableRollOnPush: true,
    rollAngleMax: 8, // Rotación más pronunciada
    rollDuration: 380,
    rollStagger: 40,

    /* hit feedback - bump más notorio */
    enableHitOnPush: true,
    hitMultiplier: 1.10, // Bump más visible con sticky
    hitDuration: 180,
    hitThresholdPx: 8,
  },
}

/**
 * Story adicional para testing de configuraciones extremas
 * Valores máximos recomendados para animaciones ultra-suaves
 */
export const UltraSmooth: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,

    cols: 12,
    rowHeight: 95,
    margin: [16, 16],
    containerPadding: [16, 16],
    radio: 18,
    showGrid: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    isDraggable: true,
    isResizable: true,
    preventCollision: true,
    snapEnabled: true,
    snapThreshold: 5,
    sticky: false,

    /* Duración máxima recomendada (320-480ms) */
    animation: { duration: 480, easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)' },

    /* Displacement máximo (0.9-0.97) - más suave */
    softDisplacementStrength: 0.97,

    /* Roll animation activado con valores altos */
    enableRollOnPush: true,
    rollAngleMax: 12,
    rollDuration: 440,
    rollStagger: 50,

    /* Hit feedback máximo (1.03-1.12) */
    enableHitOnPush: true,
    hitMultiplier: 1.12, // Máximo recomendado
    hitDuration: 200,
    hitThresholdPx: 6,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Escenarios adicionales
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collision mode: swap — intercambia posiciones en lugar de empujar.
 */
export const CollisionSwap: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'swap',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 8,
    sticky: false,

    animation: { duration: 320, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    softDisplacementStrength: 0.92,
    enableRollOnPush: false,
    enableHitOnPush: false,
  },
}

/**
 * Collision mode: none — sin resolución de colisiones, permite overlap libre.
 */
export const CollisionNone: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: false,

    dragMode: 'overlay',
    collisionMode: 'none',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 8,
    sticky: false,

    animation: { duration: 280, easing: 'ease-out' },
    enableRollOnPush: false,
    enableHitOnPush: false,
  },
}

/**
 * Drag mode: real — mueve el elemento directamente sin overlay.
 */
export const DragModeReal: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'real',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 12,
    sticky: false,

    animation: { duration: 340, easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)' },
    softDisplacementStrength: 0.94,
    enableRollOnPush: true,
    rollAngleMax: 6,
    rollDuration: 300,
    rollStagger: 30,
    enableHitOnPush: true,
    hitMultiplier: 1.06,
    hitDuration: 160,
    hitThresholdPx: 6,
  },
}

/**
 * Drag mode: preview — muestra un ghost/placeholder en la posición destino.
 */
export const DragModePreview: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'preview',
    collisionMode: 'push',
    overlayAnchor: 'center',
    snapEnabled: true,
    snapThreshold: 12,
    sticky: false,

    animation: { duration: 380, easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)' },
    softDisplacementStrength: 0.94,
    enableRollOnPush: false,
    enableHitOnPush: false,
  },
}

/**
 * Overlay anchor: pointer — el overlay sigue al cursor exacto.
 */
export const OverlayAnchorPointer: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'pointer',
    snapEnabled: true,
    snapThreshold: 8,
    sticky: false,

    animation: { duration: 360, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    softDisplacementStrength: 0.94,
    enableRollOnPush: true,
    rollAngleMax: 8,
    rollDuration: 320,
    rollStagger: 30,
    enableHitOnPush: true,
    hitMultiplier: 1.06,
    hitDuration: 160,
    hitThresholdPx: 6,
  },
}

/**
 * Overlay anchor: center — el overlay se centra en la celda destino.
 */
export const OverlayAnchorCenter: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'center',
    snapEnabled: true,
    snapThreshold: 8,
    sticky: false,

    animation: { duration: 360, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    softDisplacementStrength: 0.94,
    enableRollOnPush: false,
    enableHitOnPush: true,
    hitMultiplier: 1.08,
    hitDuration: 160,
    hitThresholdPx: 6,
  },
}

/**
 * Static items — algunos widgets no se pueden mover ni redimensionar.
 */
const STATIC_ITEMS: GridItem[] = [
  { i: 'a', id: 'a', x: 0, y: 0, w: 12, h: 2, title: 'Header (static)', static: true, component: { title: '🔒 Header', children: 'No me puedes mover' } },
  { i: 'b', id: 'b', x: 0, y: 2, w: 4, h: 3, title: 'Widget B', component: { title: 'Widget B', children: 'Drag me!' } },
  { i: 'c', id: 'c', x: 4, y: 2, w: 4, h: 3, title: 'Widget C', component: { title: 'Widget C', children: 'Resize me!' } },
  { i: 'd', id: 'd', x: 8, y: 2, w: 4, h: 3, title: 'Widget D', component: { title: 'Widget D', children: 'Interact!' } },
  { i: 'f', id: 'f', x: 0, y: 5, w: 12, h: 2, title: 'Footer (static)', static: true, component: { title: '🔒 Footer', children: 'No me puedes mover' } },
]

export const StaticItems: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: STATIC_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 8,
    sticky: false,

    animation: { duration: 380, easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)' },
    softDisplacementStrength: 0.94,
    enableRollOnPush: true,
    rollAngleMax: 6,
    rollDuration: 320,
    rollStagger: 30,
    enableHitOnPush: true,
    hitMultiplier: 1.06,
    hitDuration: 160,
    hitThresholdPx: 6,
  },
}

/**
 * Read-only — ni drag ni resize habilitados (modo visualización).
 */
export const ReadOnly: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: false,
    isResizable: false,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    animation: { duration: 300, easing: 'ease' },
  },
}

/**
 * Dense layout — muchos widgets pequeños para testing de colisiones complejas.
 */
const DENSE_ITEMS: GridItem[] = [
  { i: '1', id: '1', x: 0, y: 0, w: 3, h: 2, component: { title: '1' } },
  { i: '2', id: '2', x: 3, y: 0, w: 3, h: 2, component: { title: '2' } },
  { i: '3', id: '3', x: 6, y: 0, w: 3, h: 2, component: { title: '3' } },
  { i: '4', id: '4', x: 9, y: 0, w: 3, h: 2, component: { title: '4' } },
  { i: '5', id: '5', x: 0, y: 2, w: 3, h: 2, component: { title: '5' } },
  { i: '6', id: '6', x: 3, y: 2, w: 3, h: 2, component: { title: '6' } },
  { i: '7', id: '7', x: 6, y: 2, w: 3, h: 2, component: { title: '7' } },
  { i: '8', id: '8', x: 9, y: 2, w: 3, h: 2, component: { title: '8' } },
  { i: '9', id: '9', x: 0, y: 4, w: 4, h: 2, component: { title: '9' } },
  { i: '10', id: '10', x: 4, y: 4, w: 4, h: 2, component: { title: '10' } },
  { i: '11', id: '11', x: 8, y: 4, w: 4, h: 2, component: { title: '11' } },
  { i: '12', id: '12', x: 0, y: 6, w: 6, h: 2, component: { title: '12' } },
  { i: '13', id: '13', x: 6, y: 6, w: 6, h: 2, component: { title: '13' } },
]

const DENSE_COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  '1': (p: any) => <Card {...p} color="#6366f1" />,
  '2': (p: any) => <Card {...p} color="#ec4899" />,
  '3': (p: any) => <Card {...p} color="#14b8a6" />,
  '4': (p: any) => <Card {...p} color="#f59e0b" />,
  '5': (p: any) => <Card {...p} color="#10b981" />,
  '6': (p: any) => <Card {...p} color="#3b82f6" />,
  '7': (p: any) => <Card {...p} color="#8b5cf6" />,
  '8': (p: any) => <Card {...p} color="#ef4444" />,
  '9': (p: any) => <Card {...p} color="#06b6d4" />,
  '10': (p: any) => <Card {...p} color="#84cc16" />,
  '11': (p: any) => <Card {...p} color="#f97316" />,
  '12': (p: any) => <Card {...p} color="#a855f7" />,
  '13': (p: any) => <Card {...p} color="#64748b" />,
}

export const DenseGrid: Story = {
  render: (args) => <GridStack {...args} componentMap={DENSE_COMPONENT_MAP} />,
  args: {
    items: DENSE_ITEMS,
    cols: 12,
    rowHeight: 70,
    margin: [8, 8],
    containerPadding: [8, 8],
    radio: 10,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 6,
    sticky: true,

    animation: { duration: 300, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    softDisplacementStrength: 0.93,
    enableRollOnPush: true,
    rollAngleMax: 5,
    rollDuration: 280,
    rollStagger: 20,
    enableHitOnPush: true,
    hitMultiplier: 1.05,
    hitDuration: 140,
    hitThresholdPx: 4,
  },
}

/**
 * Sin animaciones — rendimiento puro, útil para dashboards con muchos widgets.
 */
export const NoAnimations: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 12,
    sticky: false,

    animation: { duration: 0, easing: 'linear' },
    softDisplacementStrength: 0,
    enableRollOnPush: false,
    enableHitOnPush: false,
  },
}

/**
 * Columns 6 — grid más compacto con menos columnas.
 */
export const SixColumns: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: [
      { i: 'a', id: 'a', x: 0, y: 0, w: 3, h: 2, title: 'A', component: { title: 'A', children: '3 cols' } },
      { i: 'b', id: 'b', x: 3, y: 0, w: 3, h: 2, title: 'B', component: { title: 'B', children: '3 cols' } },
      { i: 'c', id: 'c', x: 0, y: 2, w: 2, h: 3, title: 'C', component: { title: 'C', children: '2 cols' } },
      { i: 'd', id: 'd', x: 2, y: 2, w: 4, h: 3, title: 'D', component: { title: 'D', children: '4 cols' } },
      { i: 'f', id: 'f', x: 0, y: 5, w: 6, h: 2, title: 'F', component: { title: 'F', children: 'Full width' } },
    ],
    cols: 6,
    rowHeight: 100,
    margin: [16, 16],
    containerPadding: [16, 16],
    radio: 16,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 10,
    sticky: false,

    animation: { duration: 380, easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)' },
    softDisplacementStrength: 0.94,
    enableRollOnPush: true,
    rollAngleMax: 8,
    rollDuration: 320,
    rollStagger: 30,
    enableHitOnPush: true,
    hitMultiplier: 1.06,
    hitDuration: 160,
    hitThresholdPx: 6,
  },
}

/**
 * Large margins — espaciado amplio entre widgets para dashboards ejecutivos.
 */
export const LargeMargins: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 80,
    margin: [24, 24],
    containerPadding: [24, 24],
    radio: 20,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 12,
    sticky: false,

    animation: { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    softDisplacementStrength: 0.95,
    enableRollOnPush: false,
    enableHitOnPush: true,
    hitMultiplier: 1.08,
    hitDuration: 180,
    hitThresholdPx: 8,
  },
}

/**
 * Compact / zero margins — sin espaciado, widgets adyacentes.
 */
export const ZeroMargins: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [0, 0],
    containerPadding: [0, 0],
    radio: 0,
    showGrid: false,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 12,
    sticky: false,

    animation: { duration: 320, easing: 'ease-in-out' },
    softDisplacementStrength: 0.90,
    enableRollOnPush: false,
    enableHitOnPush: false,
  },
}

/**
 * Solo resize — drag deshabilitado, solo redimensionamiento.
 */
export const ResizeOnly: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: false,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    snapEnabled: true,
    snapThreshold: 8,
    sticky: false,

    animation: { duration: 340, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    softDisplacementStrength: 0.94,
    enableRollOnPush: false,
    enableHitOnPush: true,
    hitMultiplier: 1.06,
    hitDuration: 160,
    hitThresholdPx: 6,
  },
}

/**
 * Collision mode: push-first — empuja primero, luego permite overlap si no hay espacio.
 */
export const CollisionPushFirst: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push-first',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 10,
    sticky: false,

    animation: { duration: 360, easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)' },
    softDisplacementStrength: 0.94,
    enableRollOnPush: true,
    rollAngleMax: 6,
    rollDuration: 320,
    rollStagger: 30,
    enableHitOnPush: true,
    hitMultiplier: 1.06,
    hitDuration: 160,
    hitThresholdPx: 6,
  },
}

/**
 * Single widget — caso edge con un solo item para testing de estados vacíos.
 */
export const SingleWidget: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: [
      { i: 'a', id: 'a', x: 2, y: 1, w: 8, h: 4, title: 'Solo Widget', component: { title: 'Solo Widget', children: 'Soy el único aquí' } },
    ],
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 12,
    sticky: false,

    animation: { duration: 380, easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)' },
  },
}

/**
 * Allow overlap during drag — permite superposición mientras se arrastra.
 */
export const AllowOverlap: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: SAMPLE_ITEMS,
    cols: 12,
    rowHeight: 90,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: false,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    allowOverlapDuringDrag: true,
    snapEnabled: true,
    snapThreshold: 8,
    sticky: false,

    animation: { duration: 360, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    softDisplacementStrength: 0.92,
    enableRollOnPush: false,
    enableHitOnPush: false,
  },
}

/**
 * Tall row height — filas altas para contenido vertical como gráficos.
 */
export const TallRows: Story = {
  render: (args) => <GridStack {...args} componentMap={COMPONENT_MAP} />,
  args: {
    items: [
      { i: 'a', id: 'a', x: 0, y: 0, w: 6, h: 1, title: 'Chart A', component: { title: 'Chart A', children: 'Tall row' } },
      { i: 'b', id: 'b', x: 6, y: 0, w: 6, h: 1, title: 'Chart B', component: { title: 'Chart B', children: 'Tall row' } },
      { i: 'c', id: 'c', x: 0, y: 1, w: 4, h: 2, title: 'Chart C', component: { title: 'Chart C', children: 'Extra tall' } },
      { i: 'd', id: 'd', x: 4, y: 1, w: 8, h: 2, title: 'Chart D', component: { title: 'Chart D', children: 'Extra tall' } },
    ],
    cols: 12,
    rowHeight: 180,
    margin: [12, 12],
    containerPadding: [12, 12],
    radio: 14,
    showGrid: true,
    isDraggable: true,
    isResizable: true,
    preventCollision: true,

    dragMode: 'overlay',
    collisionMode: 'push',
    overlayAnchor: 'grab',
    snapEnabled: true,
    snapThreshold: 12,
    sticky: false,

    animation: { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    softDisplacementStrength: 0.95,
    enableRollOnPush: true,
    rollAngleMax: 10,
    rollDuration: 380,
    rollStagger: 40,
    enableHitOnPush: true,
    hitMultiplier: 1.08,
    hitDuration: 180,
    hitThresholdPx: 8,
  },
}