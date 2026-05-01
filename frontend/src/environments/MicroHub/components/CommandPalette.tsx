import { Search, Code, CircleDot, GitPullRequest, Users } from "lucide-react";
import { classNames } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";
import type { ViewType } from "../index";

export const CommandPalette = () => {
  const { theme } = useTheme();
  const { selfUser } = useMicrohubCtx();
  const { commandPaletteOpen, setCommandPaletteOpen, setRoute, handleViewProfile } = useMicrohubUI();

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-24 z-50" onClick={() => setCommandPaletteOpen(false)}>
      <div className={classNames("border rounded-lg w-full max-w-xl mx-4 shadow-2xl", theme.bgSecondary, theme.border)} onClick={e => e.stopPropagation()}>
        <div className={classNames("px-4 py-3 border-b", theme.border)}>
          <div className="flex items-center space-x-2">
            <Search className={classNames("w-5 h-5", theme.textSecondary)} />
            <input type="text" placeholder="Search or jump to..." autoFocus className={classNames("flex-1 bg-transparent outline-none text-sm", theme.text)} />
            <kbd className={classNames("px-2 py-0.5 text-xs rounded border", theme.bgTertiary, theme.border)}>esc</kbd>
          </div>
        </div>
        <div className="p-2">
          <div className={classNames("text-xs px-2 py-1", theme.textSecondary)}>Pages</div>
          {[
            { label: "Code", icon: Code, view: "code" },
            { label: "Issues", icon: CircleDot, view: "issues" },
            { label: "Pull requests", icon: GitPullRequest, view: "pulls" },
            { label: "Your profile", icon: Users, view: "profile", extra: () => { handleViewProfile(selfUser?.username || ""); } },
          ].map(item => (
            <button
              key={item.view}
              onClick={() => { if (item.extra) item.extra(); else setRoute(item.view as ViewType); setCommandPaletteOpen(false); }}
              className={classNames("w-full flex items-center space-x-3 px-3 py-2 rounded", theme.hover)}
            >
              <item.icon className={classNames("w-4 h-4", theme.textSecondary)} />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
