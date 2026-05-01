import { Verified, Copy } from "lucide-react";
import { classNames, computeRelativeTimestamp } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";
import { Avatar } from "./Avatar";

export const CommitsView = () => {
  const { theme } = useTheme();
  const { commits, getUserByUsername, startTime } = useMicrohubCtx();
  const { handleViewProfile } = useMicrohubUI();

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Commits</h2>
      <div className={classNames("border rounded-md", theme.border)}>
        {commits.map((commit, index) => (
          <div key={commit.id} className={classNames("p-4 flex items-start justify-between", index < commits.length - 1 && classNames("border-b", theme.borderLight))}>
            <div className="flex items-start space-x-3">
              <Avatar user={getUserByUsername(commit.author)} size="sm" />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{commit.message}</span>
                  {commit.verified && <span title="Verified"><Verified className="w-4 h-4 text-green-500" /></span>}
                </div>
                {commit.description && <p className={classNames("text-sm mt-1", theme.textSecondary)}>{commit.description}</p>}
                <div className={classNames("text-xs mt-1", theme.textSecondary)}>
                  <span className="text-blue-400 hover:underline cursor-pointer" onClick={() => handleViewProfile(commit.author)}>{commit.author}</span>
                  {" "}committed {computeRelativeTimestamp(commit.order, startTime)}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <span className="font-mono text-blue-400">{commit.sha}</span>
              <button className={classNames("p-1 rounded", theme.hover)}><Copy className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
