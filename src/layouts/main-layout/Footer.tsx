import Typography from '@mui/material/Typography';

const Footer = () => {
  return (
    <Typography
      sx = {{
        mt: 1,
        px: 1,
        pb: {xs: 1.5, sm: 1, lg: 0},
        textAlign: { xs: 'center', md: 'right' },
        letterSpacing: 0.5
      }}
      color="text.secondary"
      variant="body2"
    >
      Made with ❤️ by{' '}
    </Typography>
  );
};

export default Footer;
