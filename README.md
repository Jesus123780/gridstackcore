# gridstackcore

Pure React GridStack component with collision detection, drag & resize, responsive breakpoints, and smooth animations. **Zero external dependencies**.

Inspired by [gridstackjs.com](https://gridstackjs.com/) — rebuilt from scratch as a React-first solution with modern performance optimizations.

## Installation

```bash
npm install gridstackcore
```

## Quick Start

```tsx
'use client'; // Required for Next.js App Router

import { GridStack } from 'gridstackcore';
import 'gridstackcore/styles';

const items = [
  { i: 'widget-1', x: 0, y: 0, w: 4, h: 3, title: 'Sales' },
  { i: 'widget-2', x: 4, y: 0, w: 4, h: 3, title: 'Analytics' },
  { i: 'widget-3', x: 8, y: 0, w: 4, h: 3, title: 'Users' },
];

function SalesWidget() {
  return <div>Sales metrics and KPIs</div>;
}

function AnalyticsWidget() {
  return <div>Traffic and conversion data</div>;
}

function UsersWidget() {
  return <div>Active users overview</div>;
}

export default function Dashboard() {
  return (
    <GridStack
      items={items}
      cols={12}
      rowHeight={60}
      margin={[16, 16]}
      containerPadding={[16, 16]}
      isDraggable
      isResizable
      animation={{ duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)' }}
      onLayoutChange={(layout) => console.log('Layout changed:', layout)}
      componentMap={{
        'widget-1': SalesWidget,
        'widget-2': AnalyticsWidget,
        'widget-3': UsersWidget,
      }}
    />
  );
}
```

## Important: CSS Import

**You must import the styles** for the grid to work correctly. Without styles, widgets won't have absolute positioning or transitions.

```tsx
// Option A: Using the export path
import 'gridstackcore/styles';

// Option B: Direct path (if Option A doesn't resolve)
import 'gridstackcore/dist/gridstackcore.css';
```

### Next.js Configuration

For Next.js projects, add `transpilePackages` in your `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['gridstackcore'],
};

export default nextConfig;
```

## Item Format

Each item **must** include the `i` property as the unique identifier:

```ts
interface GridItem {
  i: string;        // Required: unique identifier
  x: number;        // Column position (0-based)
  y: number;        // Row position (0-based)
  w: number;        // Width in columns
  h: number;        // Height in rows
  id?: string;      // Optional alias for i
  title?: string;   // Optional title
  static?: boolean; // If true, item cannot be moved
}
```

## Features

- **Drag and drop** with smooth GPU-accelerated animations
- **Multi-corner resize handles** (SE, SW, NE)
- **Collision detection and resolution** — push, swap, cascade smart shift, BFS fallback
- **Vertical compaction** (sticky mode)
- **FLIP-based animation engine** with cost-aware duration
- **Drop indicator preview** showing where widget will land
- **Overlay drag layer** — GPU composited, zero layout reflow
- **Customizable snap threshold** — control when widgets snap to grid
- **Roll-on-push 3D depth cue** — visual feedback during reflow
- **Optimized for heavy widgets** — `React.memo` with custom comparators prevents unnecessary re-renders
- **Designed for large dashboards** — tested with 50+ simultaneous widgets
- **React 18+ compatible** — uses modern React patterns (hooks, refs, pointer events)

## Performance

gridstackcore is built with performance as a first-class concern:

- **Memoized content wrapper** — widget content never re-renders during drag
- **Memoized grid items** — only items whose position/style changed re-render
- **GPU compositing** — all transforms use `translate3d` for hardware acceleration
- **requestAnimationFrame scheduling** — drag moves are batched per frame
- **Pointer capture** — single event listener handles entire drag lifecycle
- **CSS Modules** — scoped styles with zero specificity conflicts

## API

### `<GridStack />` Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `GridItem[]` | `[]` | Array of grid items (must include `i`) |
| `cols` | `number` | `12` | Number of columns |
| `rowHeight` | `number` | `30` | Height of each row in px |
| `margin` | `[number, number]` | `[20, 20]` | Gap between items [x, y] |
| `containerPadding` | `[number, number]` | `[0, 0]` | Container padding [x, y] |
| `isDraggable` | `boolean` | `true` | Enable drag |
| `isResizable` | `boolean` | `true` | Enable resize |
| `preventCollision` | `boolean` | `true` | Prevent overlap |
| `collisionMode` | `'push' \| 'swap' \| 'none'` | `'push'` | Collision resolution strategy |
| `onLayoutChange` | `(layout: GridItem[]) => void` | — | Callback on layout change |
| `componentMap` | `Record<string, ComponentType>` | `{}` | Map item `i` → React component |
| `animation` | `{ duration: number, easing: string }` | `{ duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)' }` | Animation config |
| `sticky` | `boolean` | `false` | Compact items upward |
| `snapEnabled` | `boolean` | `true` | Enable grid snapping |
| `snapThreshold` | `number` | `12` | Snap sensitivity |
| `showGrid` | `boolean` | `false` | Show grid background |
| `radio` | `number` | `15` | Border radius for items |
| `dragOverlayOffset` | `{ x: number, y: number }` | `{ x: 8, y: 8 }` | Offset for drag overlay |

### `useGrid(options)`

Lower-level hook for custom grid implementations. Returns layout state, overlay, and interaction handlers.

```tsx
import { useGrid } from 'gridstackcore';

const { layout, overlay, startDrag, startResize, onPointerMove, endInteraction } = useGrid({
  items,
  cols: 12,
  rowHeight: 60,
  onLayoutChange: (newLayout) => setItems(newLayout),
});
```

### `GridEngine`

Headless grid engine (no React dependency) for server-side or framework-agnostic usage.

## Live Demo

Interactive Storybook on Chromatic:
👉 [View Demo](https://6a24f31a6d75d390d33f54c3-fiyyhhotmj.chromatic.com/)

## Roadmap

This is actively maintained. Upcoming features:

- Keyboard accessibility (arrow key navigation)
- Drag from outside the grid
- Responsive breakpoints with layout persistence
- Virtual scrolling for very large grids
- Plugin system for custom collision resolvers

## License

MIT
