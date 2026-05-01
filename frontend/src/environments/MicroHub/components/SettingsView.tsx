import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Shield } from "lucide-react";
import { classNames } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";
import { Avatar } from "./Avatar";

interface RepoSettings {
  general: {
    name: string;
    description: string;
    visibility: string;
    features: Record<string, boolean>;
  };
  branches: {
    protectionRules: {
      id: string;
      pattern: string;
      requirePullRequest: boolean;
      requiredApprovals: number;
      requireStatusChecks: boolean;
      requiredChecks: string[];
      includeAdmins: boolean;
    }[];
  };
  collaborators: { userId: string; username: string; role: string }[];
}

export const SettingsView = () => {
  const { theme, darkMode, setDarkMode } = useTheme();
  const { settings, repository, updateRepo, getUserByUsername } = useMicrohubCtx();
  const { setRoute } = useMicrohubUI();

  const repoSettings = settings as RepoSettings | null;

  const [nameDraft, setNameDraft] = useState(repository?.name || "");
  const [descriptionDraft, setDescriptionDraft] = useState(repository?.description || "");
  const [visibilityDraft, setVisibilityDraft] = useState(repository?.visibility || "public");
  const [saving, setSaving] = useState(false);

  // Reset drafts when the underlying repository changes (e.g. user navigates
  // to a different repo). Before Phase 6 this component was inline and
  // remounted on every poll tick, so a `useEffect(() => ..., [])` fired every
  // second and effectively kept this in sync. After extraction it mounts once
  // per route change, so we depend on the actual fields it reads.
  useEffect(() => {
    setNameDraft(repository?.name || "");
    setDescriptionDraft(repository?.description || "");
    setVisibilityDraft(repository?.visibility || "public");
  }, [repository?.name, repository?.description, repository?.visibility]);

  const isDirty = nameDraft !== (repository?.name || "") || descriptionDraft !== (repository?.description || "") || visibilityDraft !== (repository?.visibility || "public");

  const handleSaveRepoSettings = async () => {
    setSaving(true);
    await updateRepo({ name: nameDraft, description: descriptionDraft, visibility: visibilityDraft });
    setSaving(false);
  };

  return (
    <div className={classNames("max-w-3xl mx-auto p-6", theme.text)}>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Appearance Section */}
        <div className={classNames("border rounded-lg", theme.border)}>
          <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
            <h2 className="font-semibold">Appearance</h2>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className={classNames("text-sm", theme.textSecondary)}>
                  Choose between light and dark mode
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setDarkMode(false)}
                  className={classNames(
                    "px-4 py-2 rounded-l-md text-sm font-medium border",
                    !darkMode
                      ? "bg-blue-600 text-white border-blue-600"
                      : classNames(theme.bgTertiary, theme.border, theme.text)
                  )}
                >
                  Light
                </button>
                <button
                  onClick={() => setDarkMode(true)}
                  className={classNames(
                    "px-4 py-2 rounded-r-md text-sm font-medium border -ml-px",
                    darkMode
                      ? "bg-blue-600 text-white border-blue-600"
                      : classNames(theme.bgTertiary, theme.border, theme.text)
                  )}
                >
                  Dark
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* General Settings */}
        {repoSettings && (
          <div className={classNames("border rounded-lg", theme.border)}>
            <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
              <h2 className="font-semibold">General</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Repository name</label>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
                />
              </div>
              <div>
                <label className={classNames("block text-sm font-medium mb-1", theme.textSecondary)}>Description</label>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={2}
                  className={classNames("w-full px-3 py-2 rounded-md border text-sm", theme.inputBg, theme.border)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Visibility</p>
                  <p className={classNames("text-sm", theme.textSecondary)}>
                    {visibilityDraft === "public" ? "Anyone can see this repository" : "Only collaborators can access"}
                  </p>
                </div>
                <select
                  value={visibilityDraft}
                  onChange={(e) => setVisibilityDraft(e.target.value === "private" ? "private" : "public")}
                  className={classNames("px-3 py-1 text-sm rounded-md border", theme.inputBg, theme.border)}
                >
                  <option value="public">public</option>
                  <option value="private">private</option>
                </select>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveRepoSettings}
                  disabled={!isDirty || saving}
                  className={classNames(
                    "px-4 py-2 text-sm font-medium rounded-md",
                    isDirty && !saving ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  )}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
              <div className="pt-4 border-t" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
                <p className="font-medium mb-2">Features</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(repoSettings.general.features).map(([feature, enabled]) => (
                    <div key={feature} className="flex items-center space-x-2">
                      {enabled ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-500" />}
                      <span className="text-sm capitalize">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branch Protection */}
        {repoSettings && repoSettings.branches.protectionRules.length > 0 && (
          <div className={classNames("border rounded-lg", theme.border)}>
            <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
              <h2 className="font-semibold">Branch protection rules</h2>
            </div>
            <div className="divide-y" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
              {repoSettings.branches.protectionRules.map(rule => (
                <div key={rule.id} className="p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Shield className="w-4 h-4 text-yellow-500" />
                    <span className="font-mono text-sm">{rule.pattern}</span>
                  </div>
                  <div className={classNames("text-sm space-y-1", theme.textSecondary)}>
                    {rule.requirePullRequest && <p>• Require pull request ({rule.requiredApprovals} approval{rule.requiredApprovals > 1 ? "s" : ""})</p>}
                    {rule.requireStatusChecks && <p>• Require status checks: {rule.requiredChecks.join(", ")}</p>}
                    {rule.includeAdmins && <p>• Include administrators</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collaborators */}
        {repoSettings && repoSettings.collaborators.length > 0 && (
          <div className={classNames("border rounded-lg", theme.border)}>
            <div className={classNames("px-4 py-3 border-b", theme.bgSecondary, theme.border)}>
              <h2 className="font-semibold">Collaborators</h2>
            </div>
            <div className="divide-y" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
              {repoSettings.collaborators.map(collab => {
                const user = getUserByUsername(collab.username);
                return (
                  <div key={collab.userId} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar user={user} size="sm" />
                      <span className="font-medium">{collab.username}</span>
                    </div>
                    <span className={classNames(
                      "px-2 py-1 text-xs rounded",
                      collab.role === "admin" ? "bg-red-900/30 text-red-400" :
                      collab.role === "write" ? "bg-green-900/30 text-green-400" :
                      "bg-gray-700/30 text-gray-400"
                    )}>
                      {collab.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => setRoute("code")}
        className="mt-6 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
      >
        Back to repository
      </button>
    </div>
  );
};
