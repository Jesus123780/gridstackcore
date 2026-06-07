import React, { useRef } from 'react';

/**
 * Hook that tracks the number of times a component renders.
 * Returns a ref whose `.current` value is the render count.
 *
 * Usage in tests:
 * ```tsx
 * function TestComponent() {
 *   const renderCount = useRenderCount();
 *   return <div data-testid="count">{renderCount.current}</div>;
 * }
 * ```
 */
export function useRenderCount(): React.RefObject<number> {
  const count = useRef(0);
  count.current += 1;
  return count;
}

/**
 * A map to store render counts for components by their key/id.
 * Useful for asserting render counts in integration tests.
 */
export class RenderTracker {
  private readonly counts: Map<string, number> = new Map();

  increment(id: string): void {
    this.counts.set(id, (this.counts.get(id) ?? 0) + 1);
  }

  getCount(id: string): number {
    return this.counts.get(id) ?? 0;
  }

  reset(): void {
    this.counts.clear();
  }

  getAllCounts(): Record<string, number> {
    const result: Record<string, number> = {};
    this.counts.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}

/**
 * HOC that wraps a component and tracks its render count via a shared RenderTracker.
 *
 * Usage in tests:
 * ```tsx
 * const tracker = new RenderTracker();
 * const TrackedWidget = withRenderTracking(MyWidget, tracker, 'widget-1');
 *
 * render(<TrackedWidget />);
 * expect(tracker.getCount('widget-1')).toBe(1);
 * ```
 */
export function withRenderTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  tracker: RenderTracker,
  id: string
): React.FC<P> {
  const TrackedComponent: React.FC<P> = (props) => {
    tracker.increment(id);
    return <WrappedComponent {...props} />;
  };

  TrackedComponent.displayName = `Tracked(${id})`;
  return TrackedComponent;
}

/**
 * A component that reports its render count to a tracker.
 * Useful as a direct child for testing render isolation.
 *
 * Usage in tests:
 * ```tsx
 * const tracker = new RenderTracker();
 *
 * render(
 *   <GridItemContent id="item-1" widthPx={200} heightPx={100}>
 *     <RenderSpy tracker={tracker} id="item-1" />
 *   </GridItemContent>
 * );
 *
 * // After some interaction...
 * expect(tracker.getCount('item-1')).toBe(1); // only initial render
 * ```
 */
export interface RenderSpyProps {
  tracker: RenderTracker;
  id: string;
  children?: React.ReactNode;
}

export const RenderSpy: React.FC<RenderSpyProps> = ({ tracker, id, children }) => {
  tracker.increment(id);
  return <>{children}</>;
};

RenderSpy.displayName = 'RenderSpy';

/**
 * Hook version of the render spy. Tracks renders via a tracker instance.
 *
 * Usage:
 * ```tsx
 * function TestChild({ tracker }: { tracker: RenderTracker }) {
 *   useRenderSpy(tracker, 'my-component');
 *   return <div>content</div>;
 * }
 * ```
 */
export function useRenderSpy(tracker: RenderTracker, id: string): void {
  const isFirstRender = useRef(true);

  if (isFirstRender.current) {
    isFirstRender.current = false;
    tracker.increment(id);
  } else {
    tracker.increment(id);
  }
}
