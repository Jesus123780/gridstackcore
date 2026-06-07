/**
 * src/components/ResizeHandles/ResizeHandles.jsx
 *
 * ResizeHandles: handles con quarter-arc y posicionamiento SVG fijo (-16px).
 */

import React, { 
  useState, 
  useRef, 
  useEffect
} from 'react'
import { getGlobalStyle } from '../../../../../helpers'
import type { Corner } from '../../utils/constants'

const TWO_PI = Math.PI * 2

const normAngle = (a: number) => {
  let r = a % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r;
};

function computeArcInterval(start: [number, number], end: [number, number], center: number) {
  const s = normAngle(Math.atan2(start[1] - center, start[0] - center));
  const e = normAngle(Math.atan2(end[1] - center, end[0] - center));
  const diff = (e - s + TWO_PI) % TWO_PI;
  if (diff <= Math.PI) {
    return { arcStart: s, arcEnd: s + diff };
  } else {
    const diff2 = (s - e + TWO_PI) % TWO_PI;
    return { arcStart: e, arcEnd: e + diff2 };
  }
}

interface ResizeHandlesProps {
  corners: Corner[];
  onPointerDown?: (e: React.PointerEvent, corner: Corner) => void;
  radio?: number;
  grosor?: number;
  showMarkerOnHover?: boolean;
  hoverStrokeOpacity?: number;
  maxVisualSize?: number;
  svgOffset?: number;
}

