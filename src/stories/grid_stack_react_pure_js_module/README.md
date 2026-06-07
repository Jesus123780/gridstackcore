# GridStack Performance Isolation Architecture

## Resumen

Esta arquitectura separa completamente la lógica de layout (engine puro TS) del rendering de widgets (React), logrando que:

- **Drag/resize** no re-renderiza widgets pesados (charts, tablas)
- **Cambios internos** del widget no disparan recálculos del grid
- **Solo se re-renderizan** los Shells cuya posición cambió

## Capas

```
┌────────────────────────────────────────────────┐
│ GridProvider (React Context)                    │
│  ├── GridItemShell #1 (useSyncExternalStore)  │
│  │     └── GridItemContent #1 (React.memo)    │
│  │           └── Widget (chart, tabla, etc.)  │
│  ├── GridItemShell #2                          │
│  │     └── GridItemContent #2                  │
│  └── DragLayer (Portal + DOM manipulation)     │
└────────────────────────────────────────────────┘
         ↕ imperative calls
┌────────────────────────────────────────────────┐
│ GridEngine (Pure TypeScript — NO React)        │
│  - Collision detection (push, swap, none)      │
│  - Vertical compaction                         │
│  - Placement search                            │
│  - Bounded reflow O(n × maxDepth)             │
└────────────────────────────────────────────────┘
         ↕ layout results
┌────────────────────────────────────────────────┐
│ ExternalStore (Framework-agnostic)             │
│  - Committed channel (layout final)            │
│  - Interaction channel (estado transitorio)    │
│  - Per-item subscriptions (referential stable) │
└────────────────────────────────────────────────┘
```

## Uso Básico

```tsx
import { GridEngine } from './engine/grid-engine';
import { GridExternalStore } from './store/external-store';

// 1. Crear el engine
const engine = new GridEngine({
  cols: 12,
  rowHeight: 60,
  margin: [10, 10],
  collisionMode: 'push', // 'push' | 'swap' | 'push-first' | 'none'
  maxReflowDepth: 8,
});

// 2. Setear un layout inicial
engine.setLayout([
  { i: 'a', x: 0, y: 0, w: 4, h: 2 },
  { i: 'b', x: 4, y: 0, w: 4, h: 2 },
  { i: 'c', x: 8, y: 0, w: 4, h: 3 },
]);

// 3. Suscribirse a cambios
const unsubscribe = engine.subscribe((newLayout) => {
  console.log('Layout cambió:', newLayout);
});

// 4. Mutar
engine.moveItem('a', 2, 1);   // Mueve item 'a' a columna 2, fila 1
engine.resizeItem('b', 6, 3); // Redimensiona 'b' a 6 cols × 3 rows
engine.addItem({ i: 'new', x: 0, y: 5, w: 3, h: 2 }); // Agrega item
engine.removeItem('c');       // Elimina item 'c'

// 5. Obtener layout actual
const layout = engine.getLayout();

// 6. Limpiar
unsubscribe();
```

## ExternalStore con React

```tsx
import { useSyncExternalStore } from 'react';
import { GridExternalStore } from './store/external-store';

const store = new GridExternalStore();

// En un componente React:
function GridItemShell({ id }: { id: string }) {
  // Solo se re-renderiza cuando ESTE item cambia
  const position = useSyncExternalStore(
    (cb) => store.subscribeItem(id, cb),
    () => store.getItemSnapshot(id),
  );

  if (!position) return null;

  return (
    <div style={{
      transform: `translate3d(${position.x * 100}px, ${position.y * 60}px, 0)`,
      width: position.w * 100,
      height: position.h * 60,
    }}>
      {/* Widget pesado aquí — NO se re-renderiza durante drag */}
    </div>
  );
}
```

## Compatibilidad

El `CompatibilityAdapter` (en desarrollo) acepta la misma API que el GridStack actual:

```tsx
<CompatibilityAdapter
  items={items}
  cols={12}
  rowHeight={90}
  margin={[12, 12]}
  componentMap={COMPONENT_MAP}
  onLayoutChange={(layout) => console.log(layout)}
  dragMode="overlay"
  collisionMode="push"
/>
```

## Visualizar en Storybook

```bash
cd pkg-components
npm run sb
```

Navega a **organisms/GridStack/Engine Demo** para ver el engine en acción.

## API del GridEngine

| Método | Descripción |
|--------|-------------|
| `getLayout()` | Retorna copia del layout actual |
| `getConfig()` | Retorna la configuración resuelta |
| `setLayout(layout)` | Reemplaza el layout y notifica suscriptores |
| `subscribe(cb)` | Registra callback, retorna función de unsuscribe |
| `moveItem(id, x, y)` | Mueve un item, resuelve colisiones |
| `resizeItem(id, w, h)` | Redimensiona un item, resuelve colisiones |
| `addItem(item)` | Agrega item (busca posición válida). null si falla |
| `removeItem(id)` | Elimina item. null si no existe |

## Configuración del Engine

| Param | Default | Rango | Descripción |
|-------|---------|-------|-------------|
| `cols` | 12 | 1-48 | Número de columnas |
| `rowHeight` | 60 | 1-1000 | Altura de fila en px |
| `margin` | [10, 10] | — | Margen [horizontal, vertical] en px |
| `collisionMode` | 'push' | push/swap/push-first/none | Estrategia de colisión |
| `maxReflowDepth` | 8 | 1-50 | Límite de iteraciones de reflow |

## Estructura de Archivos

```
grid_stack_react_pure_js_module/
├── engine/
│   ├── grid-engine.ts    ← Motor puro TS (NO React)
│   └── types.ts          ← Tipos re-exportados
├── store/
│   ├── external-store.ts ← Estado con canales + per-item selectors
│   └── index.ts
├── types/
│   └── index.ts          ← Todas las interfaces
├── components/           ← Componente GridStack actual (legacy)
├── hooks/                ← useGrid (legacy)
├── __tests__/            ← Tests unitarios y property-based
├── __test-utils__/       ← Generadores fast-check, render-counter
└── grid_stack_react_pure_js_module.stories.tsx
```
