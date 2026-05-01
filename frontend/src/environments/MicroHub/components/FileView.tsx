import { Copy } from "lucide-react";
import { classNames, highlightCode } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";

export const FileView = () => {
  const { theme } = useTheme();
  const { repository, selectedFile } = useMicrohubCtx();
  const { setRoute, setExpandedFolders } = useMicrohubUI();

  if (!repository) return null;
  if (!selectedFile || selectedFile.type === "folder") return null;

  const lines = selectedFile.content?.split("\n") || [];

  return (
    <div className="p-4">
      <div className={classNames("flex items-center space-x-2 text-sm mb-4", theme.textSecondary)}>
        <a href="#" onClick={(e) => { e.preventDefault(); setRoute("code"); }} className="text-blue-400 hover:underline">
          {repository.name}
        </a>
        {selectedFile.path.split("/").map((part, i, arr) => {
          const isLast = i === arr.length - 1;
          // Build the path up to this part for navigation
          const pathUpToHere = arr.slice(0, i + 1).join("/");

          const handleBreadcrumbClick = () => {
            if (isLast) return; // Don't navigate if clicking current file
            // Expand all folders up to this path and go back to code view
            const pathParts = pathUpToHere.split("/");
            const foldersToExpand: string[] = [];
            for (let j = 1; j <= pathParts.length; j++) {
              foldersToExpand.push(pathParts.slice(0, j).join("/"));
            }
            setExpandedFolders(prev => [...new Set([...prev, ...foldersToExpand])]);
            setRoute("code");
          };

          return (
            <span key={i} className="flex items-center">
              <span className="mx-1">/</span>
              <span
                className={isLast ? theme.text : "text-blue-400 hover:underline cursor-pointer"}
                onClick={!isLast ? handleBreadcrumbClick : undefined}
              >
                {part}
              </span>
            </span>
          );
        })}
      </div>

      <div className={classNames("border rounded-md", theme.border)}>
        <div className={classNames("px-4 py-2 border-b flex items-center justify-between", theme.bgSecondary, theme.border)}>
          <div className="flex items-center space-x-4 text-sm">
            <span>{lines.length} lines</span>
            <span>{selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ""}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button className={classNames("p-1.5 rounded", theme.hover)}><Copy className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <pre className="text-sm leading-6">
            <code>
              {lines.map((line, i) => (
                <div key={i} className={classNames("flex", theme.hover)}>
                  <span className={classNames("w-12 text-right pr-4 select-none border-r", theme.textMuted, theme.borderLight, theme.bg)}>
                    {i + 1}
                  </span>
                  <span
                    className="pl-4 flex-1"
                    dangerouslySetInnerHTML={{ __html: highlightCode(line || " ", selectedFile.language || "plaintext") }}
                  />
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};
