import { CircleDot, CheckCircle2 } from "lucide-react";
import { classNames, computeRelativeTimestamp } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";
import { Avatar } from "./Avatar";
import { ClickableUsername } from "./ClickableUsername";
import { LabelBadge } from "./LabelBadge";

export const IssueDetail = () => {
  const { theme, darkMode } = useTheme();
  const {
    selectedIssue,
    getUserByUsername,
    getLabelsByIds,
    startTime,
    commentOnIssue,
  } = useMicrohubCtx();
  const {
    newCommentText,
    setNewCommentText,
    handleViewProfile,
  } = useMicrohubUI();

  if (!selectedIssue) return null;
  const author = getUserByUsername(selectedIssue.author);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">
          {selectedIssue.title}
          <span className={classNames("font-normal ml-2", theme.textSecondary)}>#{selectedIssue.number}</span>
        </h1>
        <div className="flex items-center space-x-2">
          <span className={classNames("flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium", selectedIssue.state === "open" ? "bg-green-900/30 text-green-400" : "bg-purple-900/30 text-purple-400")}>
            {selectedIssue.state === "open" ? <CircleDot className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span className="capitalize">{selectedIssue.state}</span>
          </span>
          <span className={classNames("text-sm", theme.textSecondary)}>
            <ClickableUsername username={selectedIssue.author} className="font-medium" />
            {" "}opened this issue {computeRelativeTimestamp(selectedIssue.order, startTime, selectedIssue.createdAt)} · {selectedIssue.comments.length} comment{selectedIssue.comments.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className={classNames("border rounded-md mb-4", theme.border)}>
            <div className={classNames("px-4 py-2 border-b flex items-center justify-between rounded-t-md", theme.bgSecondary, theme.border)}>
              <div className="flex items-center space-x-2">
                <Avatar user={author} size="sm" />
                <ClickableUsername username={selectedIssue.author} className="font-medium text-sm" />
                <span className={classNames("text-sm", theme.textSecondary)}>commented {computeRelativeTimestamp(selectedIssue.order, startTime, selectedIssue.createdAt)}</span>
              </div>
            </div>
            <div className="p-4">
              <div className={classNames("prose prose-sm max-w-none whitespace-pre-wrap", darkMode ? "prose-invert" : "")}>{selectedIssue.body}</div>
            </div>
          </div>

          {selectedIssue.comments.map(comment => {
            const commentAuthor = getUserByUsername(comment.author);
            return (
              <div key={comment.id} className={classNames("border rounded-md mb-4", theme.border)}>
                <div className={classNames("px-4 py-2 border-b flex items-center space-x-2 rounded-t-md", theme.bgSecondary, theme.border)}>
                  <Avatar user={commentAuthor} size="sm" />
                  <ClickableUsername username={comment.author} className="font-medium text-sm" />
                  <span className={classNames("text-sm", theme.textSecondary)}>commented {computeRelativeTimestamp(comment.order, startTime)}</span>
                </div>
                <div className="p-4">
                  <p className="text-sm">{comment.body}</p>
                  {(comment.reactions?.length ?? 0) > 0 && (
                    <div className="flex items-center space-x-2 mt-3">
                      {(comment.reactions ?? []).map((reaction, i) => (
                        <span key={i} className={classNames("px-2 py-0.5 rounded-full text-sm", theme.bgTertiary)}>{reaction.emoji} {reaction.count}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add comment form */}
          <div className={classNames("border rounded-md", theme.border)}>
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
                    commentOnIssue(selectedIssue.id, newCommentText.trim());
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
        </div>

        <div className="w-64 space-y-4">
          <div>
            <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Assignees</h4>
            {selectedIssue.assignees.length > 0 ? (
              <div className="space-y-2">
                {selectedIssue.assignees.map(username => {
                  const user = getUserByUsername(username);
                  return (
                    <div key={username} className="flex items-center space-x-2 cursor-pointer hover:text-blue-400" onClick={() => handleViewProfile(username)}>
                      <Avatar user={user} size="sm" />
                      <span className="text-sm">{username}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={classNames("text-sm", theme.textSecondary)}>No one assigned</p>
            )}
          </div>
          <div>
            <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Labels</h4>
            {selectedIssue.labelIds.length > 0 ? (
              <div className="flex flex-wrap gap-1">{getLabelsByIds(selectedIssue.labelIds).map(label => label && <LabelBadge key={label.id} label={label} />)}</div>
            ) : (
              <p className={classNames("text-sm", theme.textSecondary)}>None yet</p>
            )}
          </div>
          {selectedIssue.milestone && (
            <div>
              <h4 className={classNames("text-xs font-medium mb-2", theme.textSecondary)}>Milestone</h4>
              <p className="text-sm">{selectedIssue.milestone}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
