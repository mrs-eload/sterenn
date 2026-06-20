import { MenuItem } from '@app/routes/sitemap';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';
import AvatarImage from '@app/assets/images/avatar.png';

const ProfileListItem = ({ subheader, path }: MenuItem) => {
  return (
    <ListItemButton component={Link} href={path}>
      <Stack spacing={1} sx={{ alignItems: 'center' }}>
        <Avatar src={AvatarImage} sx={{ height: 36, width: 36, bgcolor: 'primary.main' }} />
        <Stack direction="column">
          <Typography variant="subtitle2" color="text.primary" sx={{ letterSpacing: 0.5 }}>
            {subheader}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
            Account Settings
          </Typography>
        </Stack>
      </Stack>
    </ListItemButton>
  );
};

export default ProfileListItem;