const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  corners = ['se'],
  onPointerDown = () => {},
  radio = 14,
  grosor = 3,
  showMarkerOnHover = true,
  hoverStrokeOpacity = 0.9,
  maxVisualSize = 120, // si SIZE > maxVisualSize se aplica scale visual
  svgOffset = 16, // valor fijo de offset (px) que pediste: -16px en la esquina
}) => {
  // geometría real (usamos radio tal cual)
  const HANDLE_SIZE = 14;
  const STROKE = grosor;
  const SIZE = 2 * radio + 2 * STROKE; // viewBox size
  const CENTER = radio + STROKE;

  // escala visual para evitar que el SVG se salga de la vista
  const scale = SIZE > maxVisualSize ? maxVisualSize / SIZE : 1;

  // offsets fijos de -svgOffset px en la esquina (lo que pediste)
  const O = svgOffset;

  const cornerMap = {
    se: {
      right: 20,
      bottom: 20,
      cursor: 'se-resize',
      circlePos: { right: -O, bottom: -O }, // <- fixed -16px
      arcParams: { start: [CENTER + radio, CENTER], end: [CENTER, CENTER + radio], sweep: 1 },
      transformOrigin: 'bottom right',
    },
    sw: {
      left: 20,
      bottom: 20,
      cursor: 'sw-resize',
      circlePos: { left: -O, bottom: -O }, // <- fixed -16px
      arcParams: { start: [CENTER - radio, CENTER], end: [CENTER, CENTER + radio], sweep: 0 },
      transformOrigin: 'bottom left',
    },
    ne: {
      right: 20,
      top: 20,
      cursor: 'ne-resize',
      circlePos: { right: -O, top: -O }, // <- fixed -16px
      arcParams: { start: [CENTER + radio, CENTER], end: [CENTER, CENTER - radio], sweep: 0 },
      transformOrigin: 'top right',
    },
    nw: {
      left: 20,
      top: 20,
      cursor: 'nw-resize',
      circlePos: { left: -O, top: -O }, // <- fixed -16px
      arcParams: { start: [CENTER - radio, CENTER], end: [CENTER, CENTER - radio], sweep: 1 },
      transformOrigin: 'top left',
    },
  };

  const handleBackground = getGlobalStyle('--color-background-overline') || '#000';
  const handleOpacity = parseFloat(getGlobalStyle('--opacity-25')) || 0.25;

  const [hoverMap, setHoverMap] = useState(() =>
    corners.reduce((acc: Record<string, { hovering: boolean; marker: null | { x: number; y: number } }>, c) => {
      acc[c] = { hovering: false, marker: null };
      return acc;
    }, {})
  );

  const svgRefs = useRef({});

  useEffect(() => {
    setHoverMap((prev) => {
      const next = { ...prev };
      corners.forEach((c) => {
        if (!next[c]) next[c] = { hovering: false, marker: null };
      });
      return next;
    });
  }, [corners.join(',')]);

  const fmt = (n: number) => Number(n.toFixed(2));

  const handlePointerEnter = (corner: Corner) => () =>
    setHoverMap((prev) => ({ ...prev, [corner]: { ...prev[corner], hovering: true } }));

  const handlePointerLeave = (corner: Corner) => () =>
    setHoverMap((prev) => ({ ...prev, [corner]: { hovering: false, marker: null } }));

  const handlePointerMove = (corner: Corner) => (e: React.PointerEvent) => {
    const svg = svgRefs.current[corner]
    if (!svg) return;
    const rect = svg.getBoundingClientRect();

    // convertir coordenadas CSS (afectadas por scale) a coords internas de viewBox
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;
    const x = xCss / scale;
    const y = yCss / scale;

    const pos = cornerMap[corner] || cornerMap.se;
    const { start, end } = pos.arcParams;
    const { arcStart, arcEnd } = computeArcInterval(start, end, CENTER);

    let a = normAngle(Math.atan2(y - CENTER, x - CENTER));
    if (a < arcStart) a += TWO_PI;
    let clamped = a;
    if (clamped < arcStart) clamped = arcStart;
    if (clamped > arcEnd) clamped = arcEnd;

    const px = CENTER + Math.cos(clamped) * radio;
    const py = CENTER + Math.sin(clamped) * radio;

    setHoverMap((prev) => ({ ...prev, [corner]: { ...prev[corner], marker: { x: fmt(px), y: fmt(py) } } }));
  };

  return (
    <>
      {corners.map((c) => {
        const pos = cornerMap[c] || cornerMap.se;
        const handleStyle = {
          position: 'absolute',
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          borderRadius: 3,
          display: 'block',
          zIndex: 6,
          touchAction: 'none',
          ...(pos.left != null ? { left: pos.left } : { right: pos.right }),
          ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }),
          cursor: pos.cursor,
          background: 'transparent',
          border: 'none',
        };

        const svgContainerStyle = {
          position: 'absolute',
          width: SIZE,
          height: SIZE,
          zIndex: 7,
          pointerEvents: 'auto',
          transformOrigin: pos.transformOrigin,
          transform: `scale(${scale})`,
          ...(pos.circlePos.left != null ? { left: pos.circlePos.left } : { right: pos.circlePos.right }),
          ...(pos.circlePos.top != null ? { top: pos.circlePos.top } : { bottom: pos.circlePos.bottom }),
        };

        const { start, end, sweep } = pos.arcParams;
        const startFmt = [fmt(start[0]), fmt(start[1])];
        const endFmt = [fmt(end[0]), fmt(end[1])];
        const d = `M ${startFmt[0]} ${startFmt[1]} A ${radio} ${radio} 0 0 ${sweep} ${endFmt[0]} ${endFmt[1]}`;

        const hoverState = hoverMap[c] || { hovering: false, marker: null };
        const isHovering = !!hoverState.hovering;
        const marker = hoverState.marker;
        const strokeOpacity = isHovering ? hoverStrokeOpacity : handleOpacity;
        const strokeWidth = isHovering ? Math.max(STROKE, STROKE + 1) : STROKE;

        return (
          <div
            key={c}
            role="button"
            aria-label={`resize-${c}`}
            style={handleStyle}
            className="resizeHandle"
            data-resize-handle
            onPointerDown={(e) => onPointerDown(e, c)}
          >
            <svg
              ref={(el) => (svgRefs.current[c] = el)}
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              style={svgContainerStyle}
              aria-hidden="true"
              onPointerEnter={handlePointerEnter(c)}
              onPointerLeave={handlePointerLeave(c)}
              onPointerMove={handlePointerMove(c)}
              onPointerDown={(e) => onPointerDown(e, c)}
            >
              <circle
                cx={CENTER}
                cy={CENTER}
                r={radio + Math.max(8, STROKE * 2)}
                fill="transparent"
                pointerEvents="all"
              />

              <path
                d={d}
                fill="none"
                stroke={handleBackground}
                strokeOpacity={strokeOpacity}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {showMarkerOnHover && marker && isHovering ? (
                <>
                  <circle cx={marker.x} cy={marker.y} r={Math.max(1.5, STROKE)} fill={handleBackground} opacity="1" />
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r={Math.max(4, STROKE * 2)}
                    fill="none"
                    stroke={handleBackground}
                    strokeOpacity="0.08"
                    strokeWidth="1"
                  />
                </>
              ) : null}
            </svg>
          </div>
        );
      })}
    </>
  );
};

export default ResizeHandles;
