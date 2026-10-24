import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { EquipmentType, HolderType, OpticalDesign, type EquipmentResponse } from '@sterenn/shared';
import { threadSizeLabel, threadSizeShort, type ThreadSizeIndex } from '../format';
import { ink, size, text, tone } from '../tokens';

// Technical side view of a rig's optical chain (design: rigs-visual.html). Lengths
// and diameters are approximate where the data model has no column for them;
// this is a picture, not a measurement.

const MM = 2;

type Dimensions = { length: number; diameter: number; offset: number };

function threadDiameter(equipment: EquipmentResponse, position: string, sizes: ThreadSizeIndex): number | null {
  const thread = equipment.threads.find((item) => item.position === position);
  return thread ? (sizes.get(thread.thread_size_id)?.diameter_mm ?? null) : null;
}

function dimensions(equipment: EquipmentResponse, sizes: ThreadSizeIndex): Dimensions {
  switch (equipment.type) {
    case EquipmentType.TELESCOPE: {
      const specs = equipment.specs;
      if (specs.optical_design === OpticalDesign.REFRACTOR) {
        return {
          length: specs.tube_length_mm ?? Math.max(180, specs.focal_length_mm * 0.9),
          diameter: Math.max(64, specs.aperture_mm * 1.35),
          offset: 0,
        };
      }
      // Folded light path: short for its focal length, but still a tube, not a
      // can. A 127 mm Maksutov is about 330 mm long and 150 mm across.
      return {
        length: specs.tube_length_mm ?? Math.max(160, specs.aperture_mm * 2.6),
        diameter: Math.max(64, specs.aperture_mm * 1.15),
        offset: 0,
      };
    }
    case EquipmentType.CAMERA:
      return { length: 84, diameter: 78, offset: 0 };
    case EquipmentType.FILTER_HOLDER:
      return equipment.specs.holder_type === HolderType.WHEEL
        ? { length: 24, diameter: 132, offset: -26 }
        : { length: 20, diameter: 80, offset: 0 };
    case EquipmentType.CORRECTOR:
      return { length: 46, diameter: (threadDiameter(equipment, 'front', sizes) ?? 54) + 10, offset: 0 };
    default:
      return { length: 14, diameter: (threadDiameter(equipment, 'front', sizes) ?? 48) + 6, offset: 0 };
  }
}

