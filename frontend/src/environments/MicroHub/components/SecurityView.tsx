import { AlertTriangle, ShieldAlert } from "lucide-react";
import { classNames } from "../utils";
import { useTheme, useMicrohubCtx, useMicrohubUI } from "../contexts";

export const SecurityView = () => {
  const { theme, darkMode } = useTheme();
  const { security, codeScanning } = useMicrohubCtx();
  const { securityActiveTab, setSecurityActiveTab } = useMicrohubUI();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-900/30 text-red-400 border-red-500";
      case "high": return "bg-orange-900/30 text-orange-400 border-orange-500";
      case "error": return "bg-red-900/30 text-red-400 border-red-500";
      case "moderate": return "bg-yellow-900/30 text-yellow-400 border-yellow-500";
      case "warning": return "bg-yellow-900/30 text-yellow-400 border-yellow-500";
      case "low": return "bg-blue-900/30 text-blue-400 border-blue-500";
      case "note": return "bg-gray-700/30 text-gray-400 border-gray-500";
      default: return "bg-gray-700/30 text-gray-400 border-gray-500";
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case "open": return "text-yellow-500";
      case "fixed": return "text-green-500";
      case "dismissed": return "text-gray-500";
      default: return "text-gray-500";
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Security Overview</h2>

      {/* Tabs */}
      <div className={classNames("flex space-x-1 border-b mb-4", theme.border)}>
        <button
          onClick={() => setSecurityActiveTab("advisories")}
          className={classNames(
            "px-4 py-2 text-sm font-medium",
            securityActiveTab === "advisories" ? "border-b-2 border-orange-500" : theme.textSecondary
          )}
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Dependabot alerts</span>
            <span className={classNames("px-1.5 py-0.5 text-xs rounded", theme.badge)}>
              {security.filter(a => a.state === "open").length}
            </span>
          </div>
        </button>
        <button
          onClick={() => setSecurityActiveTab("code-scanning")}
          className={classNames(
            "px-4 py-2 text-sm font-medium",
            securityActiveTab === "code-scanning" ? "border-b-2 border-orange-500" : theme.textSecondary
          )}
        >
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Code scanning</span>
            <span className={classNames("px-1.5 py-0.5 text-xs rounded", theme.badge)}>
              {codeScanning.filter(a => a.state === "open").length}
            </span>
          </div>
        </button>
      </div>

      {/* Content */}
      <div className={classNames("border rounded-lg", theme.border)}>
        {securityActiveTab === "advisories" && (
          <div className="divide-y" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
            {security.map(advisory => (
              <div key={advisory.id} className={classNames("p-4", theme.hover)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={classNames("px-2 py-0.5 text-xs font-medium rounded border", getSeverityColor(advisory.severity))}>
                        {advisory.severity}
                      </span>
                      <span className={classNames("text-xs", getStateColor(advisory.state))}>{advisory.state}</span>
                    </div>
                    <h3 className="font-medium">{advisory.title}</h3>
                    <p className={classNames("text-sm mt-1", theme.textSecondary)}>{advisory.description}</p>
                    <div className={classNames("flex items-center space-x-4 mt-2 text-xs", theme.textSecondary)}>
                      <span><strong>Package:</strong> {advisory.package}</span>
                      <span><strong>Vulnerable:</strong> {advisory.vulnerableVersions}</span>
                      <span><strong>Patched:</strong> {advisory.patchedVersions}</span>
                      {advisory.cveId && <span className="font-mono">{advisory.cveId}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {securityActiveTab === "code-scanning" && (
          <div className="divide-y" style={{ borderColor: darkMode ? "#374151" : "#e5e7eb" }}>
            {codeScanning.map(alert => (
              <div key={alert.id} className={classNames("p-4", theme.hover)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={classNames("px-2 py-0.5 text-xs font-medium rounded border", getSeverityColor(alert.severity))}>
                        {alert.severity}
                      </span>
                      <span className={classNames("text-xs", getStateColor(alert.state))}>{alert.state}</span>
                      <span className={classNames("text-xs font-mono", theme.textSecondary)}>{alert.rule}</span>
                    </div>
                    <h3 className="font-medium">{alert.description}</h3>
                    <p className={classNames("text-sm mt-1 font-mono", theme.textSecondary)}>
                      {alert.file}:{alert.line}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
