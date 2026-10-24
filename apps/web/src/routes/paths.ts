export const rootPaths = {
  root: '/',
  pagesRoot: '@app/pages',
  authRoot: 'authentication',
  errorRoot: 'error',
};

export default {
  // App sections — the top-level nav. Home is the index/landing route.
  home: '/',
  weather: '/weather',
  equipment: '/equipment',
  targets: '/targets',
  // Temporary subject — tracking the Nancy Grace Roman Space Telescope (RST).
  // Self-contained under features/rst; remove this line when the subject is retired.
  rst: '/rst',

  signin: `/${rootPaths.authRoot}/signin`,
  signup: `/${rootPaths.authRoot}/sign-up`,
  forgotPassword: `/${rootPaths.authRoot}/forgot-password`,

  comingSoon: `/coming-soon`,
  404: `/${rootPaths.errorRoot}/404`,
};
