import type { Theme, Components } from '@mui/material/styles';

const Stack: Components<Omit<Theme, '@app/components'>>['MuiStack'] = {
  defaultProps: {
    useFlexGap: true,
    direction: 'row',
  },
};

export default Stack;
