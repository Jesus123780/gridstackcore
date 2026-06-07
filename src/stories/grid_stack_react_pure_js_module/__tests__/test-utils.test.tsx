import React from 'react';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import {
  arbGridPosition,
  arbLayout,
  arbGridEngineConfig,
  arbLayoutWithConfig,
} from '../__test-utils__/generators';
import { RenderTracker, RenderSpy } from '../__test-utils__/render-counter';
import { HeavyWidget, countDomNodes } from '../__test-utils__/heavy-widget';

describe('Test Utilities', () => {
  describe('generators', () => {
    it('arbGridPosition generates valid positions within column bounds', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 48 }), (cols) => {
          return fc.assert(
            fc.property(arbGridPosition(cols), (pos) => {
              expect(pos.x).toBeGreaterThanOrEqual(0);
              expect(pos.y).toBeGreaterThanOrEqual(0);
              expect(pos.w).toBeGreaterThanOrEqual(1);
              expect(pos.h).toBeGreaterThanOrEqual(1);
              expect(pos.x + pos.w).toBeLessThanOrEqual(cols);
              expect(pos.i).toBeTruthy();
            }),
            { numRuns: 20 }
          );
        }),
        { numRuns: 5 }
      );
    });

    it('arbLayout generates non-overlapping items', () => {
      fc.assert(
        fc.property(arbLayout(12, 6), (layout) => {
          for (let i = 0; i < layout.length; i++) {
            for (let j = i + 1; j < layout.length; j++) {
              const a = layout[i];
              const b = layout[j];
              const overlapsX = a.x < b.x + b.w && a.x + a.w > b.x;
              const overlapsY = a.y < b.y + b.h && a.y + a.h > b.y;
              expect(overlapsX && overlapsY).toBe(false);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('arbGridEngineConfig generates configs within valid ranges', () => {
      fc.assert(
        fc.property(arbGridEngineConfig(), (config) => {
          expect(config.cols).toBeGreaterThanOrEqual(1);
          expect(config.cols).toBeLessThanOrEqual(48);
          expect(config.rowHeight).toBeGreaterThanOrEqual(1);
          expect(config.rowHeight).toBeLessThanOrEqual(1000);
          expect(config.margin).toHaveLength(2);
          expect(config.margin[0]).toBeGreaterThanOrEqual(0);
          expect(config.margin[1]).toBeGreaterThanOrEqual(0);
          expect(['push', 'swap', 'push-first', 'none']).toContain(config.collisionMode);
          expect(config.maxReflowDepth).toBeGreaterThanOrEqual(1);
          expect(config.maxReflowDepth).toBeLessThanOrEqual(50);
        }),
        { numRuns: 100 }
      );
    });

    it('arbLayoutWithConfig generates layouts fitting config bounds', () => {
      fc.assert(
        fc.property(arbLayoutWithConfig(), ({ layout, config }) => {
          for (const item of layout) {
            expect(item.x + item.w).toBeLessThanOrEqual(config.cols);
            expect(item.x).toBeGreaterThanOrEqual(0);
            expect(item.y).toBeGreaterThanOrEqual(0);
            expect(item.w).toBeGreaterThanOrEqual(1);
            expect(item.h).toBeGreaterThanOrEqual(1);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('render-counter', () => {
    it('RenderTracker tracks render counts', () => {
      const tracker = new RenderTracker();

      tracker.increment('comp-1');
      tracker.increment('comp-1');
      tracker.increment('comp-2');

      expect(tracker.getCount('comp-1')).toBe(2);
      expect(tracker.getCount('comp-2')).toBe(1);
      expect(tracker.getCount('comp-3')).toBe(0);
    });

    it('RenderTracker resets all counts', () => {
      const tracker = new RenderTracker();
      tracker.increment('comp-1');
      tracker.increment('comp-2');

      tracker.reset();

      expect(tracker.getCount('comp-1')).toBe(0);
      expect(tracker.getCount('comp-2')).toBe(0);
    });

    it('RenderSpy increments tracker on each render', () => {
      const tracker = new RenderTracker();

      const { rerender } = render(
        <RenderSpy tracker={tracker} id="spy-1">
          <span>content</span>
        </RenderSpy>
      );

      expect(tracker.getCount('spy-1')).toBe(1);

      rerender(
        <RenderSpy tracker={tracker} id="spy-1">
          <span>updated</span>
        </RenderSpy>
      );

      expect(tracker.getCount('spy-1')).toBe(2);
    });
  });

  describe('heavy-widget', () => {
    it('renders exactly 500 DOM nodes', () => {
      const { container } = render(<HeavyWidget id="test" />);
      const widget = container.querySelector('[data-heavy="true"]');
      expect(widget).not.toBeNull();
      const nodeCount = countDomNodes(widget!);
      expect(nodeCount).toBe(500);
    });

    it('calls onRender callback when rendered', () => {
      const onRender = jest.fn();
      render(<HeavyWidget id="test" onRender={onRender} />);
      expect(onRender).toHaveBeenCalledTimes(1);
    });

    it('does not re-render with same props due to React.memo', () => {
      const onRender = jest.fn();
      const { rerender } = render(<HeavyWidget id="test" onRender={onRender} />);
      expect(onRender).toHaveBeenCalledTimes(1);

      rerender(<HeavyWidget id="test" onRender={onRender} />);
      expect(onRender).toHaveBeenCalledTimes(1);
    });
  });
});
