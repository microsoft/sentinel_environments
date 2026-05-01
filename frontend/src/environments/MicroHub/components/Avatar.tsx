import { memo } from "react";
import { classNames, getInitials, getAvatarColor } from "../utils";
import { useMicrohubUI } from "../contexts";
// Type-only import is erased at compile time, so this does not create a
// runtime cycle with index.tsx (which imports Avatar at runtime).
import type { MicroHubUser } from "../index";

interface AvatarProps {
  user?: MicroHubUser | null;
  size?: "sm" | "md" | "lg" | "xl";
  showTooltip?: boolean;
}

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "w-5 h-5 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
  xl: "w-20 h-20 text-xl",
};

const AvatarImpl = ({ user, size = "md", showTooltip = false }: AvatarProps) => {
  const { handleViewProfile } = useMicrohubUI();

  if (!user) return null;

  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt={user.name}
      className={classNames(
        "rounded-full object-cover cursor-pointer hover:opacity-80",
        sizeClasses[size]
      )}
      title={showTooltip ? user.name : undefined}
      onClick={() => handleViewProfile(user.username)}
    />
  ) : (
    <div
      className={classNames(
        "rounded-full flex items-center justify-center text-white font-medium cursor-pointer hover:opacity-80",
        sizeClasses[size]
      )}
      style={{ backgroundColor: getAvatarColor(user.name) }}
      title={showTooltip ? user.name : undefined}
      onClick={() => handleViewProfile(user.username)}
    >
      {getInitials(user.name)}
    </div>
  );
};

// Module-scope component identity is required to prevent the entire DOM
// subtree from being unmounted/remounted on every parent render — see plan.md
// for the full rationale. React.memo additionally lets Avatar skip re-renders
// when its props are referentially stable (the `users` and `microhubUsers`
// arrays are loaded once and memoized in the parent, so user object refs are
// usually stable across poll ticks).
export const Avatar = memo(AvatarImpl);
