import { Navigate, useLocation } from "react-router-dom";

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const location = useLocation();

  if (!isAuthenticated) {
    // Save the attempted URL in the location state
    return (
      <Navigate
        to={`/login${window.location.search}`}
        state={{ from: location }}
        replace
      />
    );
  }

  return <>{children}</>;
}
