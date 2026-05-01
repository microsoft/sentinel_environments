import { classNames } from "../utils";
import { useTheme, useMicrohubCtx } from "../contexts";
import { Avatar } from "./Avatar";

export const InsightsView = () => {
  const { theme } = useTheme();
  const { insights, insightsContributorsData, getUserByUsername } = useMicrohubCtx();

  const contributorsData = insightsContributorsData;

  // Use static commit activity data (represents historical weekly activity)
  const commitActivityData = insights.find(d => d.type === "commit_activity")?.data as { week: string; total: number; days: number[] }[] || [];

  const maxCommits = Math.max(...contributorsData.map(c => c.commits), 1);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-6">Insights</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contributors */}
        <div className={classNames("border rounded-lg", theme.border)}>
          <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
            <h3 className="font-medium">Contributors</h3>
          </div>
          <div className="p-4 space-y-3">
            {contributorsData.slice(0, 8).map(contributor => {
              const user = getUserByUsername(contributor.username);
              return (
                <div key={contributor.userId} className="flex items-center space-x-3">
                  <Avatar user={user} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{contributor.username}</span>
                      <span className={classNames("text-xs", theme.textSecondary)}>{contributor.commits} commits</span>
                    </div>
                    <div className={classNames("h-2 rounded-full mt-1", theme.bgTertiary)}>
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${(contributor.commits / maxCommits) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Commit Activity */}
        <div className={classNames("border rounded-lg", theme.border)}>
          <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
            <h3 className="font-medium">Commit Activity</h3>
          </div>
          <div className="p-4">
            <div className="flex items-end space-x-1 h-32">
              {commitActivityData.slice(-12).map((week, idx) => {
                const maxWeeklyCommits = Math.max(...commitActivityData.map(w => w.total), 1);
                const height = (week.total / maxWeeklyCommits) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-green-500 rounded-t"
                      style={{ height: `${height}%`, minHeight: week.total > 0 ? "4px" : "0" }}
                      title={`${week.week}: ${week.total} commits`}
                    />
                  </div>
                );
              })}
            </div>
            <div className={classNames("flex justify-between mt-2 text-xs", theme.textSecondary)}>
              <span>12 weeks ago</span>
              <span>Now</span>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className={classNames("border rounded-lg lg:col-span-2", theme.border)}>
          <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
            <h3 className="font-medium">Summary</h3>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={classNames("p-4 rounded-lg text-center", theme.bgTertiary)}>
              <p className="text-2xl font-bold">{contributorsData.length}</p>
              <p className={classNames("text-sm", theme.textSecondary)}>Contributors</p>
            </div>
            <div className={classNames("p-4 rounded-lg text-center", theme.bgTertiary)}>
              <p className="text-2xl font-bold">{contributorsData.reduce((sum, c) => sum + c.commits, 0)}</p>
              <p className={classNames("text-sm", theme.textSecondary)}>Total Commits</p>
            </div>
            <div className={classNames("p-4 rounded-lg text-center", theme.bgTertiary)}>
              <p className="text-2xl font-bold text-green-500">+{contributorsData.reduce((sum, c) => sum + c.additions, 0).toLocaleString()}</p>
              <p className={classNames("text-sm", theme.textSecondary)}>Lines Added</p>
            </div>
            <div className={classNames("p-4 rounded-lg text-center", theme.bgTertiary)}>
              <p className="text-2xl font-bold text-red-500">-{contributorsData.reduce((sum, c) => sum + c.deletions, 0).toLocaleString()}</p>
              <p className={classNames("text-sm", theme.textSecondary)}>Lines Deleted</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
