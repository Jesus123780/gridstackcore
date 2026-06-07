/**
 * src/components/DragLayer.jsx
 *
 * Renders an overlay layer used when dragging (the "ghost" element).
 * Uses the overlay object from useGrid which contains pxLeft, pxTop, widthPx, heightPx.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { InitialAnimationValue } from '../utils/constants';

const baseStyle = {
  position: 'absolute',
  left: 0,
  top: 0,
  zIndex: 999,
  pointerEvents: 'none',
  borderRadius: 8,
  overflow: 'hidden',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  background: 'white',
  transformOrigin: '0 0',
  opacity: 0.9,
  // translate3d activa GPU compositing — sin layout reflow en cada frame
  willChange: 'transform, width, height',
};

/**
 * DragLayer
 * @param {{
 *   overlay: {
 *     pxLeft?: number,
 *     pxTop?: number,
 *     widthPx?: number,
 *     heightPx?: number,
 *     offsetX?: number,
 *     offsetY?: number
 *   } | null,
 *   animation?: { duration?: number, easing?: string },
 *   children?: React.ReactNode
 * }} props
 */
const DragLayer = ({
  overlay,
  animation = InitialAnimationValue,
  children,
}) => {
  if (!overlay) return null;

  const pxLeft = Number.isFinite(overlay.pxLeft) ? overlay.pxLeft : 0;
  const pxTop = Number.isFinite(overlay.pxTop) ? overlay.pxTop : 0;
  const widthPx = Number.isFinite(overlay.widthPx) ? overlay.widthPx : undefined;
  const heightPx = Number.isFinite(overlay.heightPx) ? overlay.heightPx : undefined;

  // Usar transform: translate3d en lugar de left/top para evitar layout reflow
  const style = {
    ...baseStyle,
    transform: `translate3d(${pxLeft}px, ${pxTop}px, 0)`,
    left: 0,
    top: 0,
    ...(widthPx != null ? { width: `${widthPx}px` } : {}),
    ...(heightPx != null ? { height: `${heightPx}px` } : {}),
    transition: `transform ${animation.duration}ms ${animation.easing}, width ${animation.duration}ms ${animation.easing}, height ${animation.duration}ms ${animation.easing}`,
  };

  return (
    <div style={style} aria-hidden="true" data-drag-layer>
      {children}
    </div>
  );
};

DragLayer.propTypes = {
  overlay: PropTypes.shape({
    pxLeft: PropTypes.number,
    pxTop: PropTypes.number,
    widthPx: PropTypes.number,
    heightPx: PropTypes.number,
    offsetX: PropTypes.number,
    offsetY: PropTypes.number,
  }),
  animation: PropTypes.shape({
    duration: PropTypes.number,
    easing: PropTypes.string,
  }),
  children: PropTypes.node,
};

export default memo(DragLayer);