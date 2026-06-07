/**
 * Core Utility Functions
 * Extracted and adapted from vanilla GridStack for reuse in React
 */

/**
 * Parse height/dimension values with units
 */
export interface ParsedDimension {
  h: number;
  unit: string;
}

/**
 * Utility functions extracted from vanilla GridStack
 */
export const GridStackUtils = {
  /**
   * Parse height value (e.g., "100px", "5rem") into number and unit
   */
  parseHeight(val: string | number | undefined): ParsedDimension {
    if (!val) return { h: 0, unit: 'px' };
    if (typeof val === 'number') return { h: val, unit: 'px' };

    const match = val.toString().match(/^(\d+\.?\d*)\s*(.*)/);
    if (!match) return { h: 0, unit: 'px' };

    return {
      h: parseFloat(match[1]),
      unit: match[2] || 'px',
    };
  },

  /**
   * Convert string to number, returning undefined if not valid
   */
  toNumber(val: string | null | undefined): number | undefined {
    if (!val) return undefined;
    const n = parseInt(val, 10);
    return isNaN(n) ? undefined : n;
  },

  /**
   * Convert string to boolean
   */
  toBool(val: string | null | undefined): boolean {
    return val === 'true' || val === '1' || val === 'yes';
  },

  /**
   * Get element(s) by selector or return if already an element
   */
  getElement(els: string | HTMLElement | undefined = '.grid-stack-item'): HTMLElement | null {
    if (typeof els === 'string') {
      return document.querySelector(els);
    }
    return els || null;
  },

  /**
   * Get multiple elements by selector
   */
  getElements(els: string | HTMLElement[] = '.grid-stack-item', root: Document | HTMLElement = document): HTMLElement[] {
    if (typeof els === 'string') {
      return Array.from((root as Document | HTMLElement).querySelectorAll(els));
    }
    return Array.isArray(els) ? els : [];
  },

  /**
   * Deep clone object
   */
  cloneDeep<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as any;
    if (obj instanceof Array) {
      const copy: any = [];
      for (let i = 0; i < obj.length; i++) {
        copy[i] = this.cloneDeep(obj[i]);
      }
      return copy;
    }
    if (obj instanceof Object) {
      const copy: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          copy[key] = this.cloneDeep((obj as any)[key]);
        }
      }
      return copy;
    }
  },

  /**
   * Shallow merge objects (defaults first, then override)
   */
  defaults<T extends Record<string, any>>(obj: T, ...defs: Partial<T>[]): T {
    for (const def of defs) {
      for (const key in def) {
        if (def.hasOwnProperty(key) && obj[key] === undefined) {
          obj[key] = def[key];
        }
      }
    }
    return obj;
  },

  /**
   * Copy position attributes (x, y, w, h) between objects
   */
  copyPos<T extends { x?: number; y?: number; w?: number; h?: number }>(
    target: T,
    source: T
  ): T {
    if (source.x !== undefined) target.x = source.x;
    if (source.y !== undefined) target.y = source.y;
    if (source.w !== undefined) target.w = source.w;
    if (source.h !== undefined) target.h = source.h;
    return target;
  },

  /**
   * Create DOM element with classes
   */
  createDiv(classes: string[] = [], parent?: HTMLElement): HTMLElement {
    const el = document.createElement('div');
    classes.forEach(c => el.classList.add(c));
    if (parent) parent.appendChild(el);
    return el;
  },

  /**
   * Throttle function execution
   */
  throttle(func: (...args: any[]) => void, wait: number): (...args: any[]) => void {
    let timeout: NodeJS.Timeout | null = null;
    let previous = 0;

    return function (this: any, ...args: any[]) {
      const now = Date.now();
      const remaining = wait - (now - previous);

      if (remaining <= 0 || remaining > wait) {
        if (timeout) clearTimeout(timeout);
        previous = now;
        func.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          previous = Date.now();
          timeout = null;
          func.apply(this, args);
        }, remaining);
      }
    };
  },

  /**
   * Debounce function execution
   */
  debounce(func: (...args: any[]) => void, wait: number): (...args: any[]) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function (this: any, ...args: any[]) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(this, args);
      }, wait);
    };
  },

  /**
   * Remove positioning styles from element
   */
  removePositioningStyles(el: HTMLElement): void {
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.height = '';
  },

  /**
   * Simulate mouse event (for internal grid transfers)
   */
  simulateMouseEvent(originalEvent: any, type: string, target: HTMLElement): void {
    if (!originalEvent) return;

    const evt = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: originalEvent.clientX || 0,
      clientY: originalEvent.clientY || 0,
    });
    target.dispatchEvent(evt);
  },

  /**
   * Check if two position objects are the same
   */
  samePos(
    a: { x?: number; y?: number; w?: number; h?: number },
    b: { x?: number; y?: number; w?: number; h?: number }
  ): boolean {
    return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  },

  /**
   * Calculate euclidean distance between two points
   */
  distance(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    return Math.hypot(x2 - x1, y2 - y1);
  },

  /**
   * Clamp value between min and max
   */
  clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  },

  /**
   * Check if rect overlaps another
   */
  rectsOverlap(
    rect1: { left: number; top: number; width: number; height: number },
    rect2: { left: number; top: number; width: number; height: number }
  ): boolean {
    return !(
      rect1.left + rect1.width <= rect2.left ||
      rect2.left + rect2.width <= rect1.left ||
      rect1.top + rect1.height <= rect2.top ||
      rect2.top + rect2.height <= rect1.top
    );
  },

  /**
   * Get computed transform values from element
   */
  getValuesFromTransformedElement(el: HTMLElement): {
    xScale: number;
    yScale: number;
    xOffset: number;
    yOffset: number;
  } {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const transform = style.transform;

    if (transform === 'none') {
      return { xScale: 1, yScale: 1, xOffset: 0, yOffset: 0 };
    }

    const matrix = transform.match(/matrix\((.+)\)/);
    if (!matrix) {
      return { xScale: 1, yScale: 1, xOffset: 0, yOffset: 0 };
    }

    const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
    return {
      xScale: values[0] || 1,
      yScale: values[3] || 1,
      xOffset: values[4] || 0,
      yOffset: values[5] || 0,
    };
  },

  /**
   * Update scroll position while dragging
   */
  updateScrollPosition(el: HTMLElement, position: { left: number; top: number }, distance: number): void {
    const container = el.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scrollThreshold = 50; // pixels from edge to trigger scroll

    // Scroll vertically
    if (distance > 0) {
      // Moving down
      if (containerRect.bottom - position.top < scrollThreshold) {
        container.scrollTop += Math.min(distance, 10);
      }
    } else {
      // Moving up
      if (position.top - containerRect.top < scrollThreshold) {
        container.scrollTop += Math.max(distance, -10);
      }
    }
  },

  /**
   * Update scroll during resize
   */
  updateScrollResize(event: any, el: HTMLElement, cellHeight: number): void {
    if (!event || typeof event.clientY !== 'number') return;

    const viewport = window.innerHeight;
    const scrollThreshold = 100;

    if (event.clientY > viewport - scrollThreshold) {
      window.scrollBy(0, 10);
    }
    if (event.clientY < scrollThreshold) {
      window.scrollBy(0, -10);
    }
  },

  /**
   * Find item by id in array
   */
  find<T extends { id?: string | number }>(arr: T[], id: string | number | undefined): T | undefined {
    if (!id) return undefined;
    return arr.find(item => item.id === id);
  },

  /**
   * Sort items (placing undefined coords last)
   */
  sort<T extends { x?: number; y?: number }>(items: T[]): T[] {
    return items.sort((a, b) => {
      const aHasPos = a.x !== undefined && a.y !== undefined;
      const bHasPos = b.x !== undefined && b.y !== undefined;
      if (aHasPos && !bHasPos) return -1;
      if (!aHasPos && bHasPos) return 1;
      if (!aHasPos && !bHasPos) return 0;
      return (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0);
    });
  },
};

export default GridStackUtils;
