import { classNames } from "../utils";
import { useMicrohubUI } from "../contexts";

interface ClickableUsernameProps {
  username: string;
  className?: string;
  stopPropagation?: boolean;
}

// Module-scope (no React.memo): the only props are primitives, but this
// component consumes MicroHubUIContext, which re-renders consumers whenever
// the UI context value changes — making memo a no-op in practice. The
// extraction itself is what fixes the remount bug; memo would only be useful
// if context churn became a measurable concern.
export const ClickableUsername = ({
  username,
  className = "",
  stopPropagation = false,
}: ClickableUsernameProps) => {
  const { handleViewProfile } = useMicrohubUI();
  return (
    <span
      className={classNames(
        "text-blue-400 hover:underline cursor-pointer",
        className
      )}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        handleViewProfile(username);
      }}
    >
      {username}
    </span>
  );
};
