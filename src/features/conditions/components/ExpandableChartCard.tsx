import { useState, type ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import IconifyIcon from '@app/components/base/IconifyIcon';
import { SectionHeader } from './SectionHeader.tsx';

/**
 * A chart card that can be expanded into a full-width modal for a detailed look.
 * Both curve widgets (sky-quality, cloud coverage) need the same expand affordance,
 * so it lives here as a shared wrapper — promoted on the second use, per CLAUDE.md.
 *
 * The chart is supplied as a render function of height, not a fixed node, so the
 * same series renders at the compact inline size and again, larger, in the modal.
 */
export interface ExpandableChartCardProps {
  icon: string;
  title: string;
  /** Inline chart height in px. */
  height?: number;
  /** Chart height in px inside the expanded modal. */
  expandedHeight?: number;
  /** Render the chart at the given pixel height. Used inline and in the modal. */
  children: (height: number) => ReactNode;
}

export function ExpandableChartCard({
  icon,
  title,
  height = 160,
  expandedHeight = 520,
  children,
}: ExpandableChartCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* width:100% so the card fills its flex grid cell when laid out in a row. */}
      <Paper sx={{ width: '100%' }}>
        <SectionHeader
          icon={icon}
          title={title}
          action={
            <IconButton
              size="small"
              onClick={() => setOpen(true)}
              aria-label={`Expand ${title}`}
              sx={{ color: 'text.secondary' }}
            >
              <IconifyIcon icon="mingcute:eye-2-line" sx={{ fontSize: 18 }} />
            </IconButton>
          }
        />
        {children(height)}
      </Paper>

      {/* keepMounted off (the default): the modal chart mounts fresh on open, so
          ECharts measures the full dialog width instead of a zero-width hidden box. */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
        <DialogContent>
          <SectionHeader
            icon={icon}
            title={title}
            action={
              <IconButton
                size="small"
                onClick={() => setOpen(false)}
                aria-label="Close"
                sx={{ color: 'text.secondary' }}
              >
                <IconifyIcon icon="iconamoon:sign-times-duotone" sx={{ fontSize: 20 }} />
              </IconButton>
            }
          />
          {children(expandedHeight)}
        </DialogContent>
      </Dialog>
    </>
  );
}
