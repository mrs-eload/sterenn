import Box from '@mui/material/Box';
import { EquipmentType, type EquipmentResponse } from '@sterenn/shared';
import { summary, threadAt, threadSizeLabel, threadSizeShort, TYPE_LABEL, type ThreadSizeIndex } from '../format';
import { border, fontMono, size, surface, text, tone } from '../tokens';

// The optical train as a row of tiles, light entering left (design:
// rigs-visual.html). Every part gets an equal share of the width: no lengths
// are stored, so a wider tile would suggest a size that isn't known.

const TILE_HEIGHT = 132;

function detailLine(equipment: EquipmentResponse, sizes: ThreadSizeIndex): string {
  switch (equipment.type) {
    case EquipmentType.TELESCOPE:
      return `${equipment.specs.aperture_mm} / ${equipment.specs.focal_length_mm} mm`;
    case EquipmentType.CORRECTOR:
      return `${equipment.specs.focal_multiplier}×`;
    case EquipmentType.ADAPTER: {
      const front = threadAt(equipment, 'front');
      const rear = threadAt(equipment, 'rear');
      return front && rear
        ? `${threadSizeShort(sizes.get(front.thread_size_id))} → ${threadSizeShort(sizes.get(rear.thread_size_id))}`
        : summary(equipment);
    }
    default:
      return summary(equipment);
  }
}

function Tile({
  equipment,
  index,
  link,
  is_focused,
  filters,
  sizes,
  onClick,
}: {
  equipment: EquipmentResponse;
  index: number;
  // Thread shared with the previous part; null for no match, undefined for the first part.
  link: string | null | undefined;
  is_focused: boolean;
  filters: EquipmentResponse[];
  sizes: ThreadSizeIndex;
  onClick: () => void;
}) {
  const link_color = link ? tone.green500 : tone.amber400;
  return (
    <Box
      onClick={onClick}
      title={equipment.model}
      sx={{
        position: 'relative',
        flex: '1 1 0',
        minWidth: 140,
        height: TILE_HEIGHT,
        ml: index ? '-1px' : 0,
        zIndex: is_focused ? 2 : 1,
        cursor: 'pointer',
        px: 1.75,
        py: 1.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        bgcolor: is_focused ? surface.hover : surface.cardAlt,
        border: `1px solid ${is_focused ? tone.amber500 : border.strong}`,
        // Dashed front edge: the telescope is open to the sky.
        borderLeftStyle: index === 0 && equipment.type === EquipmentType.TELESCOPE && !is_focused ? 'dashed' : 'solid',
        transition: 'background-color 120ms, border-color 120ms',
      }}
    >
      {link !== undefined && (
        <>
          <Box
            component="span"
            title={link ? threadSizeLabel(sizes.get(link)) : 'No shared thread'}
            sx={{
              position: 'absolute',
              left: -1,
              top: -26,
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              fontFamily: link ? fontMono : undefined,
              fontSize: size.sm,
              fontWeight: 700,
              color: link_color,
            }}
          >
            {link ? threadSizeShort(sizes.get(link)) : 'No match'}
          </Box>
          <Box component="span" sx={{ position: 'absolute', left: -1, top: -8, width: '1px', height: 8, bgcolor: link_color }} />
        </>
      )}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
        <Box component="span" sx={{ color: is_focused ? tone.amber400 : text.muted, fontFamily: fontMono, fontSize: size.base, fontWeight: 700 }}>
          {String(index + 1).padStart(2, '0')}
        </Box>
        <Box component="span" sx={{ color: text.secondary, fontSize: size.base, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {TYPE_LABEL[equipment.type]}
        </Box>
      </Box>
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {filters.map((filter) => (
          <Box
            key={filter.id}
            component="span"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: tone.cyan300, fontSize: size.base, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            <Box component="span" sx={{ width: 3, height: 12, bgcolor: tone.cyan300, flexShrink: 0 }} />
            {filter.model}
          </Box>
        ))}
        <Box
          component="span"
          sx={{
            color: is_focused ? tone.amber400 : text.primary,
            fontWeight: 700,
            fontSize: size.lg,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {equipment.model}
        </Box>
        <Box component="span" sx={{ color: text.secondary, fontFamily: fontMono, fontSize: size.base, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {detailLine(equipment, sizes)}
        </Box>
      </Box>
    </Box>
  );
}

export function OpticalTrain({
  chain,
  links,
  filters_by_holder,
  sizes,
  focused_id,
  onFocus,
}: {
  chain: EquipmentResponse[];
  // Shared thread size id per junction, null for no match (from validateRig).
  links: (string | null)[];
  filters_by_holder: ReadonlyMap<string, EquipmentResponse[]>;
  sizes: ThreadSizeIndex;
  focused_id: string | null;
  onFocus: (id: string) => void;
}) {
  if (chain.length === 0) {
    return <Box sx={{ color: text.secondary, py: 3 }}>This rig has no optical chain yet.</Box>;
  }
  return (
    <Box sx={{ overflowX: 'auto', scrollbarWidth: 'thin' }}>
      <Box sx={{ minWidth: 640, pt: '30px', px: '4px' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          {chain.map((equipment, index) => (
            <Tile
              key={`${equipment.id}-${index}`}
              equipment={equipment}
              index={index}
              link={index ? (links[index - 1] ?? null) : undefined}
              is_focused={focused_id === equipment.id}
              filters={filters_by_holder.get(equipment.id) ?? []}
              sizes={sizes}
              onClick={() => onFocus(equipment.id)}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
