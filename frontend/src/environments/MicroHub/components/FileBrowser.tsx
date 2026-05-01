import {
  GitBranch,
  ChevronDown,
  Check,
  Tag,
  Code,
  Copy,
  BookOpen,
  History,
  Verified,
  Link as LinkIcon,
  Star,
  Eye,
  GitFork,
  File,
  Package,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { classNames, computeRelativeTimestamp } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";
import { Avatar } from "./Avatar";
import { FileTreeItem } from "./FileTreeItem";

export const FileBrowser = () => {
  const { theme, darkMode } = useTheme();
  const {
    repository,
    commits,
    releases,
    packages,
    deployments,
    microhubUsers,
    fileTree,
    getUserByUsername,
    startTime,
  } = useMicrohubCtx();
  const {
    selectedBranch,
    setSelectedBranch,
    branchDropdownOpen,
    setBranchDropdownOpen,
    codeDropdownOpen,
    setCodeDropdownOpen,
    expandedReleases,
    setExpandedReleases,
    expandedDeployments,
    setExpandedDeployments,
    setRoute,
  } = useMicrohubUI();

  if (!repository) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className={classNames("flex items-center space-x-2 px-3 py-1.5 border rounded-md text-sm", theme.bgTertiary, theme.border, theme.hover)}
              >
                <GitBranch className="w-4 h-4" />
                <span>{selectedBranch}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {branchDropdownOpen && (
                <div className={classNames("absolute left-0 mt-2 w-64 border rounded-lg shadow-lg z-10", theme.bgSecondary, theme.border)}>
                  <div className={classNames("p-2 border-b", theme.border)}>
                    <input type="text" placeholder="Find a branch..." className={classNames("w-full px-3 py-1.5 border rounded-md text-sm", theme.inputBg, theme.border)} />
                  </div>
                  <div className="p-2">
                    <div className={classNames("text-xs mb-1", theme.textSecondary)}>Branches</div>
                    {repository.branches.map(branch => (
                      <button
                        key={branch}
                        onClick={() => { setSelectedBranch(branch); setBranchDropdownOpen(false); }}
                        className={classNames(
                          "w-full text-left px-3 py-1.5 rounded text-sm flex items-center",
                          theme.hover,
                          branch === selectedBranch && theme.bgTertiary
                        )}
                      >
                        {branch === selectedBranch && <Check className="w-4 h-4 mr-2 text-green-400" />}
                        <span className={branch !== selectedBranch ? "ml-6" : ""}>{branch}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span className={classNames("text-sm", theme.textSecondary)}>
              <GitBranch className="w-4 h-4 inline mr-1" />
              {repository.branches.length} branches
            </span>
            <span className={classNames("text-sm", theme.textSecondary)}>
              <Tag className="w-4 h-4 inline mr-1" />
              {repository.tags.length} tags
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                onClick={() => setCodeDropdownOpen(!codeDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-md text-sm text-white"
              >
                <Code className="w-4 h-4" />
                <span>Code</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {codeDropdownOpen && (
                <div className={classNames("absolute right-0 mt-2 w-80 border rounded-lg shadow-lg z-10", theme.bgSecondary, theme.border)}>
                  <div className="p-3">
                    <div className={classNames("text-xs mb-2", theme.textSecondary)}>Clone</div>
                    <div className="flex items-center">
                      <input
                        type="text"
                        readOnly
                        value={`https://microhub.dev/${repository.fullName}.git`}
                        className={classNames("flex-1 px-3 py-1.5 border rounded-l-md text-sm", theme.inputBg, theme.border)}
                      />
                      <button className={classNames("px-3 py-1.5 border border-l-0 rounded-r-md", theme.bgTertiary, theme.border, theme.hover)}>
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {commits.length > 0 && (
        <div className={classNames("flex items-center justify-between p-3 border rounded-t-md", theme.bgSecondary, theme.border)}>
          <div className="flex items-center space-x-3">
            <Avatar user={getUserByUsername(commits[0].author)} size="sm" />
            <span className="text-sm font-medium">{commits[0].author}</span>
            <span className={classNames("text-sm", theme.textSecondary)}>{commits[0].message}</span>
            {commits[0].verified && <Verified className="w-4 h-4 text-green-500" />}
          </div>
          <div className={classNames("flex items-center space-x-3 text-sm", theme.textSecondary)}>
            <span className="font-mono text-blue-400">{commits[0].sha}</span>
            <span>{computeRelativeTimestamp(commits[0].order, startTime)}</span>
            <button onClick={() => setRoute("commits")} className="flex items-center hover:text-blue-400">
              <History className="w-4 h-4 mr-1" />
              {repository.commits.toLocaleString()} commits
            </button>
          </div>
        </div>
        )}

        <div className={classNames("border border-t-0 rounded-b-md", theme.border)}>
          {fileTree.map(file => (
            <FileTreeItem key={file.id} file={file} />
          ))}
        </div>

        {/* README */}
        <div className={classNames("mt-6 border rounded-md", theme.border)}>
          <div className={classNames("px-4 py-3 border-b flex items-center justify-between", theme.bgSecondary, theme.border)}>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4" />
              <span className="font-medium">README.md</span>
            </div>
          </div>
          <div className={classNames("p-6 prose max-w-none", darkMode ? "prose-invert" : "")}>
            <h1 className="text-2xl font-bold mb-4">{repository.name}</h1>
            <p className={classNames("mb-4", theme.textSecondary)}>{repository.description}</p>
            <h2 className="text-xl font-semibold mt-6 mb-3">Features</h2>
            <ul className={classNames("list-disc list-inside space-y-2", theme.textSecondary)}>
              <li>Real-time Collaboration - Work together with your team</li>
              <li>Authentication - Secure OAuth-based authentication</li>
              <li>Plugin System - Extend functionality with custom plugins</li>
              <li>Dark Mode - System-aware theme with manual toggle</li>
              <li>Notifications - Real-time WebSocket notifications</li>
            </ul>
            <h2 className="text-xl font-semibold mt-6 mb-3">Quick Start</h2>
            <pre className={classNames("p-4 rounded-md text-sm overflow-x-auto", theme.codeBg)}>
              <code>{`npm install
npm run dev`}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-80 space-y-6">
        <div>
          <h3 className="font-semibold mb-3">About</h3>
          <p className={classNames("text-sm mb-3", theme.textSecondary)}>{repository.description}</p>
          {repository.websiteUrl && (
            <a href="#" className="flex items-center space-x-2 text-sm text-blue-400 hover:underline mb-3">
              <LinkIcon className="w-4 h-4" />
              <span>{repository.websiteUrl}</span>
            </a>
          )}
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {repository.topics.map(topic => (
                <span key={topic} className={classNames("px-2 py-1 text-xs rounded-full cursor-pointer", theme.topicBg)}>
                  {topic}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className={classNames("flex items-center space-x-2", theme.textSecondary)}>
              <BookOpen className="w-4 h-4" /><span>Readme</span>
            </div>
            <div className={classNames("flex items-center space-x-2", theme.textSecondary)}>
              <File className="w-4 h-4" /><span>{repository.license} license</span>
            </div>
            <div className={classNames("flex items-center space-x-2", theme.textSecondary)}>
              <Star className="w-4 h-4" /><span>{repository.stars.toLocaleString()} stars</span>
            </div>
            <div className={classNames("flex items-center space-x-2", theme.textSecondary)}>
              <Eye className="w-4 h-4" /><span>{repository.watchers} watching</span>
            </div>
            <div className={classNames("flex items-center space-x-2", theme.textSecondary)}>
              <GitFork className="w-4 h-4" /><span>{repository.forks} forks</span>
            </div>
          </div>
        </div>

        {/* Releases */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center justify-between">
            <span>Releases</span>
            <span className={classNames("text-xs px-2 py-0.5 rounded-full", theme.bgTertiary)}>{releases.length}</span>
          </h3>
          <div className="space-y-2">
            {(expandedReleases ? releases : releases.slice(0, 1)).map(release => (
              <div key={release.id} className={classNames("flex items-start space-x-2 cursor-pointer p-1 -m-1 rounded", theme.hover)} onClick={() => setExpandedReleases(!expandedReleases)}>
                <Tag className="w-4 h-4 text-green-500 mt-0.5" />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{release.tagName}</span>
                    {release.isLatest && <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">Latest</span>}
                  </div>
                  <span className={classNames("text-xs", theme.textSecondary)}>{computeRelativeTimestamp(release.order, startTime)}</span>
                </div>
              </div>
            ))}
            {!expandedReleases && releases.length > 1 && (
              <button onClick={() => setExpandedReleases(true)} className="text-sm text-blue-400 hover:underline">+ {releases.length - 1} releases</button>
            )}
            {expandedReleases && (
              <button onClick={() => setExpandedReleases(false)} className="text-sm text-blue-400 hover:underline">Show less</button>
            )}
          </div>
        </div>

        {/* Packages */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center justify-between">
            <span>Packages</span>
            <span className={classNames("text-xs px-2 py-0.5 rounded-full", theme.bgTertiary)}>{packages.length}</span>
          </h3>
          <div className="space-y-2">
            {packages.map(pkg => (
              <div key={pkg.id} className="flex items-center space-x-2 text-sm">
                <Package className={classNames("w-4 h-4", theme.textSecondary)} />
                <span>{pkg.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Deployments */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center justify-between">
            <span>Deployments</span>
            <span className={classNames("text-xs px-2 py-0.5 rounded-full", theme.bgTertiary)}>{deployments.length}</span>
          </h3>
          <div className="space-y-2">
            {(expandedDeployments ? deployments : deployments.slice(0, 2)).map(dep => (
              <div key={dep.id} className={classNames("flex items-center space-x-2 text-sm cursor-pointer p-1 -m-1 rounded", theme.hover)} onClick={() => setExpandedDeployments(!expandedDeployments)}>
                {dep.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-yellow-500" />
                )}
                <span>{dep.environment}</span>
                <span className={theme.textSecondary}>{computeRelativeTimestamp(dep.order, startTime)}</span>
              </div>
            ))}
            {!expandedDeployments && deployments.length > 2 && (
              <button onClick={() => setExpandedDeployments(true)} className="text-sm text-blue-400 hover:underline">+ {deployments.length - 2} deployments</button>
            )}
            {expandedDeployments && (
              <button onClick={() => setExpandedDeployments(false)} className="text-sm text-blue-400 hover:underline">Show less</button>
            )}
          </div>
        </div>

        {/* Contributors */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center justify-between">
            <span>Contributors</span>
            <span className={classNames("text-xs px-2 py-0.5 rounded-full", theme.bgTertiary)}>{microhubUsers.length}</span>
          </h3>
          <div className="flex flex-wrap gap-1">
            {microhubUsers.map(user => (
              <Avatar key={user.id} user={user} size="sm" showTooltip />
            ))}
          </div>
        </div>

        {/* Languages */}
        <div>
          <h3 className="font-semibold mb-3">Languages</h3>
          <div className="h-2 rounded-full overflow-hidden flex">
            {repository.languages.map((lang, i) => (
              <div key={i} style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-sm">
            {repository.languages.map(lang => (
              <span key={lang.name} className="flex items-center">
                <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: lang.color }} />
                {lang.name} {lang.percentage}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
