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
