/**
 * src/components/DropIndicator/DropIndicator.jsx
 *
 * Small component that shows a visual indicator where the drop will land.
 */

import React, { useMemo } from 'react';
import styles from './DropIndicator.module.css'; // optional: you can fallback to inline style
import { getGlobalStyle } from '../../../../../helpers';
import { GridItem } from '../../types/types';

interface DropIndicatorProps {
  radio: number;
  target: GridItem | null;
  pxHelpers: {
    gridToPx: (value: number, isVertical: boolean) => number;
    widthPx: (w: number) => number;
    heightPx: (h: number) => number;
  } | null;
  animation?: { duration: number; easing: string };
}
/**
 * DropIndicator
 * @param {{radio: number, target: {x:number,y:number,w:number,h:number}, pxHelpers: object, animation: object}} props
 */
const DropIndicator: React.FC<DropIndicatorProps> = ({ radio, target, pxHelpers, animation = { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' } }) => {
  const style = useMemo((): React.CSSProperties => {
    if (!target || !pxHelpers) {
      return {}
    }

    const left = pxHelpers.gridToPx(target.x, false)
    const top = pxHelpers.gridToPx(target.y, true)
    const width = pxHelpers.widthPx(target.w)
    const height = pxHelpers.heightPx(target.h)

    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      zIndex: 998,
      backgroundColor: getGlobalStyle('--color-neutral-gray-silver'),
      borderRadius: radio,
      opacity: 0.7,
      transition: `all ${animation.duration}ms ${animation.easing}`,
      pointerEvents: 'none',
    };
  }, [target, pxHelpers, animation]);

  if (!target || !pxHelpers) return null;

  return <div className={styles.dropIndicator} style={style} data-drop-indicator />;
};

export default DropIndicator;
