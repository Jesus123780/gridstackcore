import React from 'react';

/**
 * Simulated heavy widget that renders exactly 500 DOM nodes.
 * Used in performance benchmark tests to validate that render isolation
 * prevents expensive re-renders during grid interactions.
 *
 * Structure: 1 root div + 10 sections × (1 section div + 49 span children) = 1 + 10 × 50 = 501
 * Adjusted to: 1 root div + 499 leaf spans = 500 total DOM nodes
 *
 * Validates: Requirement 10.6 — Performance benchmarks shall be automated as test cases
 */

const SECTION_COUNT = 20;
const ITEMS_PER_SECTION = 24; // 20 sections × 25 nodes each (1 div + 24 spans) = 500

export interface HeavyWidgetProps {
  id?: string;
  /** Called on each render for tracking purposes */
  onRender?: () => void;
}

/**
 * A React component that produces exactly 500 DOM nodes in its subtree.
 * Breakdown: 1 root div + 20 section divs + (20 × 24 spans) = 1 + 20 + 480 = 501
 * Adjusted: 1 root div + 19 section divs + (19 × 24 spans) + 1 section div + 23 spans
 *         = 1 + 20 + 479 = 500
 *
 * Actual calculation: root(1) + sections(20) + spans(20*24) = 1 + 20 + 480 = 501
 * Correction: root(1) + sections(20) + spans per section to total 500
 * Target: 500 nodes total
 * root div = 1
 * Remaining = 499 nodes to distribute
 * 499 / 25 = 19 sections with 25 nodes each (1 div + 24 spans) = 19 * 25 = 475
 * Remaining = 499 - 475 = 24 → 1 section div + 23 spans = 24
 * Total: 1 + 475 + 24 = 500 ✓
 */
export const HeavyWidget: React.FC<HeavyWidgetProps> = React.memo(({ id, onRender }) => {
  if (onRender) {
    onRender();
  }

  return (
    <div data-testid={`heavy-widget-${id ?? 'default'}`} data-heavy="true">
      {Array.from({ length: 19 }, (_, sectionIdx) => (
        <div key={`section-${sectionIdx}`} data-section={sectionIdx}>
          {Array.from({ length: 24 }, (_, itemIdx) => (
            <span key={`item-${itemIdx}`} data-item={`${sectionIdx}-${itemIdx}`}>
              {`cell-${sectionIdx}-${itemIdx}`}
            </span>
          ))}
        </div>
      ))}
      {/* Final section with 23 spans to reach exactly 500 nodes */}
      <div key="section-19" data-section={19}>
        {Array.from({ length: 23 }, (_, itemIdx) => (
          <span key={`item-${itemIdx}`} data-item={`19-${itemIdx}`}>
            {`cell-19-${itemIdx}`}
          </span>
        ))}
      </div>
    </div>
  );
});

HeavyWidget.displayName = 'HeavyWidget';

/**
 * Utility to count all DOM nodes in an element's subtree (inclusive).
 * Used in tests to verify the heavy widget produces exactly 500 nodes.
 */
export function countDomNodes(element: Element): number {
  let count = 1; // count the element itself
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  while (walker.nextNode()) {
    count++;
  }
  return count;
}
