# gridstackcore

Pure React GridStack component with collision detection, drag & resize, responsive breakpoints, and smooth animations. **Zero external dependencies**.

## Installation

```bash
npm install gridstackcore
```

## Usage

```tsx
import { GridStack, useGrid } from 'gridstackcore';
import 'gridstackcore/styles';

const items = [
  { id: 'widget-1', x: 0, y: 0, w: 4, h: 3, title: 'Sales' },
  { id: 'widget-2', x: 4, y: 0, w: 4, h: 3, title: 'Analytics' },
  { id: 'widget-3', x: 8, y: 0, w: 4, h: 3, title: 'Users' },
];

function Dashboard() {
  return (
    <GridStack
      items={items}
      cols={12}
      rowHeight={60}
      margin={[16, 16]}
      containerPadding={[16, 16]}
      isDraggable
      isResizable
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

## Features

- Drag and drop with smooth animations
- Multi-corner resize handles
- Collision detection and resolution (push, swap, none)
- Responsive breakpoints
- Vertical compaction (sticky mode)
- FLIP-based animation engine
- Drop indicator preview
- Overlay drag layer (GPU-accelerated)
- Customizable snap threshold
- Roll-on-push 3D depth cue
- React 18+ compatible

## API

### `<GridStack />` Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `GridItem[]` | `[]` | Array of grid items |
| `cols` | `number` | `12` | Number of columns |
| `rowHeight` | `number` | `30` | Height of each row in px |
| `margin` | `[number, number]` | `[20, 20]` | Gap between items [x, y] |
| `containerPadding` | `[number, number]` | `[0, 0]` | Container padding [x, y] |
| `isDraggable` | `boolean` | `true` | Enable drag |
| `isResizable` | `boolean` | `true` | Enable resize |
| `preventCollision` | `boolean` | `true` | Prevent overlap |
| `collisionMode` | `'push' \| 'swap' \| 'none'` | `'push'` | Collision resolution strategy |
| `onLayoutChange` | `(layout: GridItem[]) => void` | — | Callback on layout change |
| `componentMap` | `Record<string, ComponentType>` | `{}` | Map item id → React component |
| `animation` | `{ duration: number, easing: string }` | — | Animation config |
| `sticky` | `boolean` | `false` | Compact items upward |

### `useGrid(options)`

Lower-level hook for custom grid implementations. Returns layout state, overlay, and interaction handlers.

### `GridEngine`

Headless grid engine (no React dependency) for server-side or framework-agnostic usage.

## License

MIT
