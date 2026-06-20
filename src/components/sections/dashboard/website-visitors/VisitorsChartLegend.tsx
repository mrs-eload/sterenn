import { fontFamily } from '@app/theme/typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';

interface LegendProps {
  data: {
    id: number;
    type: string;
    rate: string;
  };
  toggleColor: {
    organic: boolean;
    social: boolean;
    direct: boolean;
  };
  handleToggleLegend: (e: React.MouseEvent<HTMLButtonElement>, type: string | null) => void;
}

const VisitorsChartLegend = ({ data, toggleColor, handleToggleLegend }: LegendProps) => {
  let color: string;

  if (toggleColor.organic && data.type === 'Organic') {
    color = 'primary.main';
  } else if (toggleColor.social && data.type === 'Social') {
    color = 'secondary.lighter';
  } else if (toggleColor.direct && data.type === 'Direct') {
    color = 'secondary.light';
  } else {
    color = 'text.secondary';
  }

  return (
    <Stack sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <ButtonBase onClick={(e) => handleToggleLegend(e, data.type)} disableRipple>
        <Stack spacing={1} sx={{ alignItems: 'center' }}>
          <Box sx={{ height: 8, width: 8, bgcolor: color, borderRadius: 1 }} />
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontFamily: fontFamily.workSans }}
          >
            {data.type}
          </Typography>
        </Stack>
      </ButtonBase>
      <Typography variant="body1" color="text.primary" sx={{ fontFamily: fontFamily.workSans }}>
        {data.rate}
      </Typography>
    </Stack>
  );
};

export default VisitorsChartLegend;