function pieceDrawing(
  equipment: EquipmentResponse,
  x: number,
  cy: number,
  is_focused: boolean,
  filter_count: number,
  sizes: ThreadSizeIndex,
): ReactNode[] {
  const { length, diameter, offset } = dimensions(equipment, sizes);
  const w = length * MM;
  const hh = diameter * MM;
  const top = cy - hh / 2 + offset * MM;
  const stroke = is_focused ? tone.amber400 : ink[300];
  const fine = is_focused ? tone.amber500 : ink[500];
  const fill = is_focused ? 'rgba(224,152,46,0.10)' : ink[850];
  const solid = { fill, stroke, strokeWidth: 1.4, vectorEffect: 'non-scaling-stroke' as const };
  const line = { stroke: fine, strokeWidth: 1, fill: 'none' };
  const out: ReactNode[] = [];
  const rect = (key: string, x0: number, y0: number, width: number, height: number, rx = 0, style = solid) =>
    out.push(<rect key={key} x={x0} y={y0} width={width} height={height} rx={rx} style={style} />);
  const filters = (fx: (k: number) => number) => {
    for (let k = 0; k < filter_count; k++) {
      out.push(<line key={`filter-${k}`} x1={fx(k)} x2={fx(k)} y1={cy - 30} y2={cy + 30} stroke={tone.cyan300} strokeWidth="3" />);
    }
  };

  if (equipment.type === EquipmentType.TELESCOPE && equipment.specs.optical_design !== OpticalDesign.REFRACTOR) {
    // Cassegrain layout, used for reflectors and catadioptrics: primary mirror
    // at the back, secondary at the front, light out through a central baffle.
    const is_catadioptric = equipment.specs.optical_design === OpticalDesign.CATADIOPTRIC;
    const rear = (threadDiameter(equipment, 'rear', sizes) ?? 48) * MM;
    const cell_x = x + w * 0.8;
    const back_x = x + w * 0.88;
    const secondary_h = hh * 0.3;
    rect('front-ring', x, cy - hh / 2 - 4, 8, hh + 8, 2);
    rect('tube', x + 8, cy - hh / 2, cell_x - x - 8, hh);
    // Primary mirror cell: the tube steps down to the rear housing.
    rect('cell', cell_x, cy - hh * 0.44, back_x - cell_x, hh * 0.88, 4);
    out.push(<path key="primary" d={`M${cell_x - 6} ${cy - hh * 0.42} Q${cell_x - 14} ${cy} ${cell_x - 6} ${cy + hh * 0.42}`} style={line} />);
    // Central baffle from the primary's hole towards the secondary.
    out.push(<rect key="baffle" x={x + w * 0.42} y={cy - hh * 0.08} width={cell_x - x - w * 0.42} height={hh * 0.16} style={{ ...line, strokeDasharray: '3 3' }} />);
    if (is_catadioptric) {
      // Meniscus corrector across the aperture; the secondary is a spot on it.
      out.push(<path key="corrector" d={`M${x + 10} ${cy - hh / 2 + 2} Q${x + 22} ${cy} ${x + 10} ${cy + hh / 2 - 2}`} style={line} />);
      rect('secondary', x + 13, cy - secondary_h / 2, 7, secondary_h, 2);
    } else {
      // Open front: secondary held by spider vanes.
      rect('secondary', x + 14, cy - secondary_h / 2, 7, secondary_h, 1);
      out.push(<line key="vane-top" x1={x + 17} x2={x + 17} y1={cy - hh / 2} y2={cy - secondary_h / 2} style={line} />);
      out.push(<line key="vane-bottom" x1={x + 17} x2={x + 17} y1={cy + secondary_h / 2} y2={cy + hh / 2} style={line} />);
    }
    // Light path: in to the primary, back to the secondary, out the rear.
    const ray = { ...line, strokeDasharray: '1 4' };
    out.push(<line key="ray-in-top" x1={x + 20} x2={cell_x - 10} y1={cy - hh * 0.36} y2={cy - hh * 0.36} style={ray} />);
    out.push(<line key="ray-in-bottom" x1={x + 20} x2={cell_x - 10} y1={cy + hh * 0.36} y2={cy + hh * 0.36} style={ray} />);
    out.push(<line key="ray-back-top" x1={cell_x - 10} x2={x + 21} y1={cy - hh * 0.36} y2={cy - secondary_h * 0.3} style={ray} />);
    out.push(<line key="ray-back-bottom" x1={cell_x - 10} x2={x + 21} y1={cy + hh * 0.36} y2={cy + secondary_h * 0.3} style={ray} />);
    // Visual back with the rear-cell focus knob, then the rear thread.
    rect('visual-back', back_x, cy - rear / 2 - 4, w - (back_x - x) - 10, rear + 8, 2);
    out.push(<circle key="knob" cx={cell_x + (back_x - cell_x) / 2} cy={cy + hh * 0.44 + 12} r={9} style={solid} />);
    out.push(<circle key="knob-inner" cx={cell_x + (back_x - cell_x) / 2} cy={cy + hh * 0.44 + 12} r={3} style={line} />);
    rect('flange', x + w - 10, cy - rear / 2, 10, rear, 1);
    rect('dovetail', x + w * 0.2, cy + hh / 2, w * 0.46, 12, 1);
    for (let i = 1; i < 8; i++) {
      const dx = x + w * 0.2 + (i * (w * 0.46)) / 8;
      out.push(<line key={`dovetail-${i}`} x1={dx} x2={dx} y1={cy + hh / 2 + 3} y2={cy + hh / 2 + 9} style={line} />);
    }
  } else if (equipment.type === EquipmentType.TELESCOPE) {
    // Refractor: dew shield, objective, tube rings, focuser.
    const dew = w * 0.27;
    const focus_x = w * 0.8;
    const rear = (threadDiameter(equipment, 'rear', sizes) ?? 48) * MM;
    rect('dew', x, cy - hh / 2 - 6, dew, hh + 12, 3);
    rect('lip', x - 3, cy - hh / 2 - 9, 7, hh + 18, 2);
    rect('tube', x + dew, cy - hh / 2, focus_x - dew, hh);
    [0.42, 0.64].forEach((ratio, k) => {
      rect(`ring-${k}`, x + w * ratio, cy - hh / 2 - 7, 14, hh + 14, 3);
      out.push(<line key={`foot-${k}`} x1={x + w * ratio + 7} x2={x + w * ratio + 7} y1={cy + hh / 2 + 7} y2={cy + hh / 2 + 16} style={{ stroke, strokeWidth: 1.4 }} />);
    });
    rect('dovetail', x + w * 0.36, cy + hh / 2 + 16, w * 0.38, 12, 1);
    for (let i = 1; i < 8; i++) {
      const dx = x + w * 0.36 + (i * (w * 0.38)) / 8;
      out.push(<line key={`dovetail-${i}`} x1={dx} x2={dx} y1={cy + hh / 2 + 19} y2={cy + hh / 2 + 25} style={line} />);
    }
    const focuser_h = hh * 0.74;
    rect('focuser', x + focus_x, cy - focuser_h / 2, w - focus_x - 10, focuser_h, 2);
    out.push(<line key="drawtube" x1={x + focus_x + 12} x2={x + focus_x + 12} y1={cy - focuser_h / 2} y2={cy + focuser_h / 2} style={line} />);
    rect('knob-stem', x + w * 0.88 - 3, cy + focuser_h / 2, 6, 10);
    out.push(<circle key="knob" cx={x + w * 0.88} cy={cy + focuser_h / 2 + 20} r={11} style={solid} />);
    out.push(<circle key="knob-inner" cx={x + w * 0.88} cy={cy + focuser_h / 2 + 20} r={4} style={line} />);
    rect('flange', x + w - 10, cy - rear / 2, 10, rear, 1);
    out.push(<line key="objective" x1={x + dew} x2={x + dew} y1={cy - hh / 2} y2={cy + hh / 2} style={line} />);
  } else if (equipment.type === EquipmentType.CAMERA) {
    const flange = (threadDiameter(equipment, 'front', sizes) ?? 42) * MM;
    rect('flange', x, cy - flange / 2, 12, flange, 1);
    rect('body', x + 12, cy - hh / 2, w * 0.58, hh, 10);
    out.push(<line key="seam" x1={x + 12 + w * 0.2} x2={x + 12 + w * 0.2} y1={cy - hh / 2} y2={cy + hh / 2} style={line} />);
    const fins_x = x + 12 + w * 0.58;
    const fins_w = w - 12 - w * 0.58;
    for (let i = 0; i < 6; i++) rect(`fin-${i}`, fins_x + i * (fins_w / 6), cy - hh / 2 + 4, fins_w / 6 - 3, hh - 8, 1);
    rect('port', x + 12 + w * 0.32, cy - hh / 2 - 8, 18, 8, 1);
  } else if (equipment.type === EquipmentType.FILTER_HOLDER) {
    rect('box', x, top, w, hh, 3);
    if (equipment.specs.holder_type === HolderType.DRAWER) {
      rect('pull', x + w / 2 - 9, top - 16, 18, 16, 2);
      for (let i = 0; i < 3; i++) {
        out.push(<line key={`grip-${i}`} x1={x + w / 2 - 5} x2={x + w / 2 + 5} y1={top - 12 + i * 4} y2={top - 12 + i * 4} style={line} />);
      }
    } else {
      out.push(<circle key="hub" cx={x + w / 2} cy={top + hh * 0.36} r={6} style={line} />);
    }
    out.push(<line key="slot" x1={x + w / 2} x2={x + w / 2} y1={top + 8} y2={top + hh - 8} style={{ ...line, strokeDasharray: '2 4' }} />);
    filters((k) => x + w / 2 + k * 5);
  } else if (equipment.type === EquipmentType.CORRECTOR) {
    const front = (threadDiameter(equipment, 'front', sizes) ?? 54) * MM + 14;
    const rear = (threadDiameter(equipment, 'rear', sizes) ?? 48) * MM + 6;
    out.push(
      <path
        key="body"
        d={`M${x} ${cy - front / 2} L${x + w * 0.7} ${cy - front / 2} L${x + w} ${cy - rear / 2} L${x + w} ${cy + rear / 2} L${x + w * 0.7} ${cy + front / 2} L${x} ${cy + front / 2} Z`}
        style={solid}
      />,
    );
    for (let i = 1; i < 6; i++) {
      const kx = x + (i * (w * 0.5)) / 6;
      out.push(<line key={`knurl-${i}`} x1={kx} x2={kx} y1={cy - front / 2 + 3} y2={cy + front / 2 - 3} style={line} />);
    }
    filters((k) => x + 6 + k * 5);
  } else {
    const front = (threadDiameter(equipment, 'front', sizes) ?? 48) * MM + 6;
    const rear = (threadDiameter(equipment, 'rear', sizes) ?? 48) * MM + 2;
    rect('front', x, cy - front / 2, w * 0.55, front, 1);
    rect('rear', x + w * 0.55, cy - rear / 2, w * 0.45, rear, 1);
    for (let i = 1; i < 4; i++) {
      const kx = x + (i * (w * 0.55)) / 4;
      out.push(<line key={`knurl-${i}`} x1={kx} x2={kx} y1={cy - front / 2 + 3} y2={cy + front / 2 - 3} style={line} />);
    }
    filters((k) => x + 3 + k * 5);
  }
  return out;
}

