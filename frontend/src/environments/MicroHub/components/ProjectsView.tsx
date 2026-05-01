import { classNames } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";

export const ProjectsView = () => {
  const { theme } = useTheme();
  const { projects, issues, pulls } = useMicrohubCtx();
  const { selectedProject, setSelectedProject } = useMicrohubUI();

  const currentProject = projects.find(p => p.id === selectedProject);

  const getCardContent = (card: { type: string; contentId?: string; note?: string }) => {
    if (card.type === "note") return { title: card.note || "", subtitle: "Note" };
    if (card.type === "issue" && card.contentId) {
      const issue = issues.find(i => i.id === card.contentId);
      return issue ? { title: issue.title, subtitle: `#${issue.number} · ${issue.state}` } : { title: "Unknown issue", subtitle: "" };
    }
    if (card.type === "pull_request" && card.contentId) {
      const pr = pulls.find(p => p.id === card.contentId);
      return pr ? { title: pr.title, subtitle: `#${pr.number} · ${pr.state}` } : { title: "Unknown PR", subtitle: "" };
    }
    return { title: "Unknown", subtitle: "" };
  };

  return (
    <div className="p-4">
      {/* Project selector */}
      <div className="flex items-center space-x-4 mb-6">
        <h2 className="text-lg font-semibold">Projects</h2>
        <div className="flex space-x-2">
          {projects.map(proj => (
            <button
              key={proj.id}
              onClick={() => setSelectedProject(proj.id)}
              className={classNames(
                "px-3 py-1.5 text-sm rounded-md",
                selectedProject === proj.id ? "bg-blue-600 text-white" : classNames(theme.bgTertiary, theme.hover)
              )}
            >
              {proj.name}
            </button>
          ))}
        </div>
      </div>

      {currentProject && (
        <>
          <p className={classNames("text-sm mb-4", theme.textSecondary)}>{currentProject.description}</p>

          {/* Kanban board */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {currentProject.columns.sort((a, b) => a.order - b.order).map(column => (
              <div key={column.id} className={classNames("w-72 flex-shrink-0 border rounded-lg", theme.border, theme.bgSecondary)}>
                <div className={classNames("px-3 py-2 border-b font-medium text-sm flex items-center justify-between", theme.border)}>
                  <span>{column.name}</span>
                  <span className={classNames("text-xs px-1.5 py-0.5 rounded", theme.badge)}>{column.cards.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {column.cards.sort((a, b) => a.order - b.order).map(card => {
                    const content = getCardContent(card);
                    return (
                      <div key={card.id} className={classNames("p-3 rounded border text-sm cursor-pointer", theme.bg, theme.border, theme.hover)}>
                        <p className="font-medium">{content.title}</p>
                        <p className={classNames("text-xs mt-1", theme.textSecondary)}>{content.subtitle}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
