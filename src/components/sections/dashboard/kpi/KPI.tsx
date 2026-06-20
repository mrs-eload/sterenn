import { fontFamily } from '@app/theme/typography';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import IconifyIcon from '@app/components/base/IconifyIcon';
import RateChip from '@app/components/common/RateChip';
import { KPIProps } from '@app/data/kpiData';

const KPI = (props: KPIProps) => {
  const { icon, title, value, rate, isUp } = props;

  return (
    <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
      <Stack
        component={Paper}
        direction="column"
        sx={{ p: 2.25, pl: 2.5, gap: 1.5, height: 116, width: 1 }}
      >
        <Stack sx={{ justifyContent: 'space-between' }}>
          <Stack sx={{ alignItems: 'center', gap: 1 }}>
            <IconifyIcon icon={icon} sx={{ color: 'primary.main', fontSize: 'h5.fontSize' }} />
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ fontFamily: fontFamily.workSans }}
            >
              {title}
            </Typography>
          </Stack>

          <IconButton
            aria-label="menu"
            size="small"
            sx={{ color: 'neutral.light', fontSize: 'h5.fontSize' }}
          >
            <IconifyIcon icon="solar:menu-dots-bold" />
          </IconButton>
        </Stack>

        <Stack sx={{ alignItems: 'center', gap: 0.875 }}>
          <Typography variant="h3" sx={{ fontWeight: 600, letterSpacing: 1 }}>
            {value}
          </Typography>
          <RateChip rate={rate} isUp={isUp} />
        </Stack>
      </Stack>
    </Grid>
  );
};

export default KPI;
