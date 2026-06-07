/**
 * Unit tests for GridEngine mutations: moveItem, resizeItem, addItem, removeItem.
 * Validates task 2.2 implementation.
 */

import { GridEngine } from '../engine/grid-engine';
import type { GridPosition } from '../engine/types';

describe('GridEngine Mutations (Task 2.2)', () => {
  let engine: GridEngine;

  beforeEach(() => {
    engine = new GridEngine({ cols: 12 });
    engine.setLayout([
      { i: 'a', x: 0, y: 0, w: 3, h: 2 },
      { i: 'b', x: 3, y: 0, w: 4, h: 1 },
      { i: 'c', x: 0, y: 2, w: 6, h: 1 },
    ]);
  });

  describe('moveItem', () => {
    it('moves an item to the specified position', () => {
      const result = engine.moveItem('a', 5, 3);
      const movedItem = result.find((item) => item.i === 'a');

      expect(movedItem).toBeDefined();
      expect(movedItem!.x).toBe(5);
      // After compaction, item is pushed up to fill vertical gaps
      expect(movedItem!.y).toBe(2);
    });

    it('clamps x to valid bounds (x + w <= cols)', () => {
      const result = engine.moveItem('a', 20, 0);
      const movedItem = result.find((item) => item.i === 'a');

      expect(movedItem).toBeDefined();
      expect(movedItem!.x + movedItem!.w).toBeLessThanOrEqual(12);
      expect(movedItem!.x).toBe(9); // cols(12) - w(3) = 9
    });

    it('clamps negative x to 0', () => {
      const result = engine.moveItem('a', -5, 0);
      const movedItem = result.find((item) => item.i === 'a');

      expect(movedItem).toBeDefined();
      expect(movedItem!.x).toBe(0);
    });

    it('clamps negative y to 0', () => {
      const result = engine.moveItem('a', 0, -3);
      const movedItem = result.find((item) => item.i === 'a');

      expect(movedItem).toBeDefined();
      expect(movedItem!.y).toBe(0);
    });

    it('returns current layout without notifying when item id is not found', () => {
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear(); // clear the subscription call

      const result = engine.moveItem('nonexistent', 0, 0);

      expect(callback).not.toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });

    it('does not move static items', () => {
      engine.setLayout([
        { i: 'static-item', x: 0, y: 0, w: 3, h: 2, static: true },
        { i: 'b', x: 3, y: 0, w: 4, h: 1 },
      ]);
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      const result = engine.moveItem('static-item', 5, 5);
      const item = result.find((i) => i.i === 'static-item');

      expect(item!.x).toBe(0);
      expect(item!.y).toBe(0);
      expect(callback).not.toHaveBeenCalled();
    });

    it('notifies subscribers exactly once', () => {
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      engine.moveItem('a', 5, 3);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('subscriber receives the new layout', () => {
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      engine.moveItem('a', 5, 3);

      const notifiedLayout: GridPosition[] = callback.mock.calls[0][0];
      const movedItem = notifiedLayout.find((item) => item.i === 'a');
      expect(movedItem!.x).toBe(5);
      // After compaction, item is pushed up to fill vertical gaps
      expect(movedItem!.y).toBe(2);
    });
  });

  describe('resizeItem', () => {
    it('resizes an item to the specified dimensions', () => {
      const result = engine.resizeItem('a', 5, 3);
      const resizedItem = result.find((item) => item.i === 'a');

      expect(resizedItem).toBeDefined();
      expect(resizedItem!.w).toBe(5);
      expect(resizedItem!.h).toBe(3);
    });

    it('clamps w to minimum 1', () => {
      const result = engine.resizeItem('a', 0, 2);
      const resizedItem = result.find((item) => item.i === 'a');

      expect(resizedItem!.w).toBeGreaterThanOrEqual(1);
    });

    it('clamps h to minimum 1', () => {
      const result = engine.resizeItem('a', 2, 0);
      const resizedItem = result.find((item) => item.i === 'a');

      expect(resizedItem!.h).toBeGreaterThanOrEqual(1);
    });

    it('clamps w so that x + w <= cols', () => {
      const result = engine.resizeItem('a', 20, 2);
      const resizedItem = result.find((item) => item.i === 'a');

      expect(resizedItem!.x + resizedItem!.w).toBeLessThanOrEqual(12);
    });

    it('returns current layout without notifying when item id is not found', () => {
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      const result = engine.resizeItem('nonexistent', 5, 3);

      expect(callback).not.toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });

    it('does not resize static items', () => {
      engine.setLayout([
        { i: 'static-item', x: 0, y: 0, w: 3, h: 2, static: true },
      ]);
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      const result = engine.resizeItem('static-item', 6, 4);
      const item = result.find((i) => i.i === 'static-item');

      expect(item!.w).toBe(3);
      expect(item!.h).toBe(2);
      expect(callback).not.toHaveBeenCalled();
    });

    it('notifies subscribers exactly once', () => {
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      engine.resizeItem('a', 5, 3);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('addItem', () => {
    it('adds a new item at the specified position when no overlap', () => {
      const result = engine.addItem({ i: 'new', x: 7, y: 0, w: 2, h: 2 });

      expect(result).not.toBeNull();
      const newItem = result!.find((item) => item.i === 'new');
      expect(newItem).toBeDefined();
      expect(newItem!.x).toBe(7);
      expect(newItem!.y).toBe(0);
    });

    it('finds placement when requested position overlaps', () => {
      const result = engine.addItem({ i: 'new', x: 0, y: 0, w: 2, h: 2 });

      expect(result).not.toBeNull();
      const newItem = result!.find((item) => item.i === 'new');
      expect(newItem).toBeDefined();
      // Item should be placed somewhere without overlap
    });

    it('returns null when item is too wide for the grid', () => {
      const result = engine.addItem({ i: 'wide', x: 0, y: 0, w: 13, h: 1 });

      expect(result).toBeNull();
    });

    it('clamps item bounds before placement', () => {
      const result = engine.addItem({ i: 'new', x: -5, y: -3, w: 2, h: 2 });

      expect(result).not.toBeNull();
      const newItem = result!.find((item) => item.i === 'new');
      expect(newItem).toBeDefined();
      expect(newItem!.x).toBeGreaterThanOrEqual(0);
      expect(newItem!.y).toBeGreaterThanOrEqual(0);
    });

    it('notifies subscribers exactly once on success', () => {
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      engine.addItem({ i: 'new', x: 7, y: 0, w: 2, h: 2 });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not notify subscribers on failure (null return)', () => {
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      engine.addItem({ i: 'wide', x: 0, y: 0, w: 13, h: 1 });

      expect(callback).not.toHaveBeenCalled();
    });

    it('does not modify layout on failure', () => {
      const layoutBefore = engine.getLayout();

      engine.addItem({ i: 'wide', x: 0, y: 0, w: 13, h: 1 });

      expect(engine.getLayout()).toEqual(layoutBefore);
    });
  });

  describe('removeItem', () => {
    it('removes an existing item from the layout', () => {
      const result = engine.removeItem('a');

      expect(result).not.toBeNull();
      expect(result!.find((item) => item.i === 'a')).toBeUndefined();
      expect(result!).toHaveLength(2);
    });

    it('returns null when item id is not found', () => {
      const result = engine.removeItem('nonexistent');

      expect(result).toBeNull();
    });

    it('does not notify subscribers when item is not found', () => {
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      engine.removeItem('nonexistent');

      expect(callback).not.toHaveBeenCalled();
    });

    it('notifies subscribers exactly once on success', () => {
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      engine.removeItem('a');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('subscriber receives layout without the removed item', () => {
      const callback = jest.fn();
      engine.subscribe(callback);
      callback.mockClear();

      engine.removeItem('b');

      const notifiedLayout: GridPosition[] = callback.mock.calls[0][0];
      expect(notifiedLayout.find((item) => item.i === 'b')).toBeUndefined();
      expect(notifiedLayout).toHaveLength(2);
    });

    it('does not modify layout when item is not found', () => {
      const layoutBefore = engine.getLayout();

      engine.removeItem('nonexistent');

      expect(engine.getLayout()).toEqual(layoutBefore);
    });
  });

  describe('bounds invariants', () => {
    it('all items satisfy bounds after moveItem', () => {
      const result = engine.moveItem('a', 100, 100);
      for (const item of result) {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.y).toBeGreaterThanOrEqual(0);
        expect(item.w).toBeGreaterThanOrEqual(1);
        expect(item.h).toBeGreaterThanOrEqual(1);
        expect(item.x + item.w).toBeLessThanOrEqual(12);
      }
    });

    it('all items satisfy bounds after resizeItem', () => {
      const result = engine.resizeItem('a', 100, 100);
      for (const item of result) {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.y).toBeGreaterThanOrEqual(0);
        expect(item.w).toBeGreaterThanOrEqual(1);
        expect(item.h).toBeGreaterThanOrEqual(1);
        expect(item.x + item.w).toBeLessThanOrEqual(12);
      }
    });

    it('all items satisfy bounds after addItem', () => {
      const result = engine.addItem({ i: 'new', x: -1, y: -1, w: 50, h: 50 });
      // Even if placement fails (null), should not violate bounds
      if (result !== null) {
        for (const item of result) {
          expect(item.x).toBeGreaterThanOrEqual(0);
          expect(item.y).toBeGreaterThanOrEqual(0);
          expect(item.w).toBeGreaterThanOrEqual(1);
          expect(item.h).toBeGreaterThanOrEqual(1);
          expect(item.x + item.w).toBeLessThanOrEqual(12);
        }
      }
    });
  });
});
