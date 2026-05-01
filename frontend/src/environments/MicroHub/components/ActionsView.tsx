import {
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { classNames, computeRelativeTimestamp } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";

export const ActionsView = () => {
  const { theme, darkMode } = useTheme();
  const { runs, workflows, startTime } = useMicrohubCtx();
  const {
    selectedWorkflow,
    setSelectedWorkflow,
    selectedWorkflowRun,
    setSelectedWorkflowRun,
  } = useMicrohubUI();

  const filteredRuns = selectedWorkflow
    ? runs.filter(run => run.workflowId === selectedWorkflow)
    : runs;

  const selectedRunData = selectedWorkflowRun ? runs.find(r => r.id === selectedWorkflowRun) : null;

  const getStatusIcon = (status: string, conclusion: string | null) => {
    if (status === "in_progress") return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
    if (status === "queued") return <Clock className="w-4 h-4 text-gray-500" />;
    if (conclusion === "success") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (conclusion === "failure") return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-gray-500" />;
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "--";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (selectedRunData) {
    return (
      <div className="p-4">
        <button onClick={() => setSelectedWorkflowRun(null)} className={classNames("flex items-center space-x-2 mb-4 text-sm", theme.textSecondary, "hover:text-blue-400")}>
          <ChevronRight className="w-4 h-4 rotate-180" />
          <span>All workflow runs</span>
        </button>

        <div className="flex items-center space-x-3 mb-6">
          {getStatusIcon(selectedRunData.status, selectedRunData.conclusion)}
          <div>
            <h1 className="text-xl font-semibold">{selectedRunData.commit.message}</h1>
            <p className={classNames("text-sm", theme.textSecondary)}>
              {selectedRunData.workflowName} #{selectedRunData.runNumber} · {selectedRunData.event} · {selectedRunData.branch}
            </p>
          </div>
        </div>

        <div className={classNames("border rounded-lg", theme.border)}>
          <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
            <h3 className="font-medium">Jobs</h3>
          </div>
          <div className="divide-y" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
            {selectedRunData.jobs.map(job => (
              <div key={job.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(job.status, job.conclusion)}
                    <span className="font-medium">{job.name}</span>
                  </div>
                  <span className={classNames("text-sm", theme.textSecondary)}>{formatDuration(job.duration)}</span>
                </div>
                <div className={classNames("ml-6 border-l-2 pl-4 space-y-2", theme.border)}>
                  {job.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(step.status, step.conclusion)}
                        <span>{step.name}</span>
                      </div>
                      <span className={theme.textSecondary}>{formatDuration(step.duration)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex gap-6">
        {/* Sidebar - Workflows */}
        <div className="w-64 flex-shrink-0">
          <h3 className={classNames("text-sm font-medium mb-2", theme.textSecondary)}>Workflows</h3>
          <div className={classNames("border rounded-lg", theme.border)}>
            <button
              onClick={() => setSelectedWorkflow(null)}
              className={classNames("w-full text-left px-3 py-2 text-sm", !selectedWorkflow ? theme.bgTertiary : theme.hover)}
            >
              All workflows
            </button>
            {workflows.map(wf => (
              <button
                key={wf.id}
                onClick={() => setSelectedWorkflow(wf.id)}
                className={classNames("w-full text-left px-3 py-2 text-sm border-t", theme.borderLight, selectedWorkflow === wf.id ? theme.bgTertiary : theme.hover)}
              >
                {wf.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main content - Runs */}
        <div className="flex-1">
          <div className={classNames("border rounded-lg", theme.border)}>
            <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
              <h2 className="font-medium">{filteredRuns.length} workflow runs</h2>
            </div>
            <div className="divide-y" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
              {filteredRuns.map(run => (
                <div key={run.id} onClick={() => setSelectedWorkflowRun(run.id)} className={classNames("px-4 py-3 cursor-pointer", theme.hover)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(run.status, run.conclusion)}
                      <div>
                        <p className="font-medium text-sm">{run.commit.message}</p>
                        <p className={classNames("text-xs", theme.textSecondary)}>
                          {run.workflowName} #{run.runNumber} · {run.event} · {run.branch}
                        </p>
                      </div>
                    </div>
                    <div className={classNames("text-right text-xs", theme.textSecondary)}>
                      <p>{formatDuration(run.duration)}</p>
                      <p>{computeRelativeTimestamp(run.order, startTime)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
