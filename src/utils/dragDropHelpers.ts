/**
 * Drag and Drop Helper Utilities
 * Extracted from vanilla GridStack D&D implementation
 */

export interface DDPosition {
  left: number;
  top: number;
}

export interface DDSize {
  width: number;
  height: number;
}

export interface DDEvent {
  position: DDPosition;
  size?: DDSize;
  target?: HTMLElement;
  clientX?: number;
  clientY?: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
}

export interface DragTransform {
  xScale: number;
  yScale: number;
  xOffset: number;
  yOffset: number;
}

/**
 * Drag and Drop utilities
 */
export const DDUtils = {
  /**
   * Get transform scale and offset from element
   */
  getElementTransform(el: HTMLElement): DragTransform {
    try {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const transform = style.transform;

      if (transform === 'none' || !transform) {
        return { xScale: 1, yScale: 1, xOffset: 0, yOffset: 0 };
      }

      // Parse matrix(a, b, c, d, e, f) format
      const matrixMatch = transform.match(/matrix(?:3d)?\((.+)\)/);
      if (!matrixMatch) {
        return { xScale: 1, yScale: 1, xOffset: 0, yOffset: 0 };
      }

      const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));

      return {
        xScale: values[0] || 1,
        yScale: values.length > 6 ? values[5] : values[3] || 1,
        xOffset: values[values.length - 2] || 0,
        yOffset: values[values.length - 1] || 0,
      };
    } catch (_) {
      return { xScale: 1, yScale: 1, xOffset: 0, yOffset: 0 };
    }
  },

  /**
   * Calculate relative position within container
   */
  getRelativePosition(
    position: DDPosition,
    container: HTMLElement
  ): DDPosition {
    const rect = container.getBoundingClientRect();
    return {
      left: position.left - rect.left,
      top: position.top - rect.top,
    };
  },

  /**
   * Apply scaling to position
   */
  scalePosition(
    position: DDPosition,
    scale: DragTransform
  ): DDPosition {
    return {
      left: position.left / scale.xScale,
      top: position.top / scale.yScale,
    };
  },

  /**
   * Get cell coordinates from pixel position
   */
  getCellCoordinates(
    position: DDPosition,
    cellWidth: number,
    cellHeight: number
  ): { x: number; y: number } {
    return {
      x: Math.floor(position.left / cellWidth),
      y: Math.floor(position.top / cellHeight),
    };
  },

  /**
   * Calculate grid rect for element
   */
  getGridRect(el: HTMLElement, container: HTMLElement): {
    left: number;
    top: number;
    width: number;
    height: number;
  } {
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    return {
      left: elRect.left - containerRect.left,
      top: elRect.top - containerRect.top,
      width: elRect.width,
      height: elRect.height,
    };
  },

  /**
   * Set pointer capture safely
   */
  setPointerCapture(el: HTMLElement, pointerId: number): boolean {
    try {
      el.setPointerCapture(pointerId);
      return true;
    } catch (err) {
      console.warn('Failed to set pointer capture:', err);
      return false;
    }
  },

  /**
   * Release pointer capture safely
   */
  releasePointerCapture(el: HTMLElement, pointerId: number): boolean {
    try {
      el.releasePointerCapture(pointerId);
      return true;
    } catch (err) {
      console.warn('Failed to release pointer capture:', err);
      return false;
    }
  },

  /**
   * Calculate drag offset (margin consideration)
   */
  calculateDragOffset(
    currentPos: DDPosition,
    lastPos: DDPosition,
    margin: number
  ): DDPosition {
    const dx = currentPos.left - lastPos.left;
    const dy = currentPos.top - lastPos.top;
    const moveThreshold = margin;

    // Add margin threshold to detect direction
    const adjustedX = currentPos.left + (dx > 0 ? -margin : margin);
    const adjustedY = currentPos.top + (dy > 0 ? -margin : margin);

    return {
      left: adjustedX,
      top: adjustedY,
    };
  },

  /**
   * Calculate movement velocity
   */
  getVelocity(
    currentPos: DDPosition,
    lastPos: DDPosition,
    deltaTime: number
  ): { vx: number; vy: number } {
    return {
      vx: (currentPos.left - lastPos.left) / Math.max(deltaTime, 1),
      vy: (currentPos.top - lastPos.top) / Math.max(deltaTime, 1),
    };
  },

  /**
   * Smooth scroll container
   */
  smoothScroll(
    container: HTMLElement,
    position: DDPosition,
    threshold: number = 50
  ): void {
    const containerRect = container.getBoundingClientRect();

    // Check if near top or bottom
    const fromTop = position.top - containerRect.top;
    const fromBottom = containerRect.bottom - position.top;

    if (fromTop < threshold && container.scrollTop > 0) {
      container.scrollTop -= Math.max(2, Math.round(threshold - fromTop));
    } else if (fromBottom < threshold) {
      container.scrollTop += Math.max(2, Math.round(threshold - fromBottom));
    }
  },

  /**
   * Check if element is draggable (not on non-draggable children)
   */
  isDraggableTarget(el: HTMLElement, dragHandle?: string): boolean {
    if (!dragHandle) return true;

    // Check if clicked element or any parent matches the handle selector
    let current: HTMLElement | null = el;
    while (current) {
      if (current.matches(dragHandle)) return true;
      current = current.parentElement;
    }
    return false;
  },

  /**
   * Create drag helper clone
   */
  createDragHelper(el: HTMLElement, options: { opacity?: number; scale?: number } = {}): HTMLElement {
    const helper = el.cloneNode(true) as HTMLElement;
    helper.id = '';
    helper.style.position = 'absolute';
    helper.style.opacity = String(options.opacity || 0.9);
    if (options.scale) {
      helper.style.transform = `scale(${options.scale})`;
    }
    helper.style.pointerEvents = 'none';
    helper.style.zIndex = '10000';
    return helper;
  },

  /**
   * Update scrolling during drag
   */
  updateDragScroll(
    e: any,
    container: HTMLElement,
    threshold: number = 50
  ): number {
    const rect = container.getBoundingClientRect();
    const scrollDistance = 10;
    let scrolled = 0;

    if (e.clientY < rect.top + threshold) {
      container.scrollTop = Math.max(0, container.scrollTop - scrollDistance);
      scrolled = -scrollDistance;
    } else if (e.clientY > rect.bottom - threshold) {
      container.scrollTop += scrollDistance;
      scrolled = scrollDistance;
    }

    return scrolled;
  },

  /**
   * Normalize drag position from scaled element
   */
  normalizeDragPosition(
    position: DDPosition,
    from: DragTransform,
    to: DragTransform
  ): DDPosition {
    return {
      left: (position.left - from.xOffset) / from.xScale + to.xOffset * to.xScale,
      top: (position.top - from.yOffset) / from.yScale + to.yOffset * to.yScale,
    };
  },
};

export default DDUtils;
