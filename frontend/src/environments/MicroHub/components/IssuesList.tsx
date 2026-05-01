import {
  Search,
  Tag,
  CircleDot,
  CheckCircle2,
  ChevronDown,
  Check,
  MessageSquare,
} from "lucide-react";
import { classNames, computeRelativeTimestamp } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";
import { Avatar } from "./Avatar";
import { LabelBadge } from "./LabelBadge";
import type { SortOption } from "../index";

export const IssuesList = () => {
  const { theme } = useTheme();
  const {
    filteredIssues,
    openIssuesCount,
    closedIssuesCount,
    getUserByUsername,
    getLabelsByIds,
    startTime,
  } = useMicrohubCtx();
  const {
    searchQuery,
    setSearchQuery,
    issueFilter,
    setIssueFilter,
    issueSort,
    setIssueSort,
    sortDropdownOpen,
    setSortDropdownOpen,
    setNewIssueModalOpen,
    setRoute,
    handleViewProfile,
  } = useMicrohubUI();

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center space-x-2 flex-1">
          <div className="relative flex-1 max-w-lg">
            <Search className={classNames("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", theme.textSecondary)} />
            <input
              type="text"
              placeholder="Search all issues"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={classNames("w-full pl-10 pr-4 py-1.5 border rounded-md text-sm", theme.inputBg, theme.border)}
            />
          </div>
          <button className={classNames("px-3 py-1.5 text-sm border rounded-md flex items-center", theme.bgTertiary, theme.border, theme.hover)}>
            <Tag className="w-4 h-4 mr-1" />Labels
          </button>
        </div>
        <button
          onClick={() => setNewIssueModalOpen(true)}
          className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-md text-white font-medium"
        >
          New issue
        </button>
      </div>

      <div className={classNames("flex items-center justify-between border-b pb-3 mb-4", theme.border)}>
        <div className="flex items-center space-x-4">
          <button onClick={() => setIssueFilter("open")} className={classNames("flex items-center space-x-1 text-sm", issueFilter === "open" ? classNames(theme.text, "font-medium") : theme.textSecondary)}>
            <CircleDot className="w-4 h-4" /><span>{openIssuesCount} Open</span>
          </button>
          <button onClick={() => setIssueFilter("closed")} className={classNames("flex items-center space-x-1 text-sm", issueFilter === "closed" ? classNames(theme.text, "font-medium") : theme.textSecondary)}>
            <CheckCircle2 className="w-4 h-4" /><span>{closedIssuesCount} Closed</span>
          </button>
        </div>
        <div className="relative">
          <button onClick={() => setSortDropdownOpen(!sortDropdownOpen)} className={classNames("flex items-center space-x-1 text-sm", theme.textSecondary)}>
            <span>Sort</span><ChevronDown className="w-4 h-4" />
          </button>
          {sortDropdownOpen && (
            <div className={classNames("absolute right-0 mt-2 w-48 border rounded-lg shadow-lg z-10", theme.bgSecondary, theme.border)}>
              {[{ key: "newest", label: "Newest" }, { key: "oldest", label: "Oldest" }, { key: "most-commented", label: "Most commented" }].map(option => (
                <button key={option.key} onClick={() => { setIssueSort(option.key as SortOption); setSortDropdownOpen(false); }} className={classNames("w-full text-left px-4 py-2 text-sm", theme.hover, issueSort === option.key && theme.text)}>
                  {issueSort === option.key && <Check className="w-4 h-4 inline mr-2" />}
                  <span className={issueSort !== option.key ? "ml-6" : ""}>{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={classNames("border rounded-md", theme.border)}>
        {filteredIssues.length === 0 ? (
          <div className={classNames("p-8 text-center", theme.textSecondary)}>
            <CircleDot className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No issues found</p>
          </div>
        ) : (
          filteredIssues.map((issue, index) => (
            <div key={issue.id} onClick={() => { setRoute("issue-detail", issue.id); }} className={classNames("flex items-start p-4 cursor-pointer", theme.hover, index < filteredIssues.length - 1 && classNames("border-b", theme.borderLight))}>
              <div className="mr-3 mt-1">
                {issue.state === "open" ? <CircleDot className="w-4 h-4 text-green-500" /> : <CheckCircle2 className="w-4 h-4 text-purple-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <span className={classNames("font-medium hover:text-blue-400", theme.text)}>{issue.title}</span>
                  {getLabelsByIds(issue.labelIds).map(label => label && <LabelBadge key={label.id} label={label} />)}
                </div>
                <div className={classNames("text-xs mt-1", theme.textSecondary)}>
                  #{issue.number} opened {computeRelativeTimestamp(issue.order, startTime, issue.createdAt)} by <span className="hover:text-blue-400 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleViewProfile(issue.author); }}>{issue.author}</span>
                </div>
              </div>
              <div className="flex items-center space-x-4 ml-4">
                {issue.assignees.length > 0 && (
                  <div className="flex -space-x-1">
                    {issue.assignees.slice(0, 3).map(username => <Avatar key={username} user={getUserByUsername(username)} size="sm" />)}
                  </div>
                )}
                {issue.comments.length > 0 && (
                  <div className={classNames("flex items-center space-x-1 text-sm", theme.textSecondary)}>
                    <MessageSquare className="w-4 h-4" /><span>{issue.comments.length}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
