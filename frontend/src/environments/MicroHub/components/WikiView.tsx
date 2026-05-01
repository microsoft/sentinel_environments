import { BookOpen } from "lucide-react";
import { classNames } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";

export const WikiView = () => {
  const { theme, darkMode } = useTheme();
  const { wiki } = useMicrohubCtx();
  const { selectedWikiPage, setSelectedWikiPage } = useMicrohubUI();

  const currentPage = wiki.find(p => p.id === selectedWikiPage);

  return (
    <div className="p-4 flex gap-6">
      {/* Sidebar - Pages */}
      <div className="w-56 flex-shrink-0">
        <h3 className={classNames("text-sm font-medium mb-3", theme.textSecondary)}>Pages</h3>
        <div className={classNames("border rounded-lg", theme.border)}>
          {wiki.map((page, idx) => (
            <button
              key={page.id}
              onClick={() => setSelectedWikiPage(page.id)}
              className={classNames(
                "w-full text-left px-3 py-2 text-sm flex items-center space-x-2",
                idx > 0 && classNames("border-t", theme.borderLight),
                selectedWikiPage === page.id ? theme.bgTertiary : theme.hover
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span>{page.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {currentPage && (
          <div className={classNames("border rounded-lg", theme.border)}>
            <div className={classNames("px-4 py-3 border-b flex items-center justify-between", theme.bgSecondary, theme.border)}>
              <h1 className="text-xl font-semibold">{currentPage.title}</h1>
              <div className={classNames("flex items-center space-x-2 text-sm", theme.textSecondary)}>
                <span>Last edited by</span>
                <span className="font-medium">{currentPage.lastEditedBy}</span>
              </div>
            </div>
            <div className={classNames("p-6 prose max-w-none", darkMode ? "prose-invert" : "")}>
              {currentPage.content.split("\n").map((line, idx) => {
                if (line.startsWith("# ")) return <h1 key={idx} className="text-2xl font-bold mt-0 mb-4">{line.slice(2)}</h1>;
                if (line.startsWith("## ")) return <h2 key={idx} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>;
                if (line.startsWith("### ")) return <h3 key={idx} className="text-lg font-medium mt-4 mb-2">{line.slice(4)}</h3>;
                if (line.startsWith("```")) return null;
                if (line.startsWith("- ")) return <li key={idx} className="ml-4">{line.slice(2)}</li>;
                if (line.trim() === "") return <br key={idx} />;
                return <p key={idx} className="mb-2">{line}</p>;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