export function OpticalChainDrawing({
  chain,
  links,
  filter_count_by_holder,
  sizes,
  focused_id,
  onFocus,
}: {
  chain: EquipmentResponse[];
  // Shared thread size id per junction, null for no match (from validateRig).
  links: (string | null)[];
  filter_count_by_holder: ReadonlyMap<string, number>;
  sizes: ThreadSizeIndex;
  focused_id: string | null;
  onFocus: (id: string) => void;
}) {
  if (chain.length === 0) {
    return <Box sx={{ color: text.secondary, py: 5 }}>This rig has no optical chain yet.</Box>;
  }
  const lead = 70;
  const gap = 6;
  let cursor = lead;
  const placed = chain.map((equipment) => {
    const dims = dimensions(equipment, sizes);
    const piece = { x: cursor, w: dims.length * MM };
    cursor += dims.length * MM + gap;
    return piece;
  });
  const max_height = Math.max(
    ...chain.map((equipment) => {
      const dims = dimensions(equipment, sizes);
      return (dims.diameter + Math.abs(dims.offset) * 2) * MM;
    }),
  );
  const cy = 64 + max_height / 2 + 12;
  const height = cy + max_height / 2 + 84;
  const width = cursor + 24;

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', margin: '0 auto', maxWidth: width, height: 'auto' }}
      >
        <line x1={8} x2={width - 8} y1={cy} y2={cy} stroke={ink[600]} strokeWidth="1" strokeDasharray="10 4 2 4" />
        <text x={8} y={cy - 10} fill={text.secondary} fontSize="13">Light</text>
        <path d={`M8 ${cy + 12} h40 m-6 -4 l6 4 l-6 4`} stroke={text.secondary} strokeWidth="1.2" fill="none" />
        {chain.map((equipment, index) => {
          const is_focused = focused_id === equipment.id;
          const piece = placed[index];
          return (
            <g key={`${equipment.id}-${index}`} onClick={() => onFocus(equipment.id)} style={{ cursor: 'pointer' }}>
              <title>{equipment.model}</title>
              <rect x={piece.x - 4} y={8} width={piece.w + 8} height={height - 16} fill="transparent" />
              {pieceDrawing(equipment, piece.x, cy, is_focused, filter_count_by_holder.get(equipment.id) ?? 0, sizes)}
              <line x1={piece.x} x2={piece.x + piece.w} y1={height - 44} y2={height - 44} stroke={is_focused ? tone.amber500 : ink[600]} strokeWidth={is_focused ? 2 : 1} />
              <line x1={piece.x} x2={piece.x} y1={height - 50} y2={height - 38} stroke={ink[600]} />
              <text
                x={piece.x + piece.w / 2}
                y={height - 22}
                textAnchor="middle"
                fill={is_focused ? tone.amber400 : text.secondary}
                fontSize="13"
                fontWeight="700"
              >
                {String(index + 1).padStart(2, '0')}
              </text>
            </g>
          );
        })}
        <line x1={cursor - gap} x2={cursor - gap} y1={height - 50} y2={height - 38} stroke={ink[600]} />
        {links.map((thread_size_id, index) => {
          if (index + 1 >= placed.length) return null;
          const junction_x = placed[index + 1].x - gap / 2;
          const color = thread_size_id ? tone.green500 : tone.amber400;
          const is_last = index === links.length - 1;
          const anchor = is_last ? 'start' : index === 0 ? 'end' : 'middle';
          return (
            <g key={`junction-${index}`}>
              <title>{thread_size_id ? threadSizeLabel(sizes.get(thread_size_id)) : 'No shared thread'}</title>
              <line x1={junction_x} x2={junction_x} y1={34} y2={cy - 30} stroke={color} strokeWidth="1" strokeDasharray="2 3" />
              <circle cx={junction_x} cy={cy} r={3.5} fill={color} />
              <text x={junction_x} y={26} textAnchor={anchor} dx={is_last ? 4 : index === 0 ? -4 : 0} fill={color} fontSize="13" fontWeight="600">
                {thread_size_id ? threadSizeShort(sizes.get(thread_size_id)) : 'No match'}
              </text>
            </g>
          );
        })}
      </svg>
      <Box sx={{ color: text.muted, fontSize: size.sm, textAlign: 'center', mt: 0.5 }}>Side view · approximate proportions</Box>
    </div>
  );
}
