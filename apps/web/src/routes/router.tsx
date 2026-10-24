import { Suspense, lazy } from 'react';
import { Outlet, createBrowserRouter } from 'react-router';
import MainLayout from '@app/layouts/main-layout';
import Splash from '@app/components/loader/Splash';
import PageLoader from '@app/components/loader/PageLoader';
import Error404 from '@app/pages/Error404';

const App = lazy(() => import('@app/App'));
const Home = lazy(() => import('@app/pages/Home'));
const Dashboard = lazy(() => import('@app/pages/Dashboard'));
const Equipment = lazy(() => import('@app/pages/Equipment'));
const Targets = lazy(() => import('@app/pages/Targets'));
// Temporary subject (RST). Delete this line and its route child to retire it.
const Rst = lazy(() => import('@app/pages/Rst'));

const router = createBrowserRouter(
  [
    {
      element: (
        <Suspense fallback={<Splash />}>
          <App />
        </Suspense>
      ),
      children: [
        {
          path: '/',
          element: (
            <MainLayout>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </MainLayout>
          ),
          children: [
            {
              index: true,
              element: <Home />,
            },
            {
              path: 'weather',
              element: <Dashboard />,
            },
            {
              path: 'equipment',
              element: <Equipment />,
            },
            {
              path: 'targets',
              element: <Targets />,
            },
            {
              // Temporary subject (RST) — remove this child when retiring it.
              path: 'rst',
              element: <Rst />,
            },
          ],
        },
        {
          path: '*',
          element: <Error404 />,
        },
      ],
    },
  ],
  {
    // Matches Vite's `base` so routing works under the GitHub Pages subpath
    // (e.g. /sterenn/) and at root in dev. BASE_URL has a trailing slash that
    // react-router doesn't want, so strip it.
    basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
  },
);

export default router;
