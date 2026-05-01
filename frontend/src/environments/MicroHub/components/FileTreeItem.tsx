import { memo } from "react";
import { ChevronRight, Folder, FileText } from "lucide-react";
import { classNames } from "../utils";
import { useTheme, useMicrohubUI } from "../contexts";
// Type-only import is erased at compile time, so this does not create a
// runtime cycle with index.tsx.
import type { RepoFile } from "../index";

interface FileTreeItemProps {
  file: RepoFile;
  depth?: number;
}

const FileTreeItemImpl = ({ file, depth = 0 }: FileTreeItemProps) => {
  const { theme } = useTheme();
  const { expandedFolders, toggleFolder, handleViewFile } = useMicrohubUI();

  const isFolder = file.type === "folder";
  const isExpanded = expandedFolders.includes(file.path);

  return (
    <>
      <div
        onClick={() => isFolder ? toggleFolder(file.path) : handleViewFile(file.path)}
        className={classNames(
          "flex items-center justify-between px-4 py-2 cursor-pointer border-b",
          theme.hover, theme.borderLight
        )}
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        <div className="flex items-center space-x-3">
          {isFolder ? (
            <>
              <ChevronRight className={classNames("w-4 h-4 transition-transform", theme.textMuted, isExpanded && "rotate-90")} />
              <Folder className="w-4 h-4 text-blue-400" />
            </>
          ) : (
            <>
              <span className="w-4" />
              <FileText className={classNames("w-4 h-4", theme.textSecondary)} />
            </>
          )}
          <span className={classNames("text-sm", isFolder ? "text-blue-400" : theme.text)}>
            {file.name}
          </span>
        </div>
        <div className={classNames("flex items-center space-x-8 text-sm", theme.textSecondary)}>
          <span className={classNames("w-64 truncate", theme.textMuted)}>{file.lastCommit.message}</span>
          <span className="w-24 text-right">recently</span>
        </div>
      </div>
      {isFolder && isExpanded && file.children?.map(child => (
        <FileTreeItem key={child.id} file={child} depth={depth + 1} />
      ))}
    </>
  );
};

// Module-scope + React.memo. Recursion through the exported (memo'd)
// identifier is intentional — children get the same memo benefits as the
// root.
//
// FileTreeItem consumes Theme + UI contexts but NOT MicroHubDataContext, so
// poll ticks (which re-derive the Data context value every second) do not
// re-render FileTreeItem on their own. Combined with the parent's
// `useMemo(() => buildFileTree(files), [files])` (where `files` is part of
// the static, non-polled dataset), the `file` prop ref is stable across
// ticks, so memo's shallow-compare actually skips work between polls. Memo
// re-renders happen on theme toggle and UI interactions (folder expansion,
// file selection), which is the desired behavior.
export const FileTreeItem = memo(FileTreeItemImpl);
