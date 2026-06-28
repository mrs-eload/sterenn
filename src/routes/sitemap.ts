import paths from './paths';

/**
 * A top-level app section. The whole nav — both the desktop top bar and the
 * mobile drawer — is driven off this one list, so adding a section is a
 * one-line change here (plus its route + page).
 */
export interface NavItem {
  /** Stable key, also the section identity. */
  id: string;
  /** Short label shown in the top nav and the mobile drawer. */
  title: string;
  /** Absolute route path. */
  path: string;
  /** Iconify icon name (mingcute set) — shown beside the label in the drawer. */
  icon: string;
  /**
   * Exact-match only. Needed for the index route ('/'), which would otherwise
   * read as "active" on every page since every path starts with '/'.
   */
  end?: boolean;
}

const navItems: NavItem[] = [
  {
    id: 'home',
    title: 'Home',
    path: paths.home,
    icon: 'mingcute:home-3-line',
    end: true,
  },
  {
    id: 'weather',
    title: 'Weather',
    path: paths.weather,
    icon: 'mingcute:cloud-line',
  },
  {
    id: 'equipment',
    title: 'Equipment',
    path: paths.equipment,
    icon: 'mingcute:camera-2-line',
  },
  {
    id: 'targets',
    title: 'Targets',
    path: paths.targets,
    icon: 'mingcute:star-line',
  },
];

export default navItems;
