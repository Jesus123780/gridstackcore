/**
 * GridStack Event System
 * Extracted from vanilla GridStack for reuse in React components
 */

export interface GridStackEventMap {
  'change': CustomEvent
  'added': CustomEvent
  'removed': CustomEvent
  'enable': Event
  'disable': Event
  'drag': CustomEvent
  'dragstart': CustomEvent
  'dragstop': CustomEvent
  'resizestart': CustomEvent
  'resize': CustomEvent
  'resizestop': CustomEvent
  'dropped': CustomEvent
  'resizecontent': CustomEvent
}

export type GridStackEventType = keyof GridStackEventMap;

type EventCallback = (event: Event | CustomEvent, data?: any) => void;

/**
 * Grid event handler manager - creates and manages custom events
 */
export class GridEventEmitter {
  private handlers: Map<string, EventCallback> = new Map();
  private element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  /**
   * Register event listener
   */
  on(name: string, callback: EventCallback): void {
    // Handle multiple space-separated event names
    if (name.indexOf(' ') !== -1) {
      name.split(' ').forEach(n => this.on(n, callback));
      return;
    }

    // Store handler for later removal
    if (
      name === 'change' ||
      name === 'added' ||
      name === 'removed' ||
      name === 'enable' ||
      name === 'disable'
    ) {
      const isNoData = name === 'enable' || name === 'disable';
      const handler = (event: Event) => {
        if (isNoData) {
          callback(event);
        } else {
          callback(event, (event as CustomEvent).detail);
        }
      };
      this.handlers.set(name, handler);
      this.element.addEventListener(name, handler);
    } else if (
      ['drag', 'dragstart', 'dragstop', 'resizestart', 'resize', 'resizestop', 'dropped', 'resizecontent'].includes(name)
    ) {
      // Store D&D handlers
      this.handlers.set(name, callback);
    }
  }

  /**
   * Unregister event listener
   */
  off(name: string): void {
    if (name.indexOf(' ') !== -1) {
      name.split(' ').forEach(n => this.off(n));
      return;
    }

    if (
      [
        'change',
        'added',
        'removed',
        'enable',
        'disable',
        'drag',
        'dragstart',
        'dragstop',
        'resizestart',
        'resize',
        'resizestop',
        'dropped',
        'resizecontent',
      ].includes(name)
    ) {
      const handler = this.handlers.get(name);
      if (handler) {
        if (
          [
            'change',
            'added',
            'removed',
            'enable',
            'disable',
          ].includes(name)
        ) {
          this.element.removeEventListener(name, handler);
        }
      }
    }
    this.handlers.delete(name);
  }

  /**
   * Remove all event listeners
   */
  offAll(): void {
    Array.from(this.handlers.keys()).forEach(key => this.off(key));
  }

  /**
   * Trigger custom event
   */
  trigger(type: string, data?: any): void {
    const event = data
      ? new CustomEvent(type, { bubbles: false, detail: data })
      : new Event(type);
    this.element.dispatchEvent(event);
  }

  /**
   * Get handler for a specific event
   */
  getHandler(name: string): EventCallback | undefined {
    return this.handlers.get(name);
  }

  /**
   * Check if handler exists
   */
  hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }
}

/**
 * Simple event emitter for non-DOM events
 */
export class EventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback?: EventCallback): void {
    if (!this.listeners.has(event)) return;
    
    if (callback) {
      this.listeners.get(event)!.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (!this.listeners.has(event)) return;
    
    this.listeners.get(event)!.forEach(callback => {
      try {
        callback(...args);
      } catch (err) {
        console.error(`Error in event listener for "${event}":`, err);
      }
    });
  }

  offAll(): void {
    this.listeners.clear();
  }

  hasListener(event: string): boolean {
    return this.listeners.has(event) && this.listeners.get(event)!.size > 0;
  }
}
