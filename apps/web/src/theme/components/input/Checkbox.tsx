import type { Theme, Components } from '@mui/material/styles';
import CheckBoxBlankIcon from '../../icons/CheckboxBlankIcon';
import CheckBoxCheckedIcon from '../../icons/CheckboxCheckedIcon';
import CheckBoxIndeterminateIcon from '../../icons/CheckboxIndeterminateIcon';
import { svgIconClasses } from '@mui/material';

const Checkbox: Components<Omit<Theme, '@app/components'>>['MuiCheckbox'] = {
  defaultProps: {
    icon: <CheckBoxBlankIcon />,
    checkedIcon: <CheckBoxCheckedIcon />,
    indeterminateIcon: <CheckBoxIndeterminateIcon />,
  },
  styleOverrides: {
    root: ({ theme }) => ({
      color: theme.palette.text.secondary,
    }),
    sizeMedium: ({ theme }) => ({
      [`& .${svgIconClasses.root}`]: {
        fontSize: theme.typography.button.fontSize,
      },
    }),
    sizeSmall: ({ theme }) => ({
      [`& .${svgIconClasses.root}`]: {
        fontSize: theme.typography.caption.fontSize,
      },
    }),
  },
};

export default Checkbox;
