import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Icon } from '@iconify/react';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { Dayjs } from 'dayjs';

dayjs.extend(utc);

type Unit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

interface DateTimeSpinnerProps {
  value: Date;
  onChange: (date: Date) => void;
  /** Called when the user starts/stops interacting, so the caller can freeze
   *  the live clock and not tick the display out from under them. Balanced. */
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
}

/** One editable field: the number, with up/down chevrons revealed on hover. */
const Field: React.FC<{
  text: string;
  onStep: (delta: 1 | -1) => void;
}> = ({ text, onStep }) => (
  <Box
    sx={{
      position: 'relative',
      px: 0.25,
      display: 'inline-flex',
      justifyContent: 'center',
      cursor: 'ns-resize',
      borderRadius: 0.5,
      '&:hover': { bgcolor: 'rgba(0, 255, 204, 0.12)' },
      // Chevrons are inert until the field is hovered.
      '& .chev': { opacity: 0, pointerEvents: 'none', transition: 'opacity 120ms' },
      '&:hover .chev': { opacity: 1, pointerEvents: 'auto' },
    }}
  >
    <IconButton
      className="chev"
      size="small"
      onClick={() => onStep(1)}
      tabIndex={-1}
      sx={{ position: 'absolute', top: -17, p: 0, color: '#00ffcc' }}
    >
      <Icon icon="mdi:chevron-up" width={16} />
    </IconButton>
    <Box component="span">{text}</Box>
    <IconButton
      className="chev"
      size="small"
      onClick={() => onStep(-1)}
      tabIndex={-1}
      sx={{ position: 'absolute', bottom: -17, p: 0, color: '#00ffcc' }}
    >
      <Icon icon="mdi:chevron-down" width={16} />
    </IconButton>
  </Box>
);

/**
 * Stellarium-style UTC date/time editor: a segmented readout you nudge
 * field-by-field, plus a calendar button for full selection. Purely
 * presentational — it reports edits through `onChange` and never holds the
 * clock itself.
 */
export const DateTimeSpinner: React.FC<DateTimeSpinnerProps> = ({
  value,
  onChange,
  onInteractStart,
  onInteractEnd,
}) => {
  const d = dayjs.utc(value);
  const [calOpen, setCalOpen] = useState(false);

  const step = (unit: Unit, delta: 1 | -1): void => onChange(d.add(delta, unit).toDate());

  const fields: Array<{ unit: Unit; text: string } | string> = [
    { unit: 'year', text: d.format('YYYY') },
    '-',
    { unit: 'month', text: d.format('MM') },
    '-',
    { unit: 'day', text: d.format('DD') },
    ' ',
    { unit: 'hour', text: d.format('HH') },
    ':',
    { unit: 'minute', text: d.format('mm') },
    ':',
    { unit: 'second', text: d.format('ss') },
  ];

  return (
    <Box
      onMouseEnter={onInteractStart}
      onMouseLeave={onInteractEnd}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 1.5,
        bgcolor: 'rgba(10, 14, 22, 0.82)',
        color: '#e6edf3',
        borderRadius: 1.5,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(6px)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 18,
        userSelect: 'none',
      }}
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        {fields.map((field, i) =>
          typeof field === 'string' ? (
            <Box key={i} component="span" sx={{ px: 0.25, opacity: 0.6 }}>
              {field}
            </Box>
          ) : (
            <Field key={i} text={field.text} onStep={(delta) => step(field.unit, delta)} />
          ),
        )}
        <Box component="span" sx={{ ml: 1, fontSize: 12, opacity: 0.6 }}>
          UTC
        </Box>
      </Box>

      <Tooltip title="Pick from calendar">
        <IconButton
          size="small"
          onClick={() => setCalOpen(true)}
          sx={{ color: '#9fb0c3', ml: 0.25 }}
        >
          <Icon icon="mdi:calendar-month" width={20} />
        </IconButton>
      </Tooltip>

      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DateTimePicker
          open={calOpen}
          onOpen={() => {
            setCalOpen(true);
            onInteractStart?.();
          }}
          onClose={() => {
            setCalOpen(false);
            onInteractEnd?.();
          }}
          value={d}
          timezone="UTC"
          ampm={false}
          views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
          onChange={(v: Dayjs | null) => {
            if (v && v.isValid()) onChange(v.toDate());
          }}
          // The field only anchors the popup; the segmented readout above is the
          // real UI, so keep it present-but-hidden.
          slotProps={{
            textField: {
              sx: {
                position: 'absolute',
                width: 0,
                minWidth: 0,
                height: 0,
                p: 0,
                m: 0,
                border: 0,
                visibility: 'hidden',
              },
            },
          }}
        />
      </LocalizationProvider>
    </Box>
  );
};
