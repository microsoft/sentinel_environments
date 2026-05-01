import {
  GitMerge,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  ChevronDown,
} from "lucide-react";
import { classNames, computeRelativeTimestamp } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";
import { Avatar } from "./Avatar";
import { LabelBadge } from "./LabelBadge";

export const PRDetail = () => {
  const { theme, darkMode } = useTheme();
  const {
    selectedPR,
    getUserByUsername,
    getLabelsByIds,
    startTime,
    commentOnPR,
  } = useMicrohubCtx();
  const {
    newCommentText,
    setNewCommentText,
    handleMergePR,
    mergeDropdownOpen,
    setMergeDropdownOpen,
    selectedMergeMethod,
    setSelectedMergeMethod,
  } = useMicrohubUI();

  if (!selectedPR) return null;
  const author = getUserByUsername(selectedPR.author);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">
          {selectedPR.title}
          <span className={classNames("font-normal ml-2", theme.textSecondary)}>#{selectedPR.number}</span>
        </h1>
        <div className="flex items-center space-x-2 flex-wrap">
          <span className={classNames("flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium", selectedPR.state === "open" ? "bg-green-900/30 text-green-400" : selectedPR.state === "merged" ? "bg-purple-900/30 text-purple-400" : "bg-red-900/30 text-red-400")}>
            {selectedPR.state === "merged" ? <GitMerge className="w-4 h-4" /> : <GitPullRequest className="w-4 h-4" />}
            <span className="capitalize">{selectedPR.state}</span>
          </span>
          <span className={classNames("text-sm", theme.textSecondary)}>
            <span className="font-medium">{selectedPR.author}</span>
            {" "}wants to merge into <span className="font-mono text-blue-400">{selectedPR.targetBranch}</span>
            {" "}from <span className="font-mono text-blue-400">{selectedPR.sourceBranch}</span>
          </span>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className={classNames("border rounded-md mb-4", theme.border)}>
            <div className={classNames("px-4 py-2 border-b rounded-t-md flex items-center space-x-2", theme.bgSecondary, theme.border)}>
              <Avatar user={author} size="sm" />
              <span className="font-medium text-sm">{selectedPR.author}</span>
              <span className={classNames("text-sm", theme.textSecondary)}>commented {computeRelativeTimestamp(selectedPR.order, startTime)}</span>
            </div>
            <div className="p-4">
              <div className={classNames("prose prose-sm max-w-none whitespace-pre-wrap", darkMode ? "prose-invert" : "")}>{selectedPR.body}</div>
            </div>
          </div>

          {selectedPR.comments.map(comment => {
            const commentAuthor = getUserByUsername(comment.author);
            return (
              <div key={comment.id} className={classNames("border rounded-md mb-4", theme.border)}>
                <div className={classNames("px-4 py-2 border-b rounded-t-md flex items-center space-x-2", theme.bgSecondary, theme.border)}>
                  <Avatar user={commentAuthor} size="sm" />
                  <span className="font-medium text-sm">{comment.author}</span>
                  <span className={classNames("text-sm", theme.textSecondary)}>commented {computeRelativeTimestamp(comment.order, startTime)}</span>
                </div>
                <div className="p-4">
                  <p className="text-sm">{comment.body}</p>
                </div>
              </div>
            );
          })}

          {/* Add comment form for PR */}
          <div className={classNames("border rounded-md mb-4", theme.border)}>
            <div className={classNames("px-4 py-2 border-b rounded-t-md", theme.bgSecondary, theme.border)}>
              <span className="text-sm font-medium">Add a comment</span>
            </div>
            <div className="p-4">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Leave a comment"
                className={classNames("w-full p-3 border rounded-md text-sm resize-none", theme.inputBg, theme.border, theme.text)}
                rows={4}
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => {
                    if (!newCommentText.trim()) return;
                    commentOnPR(selectedPR.id, newCommentText.trim());
                    setNewCommentText("");
                  }}
                  disabled={!newCommentText.trim()}
                  className={classNames(
                    "px-4 py-1.5 text-sm rounded-md font-medium",
                    newCommentText.trim()
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-gray-600 text-gray-400 cursor-not-allowed"
                  )}
                >
                  Comment
                </button>
              </div>
            </div>
          </div>

          {selectedPR.state === "open" && (
            <div className={classNames("border rounded-md p-4", theme.border)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Ready to merge?</h3>
                  <p className={classNames("text-sm", theme.textSecondary)}>All checks have passed</p>
                </div>
                <div className="relative">
                  <div className="flex">
                    <button
                      onClick={() => handleMergePR(selectedPR.id)}
                      className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-l-md text-white border-r border-green-700"
                    >
                      {selectedMergeMethod === "merge" && "Merge pull request"}
                      {selectedMergeMethod === "squash" && "Squash and merge"}
                      {selectedMergeMethod === "rebase" && "Rebase and merge"}
                    </button>
                    <button
                      onClick={() => setMergeDropdownOpen(!mergeDropdownOpen)}
                      className="px-2 py-1.5 bg-green-600 hover:bg-green-700 rounded-r-md text-white"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  {mergeDropdownOpen && (
                    <div className={classNames("absolute right-0 bottom-full mb-1 w-72 rounded-md shadow-lg border z-20", theme.bg, theme.border)}>
                      <div className="py-1">
                        <button
                          onClick={() => { setSelectedMergeMethod("merge"); setMergeDropdownOpen(false); }}
                          className={classNames("w-full text-left px-4 py-3", theme.hover, selectedMergeMethod === "merge" && theme.bgTertiary)}
                        >
                          <div className="flex items-center space-x-2">
                            {selectedMergeMethod === "merge" && <Check className="w-4 h-4 text-green-500" />}
                            {selectedMergeMethod !== "merge" && <div className="w-4" />}
                            <div>
                              <div className="font-medium text-sm">Create a merge commit</div>
                              <div className={classNames("text-xs", theme.textSecondary)}>All commits will be added with a merge commit.</div>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => { setSelectedMergeMethod("squash"); setMergeDropdownOpen(false); }}
                          className={classNames("w-full text-left px-4 py-3", theme.hover, selectedMergeMethod === "squash" && theme.bgTertiary)}
                        >
                          <div className="flex items-center space-x-2">
                            {selectedMergeMethod === "squash" && <Check className="w-4 h-4 text-green-500" />}
                            {selectedMergeMethod !== "squash" && <div className="w-4" />}
                            <div>
                              <div className="font-medium text-sm">Squash and merge</div>
                              <div className={classNames("text-xs", theme.textSecondary)}>Commits will be combined into one commit.</div>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => { setSelectedMergeMethod("rebase"); setMergeDropdownOpen(false); }}
                          className={classNames("w-full text-left px-4 py-3", theme.hover, selectedMergeMethod === "rebase" && theme.bgTertiary)}
                        >
                          <div className="flex items-center space-x-2">
                            {selectedMergeMethod === "rebase" && <Check className="w-4 h-4 text-green-500" />}
                            {selectedMergeMethod !== "rebase" && <div className="w-4" />}
                            <div>
                              <div className="font-medium text-sm">Rebase and merge</div>
                              <div className={classNames("text-xs", theme.textSecondary)}>Commits will be rebased onto the base branch.</div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-64 space-y-4">
          <div>
            <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Reviewers</h4>
            {selectedPR.reviewers.length > 0 ? (
              <div className="space-y-2">
                {selectedPR.reviewers.map(username => {
                  const user = getUserByUsername(username);
                  return (
                    <div key={username} className="flex items-center space-x-2">
                      <Avatar user={user} size="sm" />
                      <span className="text-sm">{username}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={classNames("text-sm", theme.textSecondary)}>No reviewers</p>
            )}
          </div>
          <div>
            <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Labels</h4>
            {selectedPR.labelIds.length > 0 ? (
              <div className="flex flex-wrap gap-1">{getLabelsByIds(selectedPR.labelIds).map(label => label && <LabelBadge key={label.id} label={label} />)}</div>
            ) : (
              <p className={classNames("text-sm", theme.textSecondary)}>None yet</p>
            )}
          </div>
          <div>
            <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Checks</h4>
            <div className="space-y-1">
              {selectedPR.checks.map((check, i) => (
                <div key={i} className="flex items-center space-x-2 text-sm">
                  {check.status === "success" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : check.status === "failure" ? <XCircle className="w-4 h-4 text-red-500" /> : <Clock className="w-4 h-4 text-yellow-500" />}
                  <span>{check.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
