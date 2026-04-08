import { createBrowserRouter } from "react-router-dom";
import { Suspense } from "react";
import Desktop from "../pages/Desktop";
import NotFound from "../pages/NotFound";
import RouteErrorBoundary from "../components/RouteErrorBoundary";
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
    path: "/settings",
    element: <Desktop />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/",
    element: <Desktop />,
    errorElement: <RouteErrorBoundary />,
  },
  ...uniqueRoutableRoutes
    .map((route) => {
      const Component = route.component!;
      return {
        path: route.path,
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <Component />
          </Suspense>
        ),
        errorElement: <RouteErrorBoundary />,
      };
    }),
  {
    path: "*",
    element: <NotFound />,
    errorElement: <RouteErrorBoundary />,
  },
]);
