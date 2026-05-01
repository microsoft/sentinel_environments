import {
  Search,
  GitPullRequest,
  GitMerge,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
} from "lucide-react";
import { classNames, computeRelativeTimestamp } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";
import { LabelBadge } from "./LabelBadge";

export const PullRequestsList = () => {
  const { theme } = useTheme();
  const {
    filteredPRs,
    openPRsCount,
    closedPRsCount,
    getLabelsByIds,
    startTime,
  } = useMicrohubCtx();
  const {
    prFilter,
    setPrFilter,
    setNewPRModalOpen,
    setRoute,
    handleViewProfile,
  } = useMicrohubUI();

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center space-x-2 flex-1">
          <div className="relative flex-1 max-w-lg">
            <Search className={classNames("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", theme.textSecondary)} />
            <input type="text" placeholder="Search all pull requests" className={classNames("w-full pl-10 pr-4 py-1.5 border rounded-md text-sm", theme.inputBg, theme.border)} />
          </div>
        </div>
        <button
          onClick={() => setNewPRModalOpen(true)}
          className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-md text-white font-medium"
        >
          New pull request
        </button>
      </div>

      <div className={classNames("flex items-center justify-between border-b pb-3 mb-4", theme.border)}>
        <div className="flex items-center space-x-4">
          <button onClick={() => setPrFilter("open")} className={classNames("flex items-center space-x-1 text-sm", prFilter === "open" ? classNames(theme.text, "font-medium") : theme.textSecondary)}>
            <GitPullRequest className="w-4 h-4" /><span>{openPRsCount} Open</span>
          </button>
          <button onClick={() => setPrFilter("closed")} className={classNames("flex items-center space-x-1 text-sm", prFilter === "closed" ? classNames(theme.text, "font-medium") : theme.textSecondary)}>
            <CheckCircle2 className="w-4 h-4" /><span>{closedPRsCount} Closed</span>
          </button>
        </div>
      </div>

      <div className={classNames("border rounded-md", theme.border)}>
        {filteredPRs.map((pr, index) => (
          <div key={pr.id} onClick={() => { setRoute("pr-detail", pr.id); }} className={classNames("flex items-start p-4 cursor-pointer", theme.hover, index < filteredPRs.length - 1 && classNames("border-b", theme.borderLight))}>
            <div className="mr-3 mt-1">
              {pr.state === "open" ? <GitPullRequest className="w-4 h-4 text-green-500" /> : pr.state === "merged" ? <GitMerge className="w-4 h-4 text-purple-500" /> : <GitPullRequest className="w-4 h-4 text-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span className={classNames("font-medium hover:text-blue-400", theme.text)}>{pr.title}</span>
                {getLabelsByIds(pr.labelIds).map(label => label && <LabelBadge key={label.id} label={label} />)}
              </div>
              <div className={classNames("text-xs mt-1", theme.textSecondary)}>
                #{pr.number} opened {computeRelativeTimestamp(pr.order, startTime)} by <span className="hover:text-blue-400 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleViewProfile(pr.author); }}>{pr.author}</span>
                <span className="ml-2">{pr.sourceBranch} → {pr.targetBranch}</span>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                {pr.checks.map((check, i) => (
                  <span key={i} className="flex items-center text-xs">
                    {check.status === "success" ? <CheckCircle2 className="w-3 h-3 text-green-500 mr-1" /> : check.status === "failure" ? <XCircle className="w-3 h-3 text-red-500 mr-1" /> : <Clock className="w-3 h-3 text-yellow-500 mr-1" />}
                    {check.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4 ml-4">
              <span className={classNames("px-2 py-0.5 text-xs rounded-full", pr.reviewStatus === "approved" ? "bg-green-900/30 text-green-400" : pr.reviewStatus === "changes-requested" ? "bg-red-900/30 text-red-400" : pr.reviewStatus === "draft" ? classNames(theme.bgTertiary, theme.textSecondary) : "bg-yellow-900/30 text-yellow-400")}>
                {pr.reviewStatus === "approved" ? "Approved" : pr.reviewStatus === "changes-requested" ? "Changes requested" : pr.reviewStatus === "draft" ? "Draft" : "Review required"}
              </span>
              {pr.comments.length > 0 && (
                <div className={classNames("flex items-center space-x-1 text-sm", theme.textSecondary)}>
                  <MessageSquare className="w-4 h-4" /><span>{pr.comments.length}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
