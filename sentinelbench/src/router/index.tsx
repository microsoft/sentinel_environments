import { createBrowserRouter } from "react-router-dom";
import { Suspense } from "react";
import Desktop from "../pages/Desktop";
import Login from "../pages/Login";
import NotFound from "../pages/NotFound";
import RouteErrorBoundary from "../components/RouteErrorBoundary";
import RequireAuth from "../components/RequireAuth";
import { routes } from "./routes";

const uniqueRoutableRoutes = (() => {
  const seenPaths = new Set<string>();
  return routes.filter((route) => {
    if (route.component === null) return false;
    if (seenPaths.has(route.path)) return false;
    seenPaths.add(route.path);
    return true;
  });
})();

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/settings",
    element: (
      <RequireAuth>
        <Desktop />
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <Desktop />
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  ...uniqueRoutableRoutes
    .map((route) => {
      const Component = route.component!;
      return {
        path: route.path,
        element: (
          <RequireAuth>
            <Suspense fallback={<div>Loading...</div>}>
              <Component />
            </Suspense>
          </RequireAuth>
        ),
        errorElement: <RouteErrorBoundary />,
      };
    }),
  {
    path: "*",
    element: (
      <RequireAuth>
        <NotFound />
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
  },
]);
