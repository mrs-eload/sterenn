import { Suspense, lazy } from 'react';
import { Outlet, createBrowserRouter } from 'react-router';
import MainLayout from '@app/layouts/main-layout';
import Splash from '@app/components/loader/Splash';
import PageLoader from '@app/components/loader/PageLoader';
import Error404 from '@app/pages/Error404';

const App = lazy(() => import('@app/App'));
const Dashboard = lazy(() => import('@app/pages/Dashboard'));
// TEMPORARY: moon-phase glyph visual check. Remove with src/pages/MoonPhaseDemo.tsx.
const MoonPhaseDemo = lazy(() => import('@app/pages/MoonPhaseDemo'));

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
              element: <Dashboard />,
            },
            {
              // TEMPORARY: remove with src/pages/MoonPhaseDemo.tsx.
              path: 'moon-demo',
              element: <MoonPhaseDemo />,
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
    basename: '/',
  },
);

export default router;
