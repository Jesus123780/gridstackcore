import fc from 'fast-check';

/**
 * GridPosition interface matching the design document specification.
 * Used for property-based testing of the GridEngine and ExternalStore.
 */
export interface GridPosition {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
}

export interface GridEngineConfig {
  cols: number;
  rowHeight: number;
  margin: [number, number];
  collisionMode: 'push' | 'swap' | 'push-first' | 'none';
  maxReflowDepth: number;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a valid GridPosition with values within the specified column bounds.
 * Ensures: x >= 0, y >= 0, w >= 1, h >= 1, x + w <= cols
 */
export function arbGridPosition(cols = 12): fc.Arbitrary<GridPosition> {
  return fc
    .record({
      i: fc.stringMatching(/^[a-z][a-z0-9_-]{0,9}$/),
      w: fc.integer({ min: 1, max: cols }),
      h: fc.integer({ min: 1, max: 10 }),
      static: fc.oneof(fc.constant(undefined), fc.boolean()),
    })
    .chain(({ i, w, h, static: isStatic }) => {
      const maxX = Math.max(0, cols - w);
      const base = {
        i: fc.constant(i),
        x: fc.integer({ min: 0, max: maxX }),
        y: fc.integer({ min: 0, max: 50 }),
        w: fc.constant(w),
        h: fc.constant(h),
      };

      if (isStatic === undefined) {
        return fc.record(base);
      }

      return fc.record({ ...base, static: fc.constant(isStatic) });
    });
}

/**
 * Generates a valid layout array with no overlapping items within the configured columns.
 * Items are placed sequentially to guarantee non-overlapping positions.
 */
export function arbLayout(cols = 12, maxItems = 10): fc.Arbitrary<GridPosition[]> {
  return fc
    .integer({ min: 1, max: maxItems })
    .chain((count) => {
      return fc.array(
        fc.record({
          w: fc.integer({ min: 1, max: Math.min(cols, 4) }),
          h: fc.integer({ min: 1, max: 4 }),
          static: fc.oneof(fc.constant(undefined), fc.boolean()),
        }),
        { minLength: count, maxLength: count }
      );
    })
    .map((items) => placeItemsWithoutOverlap(items, cols));
}

/**
 * Places items sequentially in a grid without overlaps using a row-scan strategy.
 */
function placeItemsWithoutOverlap(
  items: Array<{ w: number; h: number; static?: boolean }>,
  cols: number
): GridPosition[] {
  const placed: GridPosition[] = [];
  let currentRow = 0;
  let currentCol = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const { w, h, static: isStatic } = items[idx];
    const clampedW = Math.min(w, cols);

    // If item doesn't fit in current row, move to next row
    if (currentCol + clampedW > cols) {
      currentRow += getMaxHeightInRow(placed, currentRow);
      currentCol = 0;
    }

    const position: GridPosition = {
      i: `item-${idx}`,
      x: currentCol,
      y: currentRow,
      w: clampedW,
      h,
    };

    if (isStatic !== undefined) {
      position.static = isStatic;
    }

    placed.push(position);
    currentCol += clampedW;
  }

  return placed;
}

/**
 * Gets the max height of items starting at a given row for row advancement.
 */
function getMaxHeightInRow(items: GridPosition[], row: number): number {
  const rowItems = items.filter((item) => item.y === row);
  if (rowItems.length === 0) return 1;
  return Math.max(...rowItems.map((item) => item.h));
}

/**
 * Generates a valid GridEngineConfig with all parameters within specified ranges.
 * cols: 1-48, rowHeight: 1-1000, margin: [number, number], 
 * collisionMode: push|swap|push-first|none, maxReflowDepth: 1-50
 */
export function arbGridEngineConfig(): fc.Arbitrary<GridEngineConfig> {
  return fc.record({
    cols: fc.integer({ min: 1, max: 48 }),
    rowHeight: fc.integer({ min: 1, max: 1000 }),
    margin: fc.tuple(
      fc.integer({ min: 0, max: 50 }),
      fc.integer({ min: 0, max: 50 })
    ) as fc.Arbitrary<[number, number]>,
    collisionMode: fc.constantFrom('push', 'swap', 'push-first', 'none') as fc.Arbitrary<
      'push' | 'swap' | 'push-first' | 'none'
    >,
    maxReflowDepth: fc.integer({ min: 1, max: 50 }),
  });
}

/**
 * Generates a layout along with a compatible config, ensuring items fit the config's column count.
 */
export function arbLayoutWithConfig(): fc.Arbitrary<{
  layout: GridPosition[];
  config: GridEngineConfig;
}> {
  return arbGridEngineConfig().chain((config) => {
    return arbLayout(config.cols, 8).map((layout) => ({
      layout,
      config,
    }));
  });
}

/**
 * Generates a unique item ID not present in the given layout.
 */
export function arbNewItemId(existingLayout: GridPosition[]): fc.Arbitrary<string> {
  const existingIds = new Set(existingLayout.map((item) => item.i));
  return fc
    .stringMatching(/^[a-z][a-z0-9_-]{0,9}$/)
    .filter((id) => !existingIds.has(id));
}
