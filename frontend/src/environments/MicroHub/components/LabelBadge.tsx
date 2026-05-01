import { memo } from "react";
import type { ApiLabel } from "../../../hooks/useMicrohubData";

interface LabelBadgeProps {
  label: ApiLabel;
}

const LabelBadgeImpl = ({ label }: LabelBadgeProps) => (
  <span
    className="px-2 py-0.5 rounded-full text-xs font-medium"
    style={{
      backgroundColor: label.color + "20",
      color: label.color === "#ffffff" ? "#24292f" : label.color,
      border: label.color === "#ffffff" ? "1px solid #d0d7de" : "none",
    }}
  >
    {label.name}
  </span>
);

// Module-scope + React.memo: `label` comes from the parent's static `labels`
// state (loaded once in useMicrohubData, never re-fetched), so the same
// object refs are passed across poll ticks and the shallow-compare actually
// skips work in steady state.
export const LabelBadge = memo(LabelBadgeImpl);
