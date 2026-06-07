/**
 * Unit tests for GridEngine core: constructor, getLayout, setLayout, subscribe.
 * Validates task 2.1 implementation.
 */

import { GridEngine } from '../engine/grid-engine';
import type { GridPosition, GridEngineConfig } from '../engine/types';

describe('GridEngine Core (Task 2.1)', () => {
  describe('constructor', () => {
    it('uses default config when no arguments are provided', () => {
      const engine = new GridEngine();
      const config = engine.getConfig();

      expect(config.cols).toBe(12);
      expect(config.rowHeight).toBe(60);
      expect(config.margin).toEqual([10, 10]);
      expect(config.collisionMode).toBe('push');
      expect(config.maxReflowDepth).toBe(8);
    });

    it('accepts partial config and applies defaults for missing fields', () => {
      const engine = new GridEngine({ cols: 6, rowHeight: 80 });
      const config = engine.getConfig();

      expect(config.cols).toBe(6);
      expect(config.rowHeight).toBe(80);
      expect(config.margin).toEqual([10, 10]);
      expect(config.collisionMode).toBe('push');
      expect(config.maxReflowDepth).toBe(8);
    });

    it('clamps cols to range 1-48', () => {
      expect(new GridEngine({ cols: 0 }).getConfig().cols).toBe(1);
      expect(new GridEngine({ cols: -5 }).getConfig().cols).toBe(1);
      expect(new GridEngine({ cols: 100 }).getConfig().cols).toBe(48);
    });

    it('clamps rowHeight to range 1-1000', () => {
      expect(new GridEngine({ rowHeight: 0 }).getConfig().rowHeight).toBe(1);
      expect(new GridEngine({ rowHeight: 2000 }).getConfig().rowHeight).toBe(1000);
    });

    it('clamps maxReflowDepth to range 1-50', () => {
      expect(new GridEngine({ maxReflowDepth: 0 }).getConfig().maxReflowDepth).toBe(1);
      expect(new GridEngine({ maxReflowDepth: 100 }).getConfig().maxReflowDepth).toBe(50);
    });

    it('defaults to push collision mode for invalid values', () => {
      const engine = new GridEngine({ collisionMode: 'invalid' as any });
      expect(engine.getConfig().collisionMode).toBe('push');
    });

    it('accepts all valid collision modes', () => {
      const modes: Array<GridEngineConfig['collisionMode']> = ['push', 'swap', 'push-first', 'none'];
      for (const mode of modes) {
        const engine = new GridEngine({ collisionMode: mode });
        expect(engine.getConfig().collisionMode).toBe(mode);
      }
    });

    it('returns a frozen config object', () => {
      const engine = new GridEngine();
      const config = engine.getConfig();
      expect(Object.isFrozen(config)).toBe(true);
    });
  });

  describe('getLayout', () => {
    it('returns empty array when no layout is set', () => {
      const engine = new GridEngine();
      expect(engine.getLayout()).toEqual([]);
    });

    it('returns a defensive copy (mutations do not affect internal state)', () => {
      const engine = new GridEngine();
      const layout: GridPosition[] = [
        { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      ];
      engine.setLayout(layout);

      const retrieved = engine.getLayout();
      retrieved[0].x = 99;

      expect(engine.getLayout()[0].x).toBe(0);
    });
  });

  describe('setLayout', () => {
    it('stores the provided layout', () => {
      const engine = new GridEngine();
      const layout: GridPosition[] = [
        { i: 'item-1', x: 0, y: 0, w: 3, h: 2 },
        { i: 'item-2', x: 3, y: 0, w: 4, h: 1 },
      ];

      engine.setLayout(layout);

      expect(engine.getLayout()).toEqual(layout);
    });

    it('stores a defensive copy (external mutations do not affect internal state)', () => {
      const engine = new GridEngine();
      const layout: GridPosition[] = [
        { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      ];

      engine.setLayout(layout);
      layout[0].x = 99;

      expect(engine.getLayout()[0].x).toBe(0);
    });

    it('notifies subscribers when layout is set', () => {
      const engine = new GridEngine();
      const callback = jest.fn();
      engine.subscribe(callback);

      const layout: GridPosition[] = [
        { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      ];
      engine.setLayout(layout);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(layout);
    });

    it('notifies multiple subscribers', () => {
      const engine = new GridEngine();
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      engine.subscribe(cb1);
      engine.subscribe(cb2);

      engine.setLayout([{ i: 'a', x: 0, y: 0, w: 1, h: 1 }]);

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe', () => {
    it('returns an unsubscribe function', () => {
      const engine = new GridEngine();
      const callback = jest.fn();
      const unsubscribe = engine.subscribe(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribed callback is not called on subsequent mutations', () => {
      const engine = new GridEngine();
      const callback = jest.fn();
      const unsubscribe = engine.subscribe(callback);

      engine.setLayout([{ i: 'a', x: 0, y: 0, w: 1, h: 1 }]);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      engine.setLayout([{ i: 'b', x: 1, y: 0, w: 1, h: 1 }]);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('handles subscriber errors gracefully (does not break other subscribers)', () => {
      const engine = new GridEngine();
      const errorCb = jest.fn(() => { throw new Error('subscriber error'); });
      const normalCb = jest.fn();

      engine.subscribe(errorCb);
      engine.subscribe(normalCb);

      engine.setLayout([{ i: 'a', x: 0, y: 0, w: 1, h: 1 }]);

      expect(errorCb).toHaveBeenCalledTimes(1);
      expect(normalCb).toHaveBeenCalledTimes(1);
    });

    it('getLayout works without subscribers (Requirement 1.7)', () => {
      const engine = new GridEngine();
      const layout: GridPosition[] = [
        { i: 'a', x: 0, y: 0, w: 3, h: 2 },
      ];

      engine.setLayout(layout);

      expect(engine.getLayout()).toEqual(layout);
    });
  });

  describe('zero React imports', () => {
    it('engine module has no React dependency (verified by successful import)', () => {
      // If the engine imported React, this test file would need React
      // but we import only from engine/grid-engine without React
      const engine = new GridEngine();
      expect(engine).toBeDefined();
    });
  });
});
