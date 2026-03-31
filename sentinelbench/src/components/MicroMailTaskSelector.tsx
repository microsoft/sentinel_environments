import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MICROMAIL_GRID_COLUMNS,
  MICROMAIL_TASK_TYPES,
  MICROMAIL_VARIANTS,
  getMicromailTaskLabel,
  getMicromailVariant,
  type MicromailVariantId,
} from "../config/micromailVariants";
import { DURATION } from "../config/constants";

interface MicroMailTaskSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle?: string;
  taskIcon?: string;
}

const DEFAULT_SELECTION: MicromailVariantId = "micromail-unread-absolute-passive";

const MicroMailTaskSelector = ({
  isOpen,
  onClose,
  taskTitle = "MicroMail",
  taskIcon = "📧",
}: MicroMailTaskSelectorProps) => {
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowPosition, setWindowPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<MicromailVariantId>(DEFAULT_SELECTION);
  const [durationInput, setDurationInput] = useState<string>(String(DURATION.DEFAULT));

  const closeWindow = useCallback(() => {
    setIsMaximized(false);
    onClose();
  }, [onClose]);

  const getCenteredPosition = (width = 760, height = 520) => {
    const x = Math.max((window.innerWidth - width) / 2, 16);
    const y = Math.max((window.innerHeight - height) / 2, 32);
    return { x, y };
  };

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeWindow();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, closeWindow]);

  useEffect(() => {
    if (!isOpen) {
      setWindowPosition(null);
      setIsMaximized(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isMaximized && windowPosition === null) {
      const width = modalRef.current?.offsetWidth || 760;
      const height = modalRef.current?.offsetHeight || 520;
      setWindowPosition(getCenteredPosition(width, height));
    }
  }, [isOpen, isMaximized, windowPosition]);

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMaximized) return;
    event.preventDefault();
    const initialPosition =
      windowPosition ||
      getCenteredPosition(modalRef.current?.offsetWidth, modalRef.current?.offsetHeight);
    const startX = event.clientX;
    const startY = event.clientY;
    const handleMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const width = modalRef.current?.offsetWidth || 760;
      const height = modalRef.current?.offsetHeight || 520;
      const maxX = window.innerWidth - width - 8;
      const maxY = window.innerHeight - height - 8;
      setWindowPosition({
        x: Math.min(Math.max(8, initialPosition.x + deltaX), maxX),
        y: Math.min(Math.max(24, initialPosition.y + deltaY), maxY),
      });
    };
    const stopDrag = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", stopDrag);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", stopDrag);
  };

  const toggleMaximize = () => setIsMaximized((prev) => !prev);

  const durationValue = useMemo(() => {
    const parsed = Number.parseInt(durationInput, 10);
    if (Number.isNaN(parsed)) return DURATION.DEFAULT;
    return Math.min(Math.max(DURATION.MIN, parsed), DURATION.MAX_DAY);
  }, [durationInput]);

  const micromailVariantById = useMemo(
    () => new Map<MicromailVariantId, (typeof MICROMAIL_VARIANTS)[number]>(MICROMAIL_VARIANTS.map((v) => [v.id, v])),
    []
  );

  const selectedVariant = useMemo(() => micromailVariantById.get(selectedVariantId) ?? null, [
    micromailVariantById,
    selectedVariantId,
  ]);

  const buildLaunchPath = useCallback(
    (variantId: MicromailVariantId) => {
      const variant = micromailVariantById.get(variantId);
      const urlTemplate = variant?.url ?? "";
      const basePath = urlTemplate.replace("{base_url}", "");
      const separator = basePath.includes("?") ? "&" : "?";
      return `${basePath}${separator}duration=${durationValue}`;
    },
    [durationValue, micromailVariantById]
  );

  const launchVariant = useCallback(
    (variantId: MicromailVariantId) => {
      const launchPath = buildLaunchPath(variantId);
      if (!launchPath) return;
      navigate(launchPath);
      closeWindow();
    },
    [buildLaunchPath, closeWindow, navigate]
  );

  if (!isOpen) return null;

  const windowSizeClasses = isMaximized
    ? "w-[92vw] max-w-[1100px] h-[78vh]"
    : "w-[min(760px,calc(100%-32px))]";

  const contentMaxHeight = isMaximized ? "calc(78vh - 110px)" : "auto";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgba(7,13,37,0.55)]" onClick={closeWindow} />
      <div
        ref={modalRef}
        className={`absolute ${windowSizeClasses} bg-[#f5f2e9] border-2 border-[#0046ad] rounded-md shadow-2xl font-[Tahoma] text-sm flex flex-col`}
        style={
          isMaximized
            ? { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
            : windowPosition
              ? { left: windowPosition.x, top: windowPosition.y }
              : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
        }
      >
        <div
          className="bg-gradient-to-r from-[#0a5ad4] to-[#0f7df5] text-white flex items-center justify-between px-4 py-2 rounded-t select-none"
          onDoubleClick={toggleMaximize}
          onMouseDown={startDrag}
          style={{ cursor: isMaximized ? "default" : "move" }}
        >
          <div className="flex items-center gap-2 font-semibold">
            <span>{taskIcon}</span>
            <span className="truncate max-w-[360px]">{taskTitle}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={closeWindow}
              className="w-5 h-5 flex items-center justify-center bg-[#0d63de] border border-white/40 text-white font-bold"
              aria-label="Minimize"
            >
              _
            </button>
            <button
              onClick={toggleMaximize}
              className="w-5 h-5 flex items-center justify-center bg-[#0d63de] border border-white/40 text-white font-bold"
              aria-label={isMaximized ? "Restore" : "Maximize"}
            >
              □
            </button>
            <button
              onClick={closeWindow}
              className="w-5 h-5 flex items-center justify-center bg-[#cf1b1b] border border-white/40 text-white font-bold"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 text-[#3b3b3b] overflow-y-auto" style={{ maxHeight: contentMaxHeight }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm">
              Single-click to select a variant; double-click to launch.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-[#1b3e8b]">Duration (sec)</span>
              <input
                type="number"
                inputMode="numeric"
                min={DURATION.MIN}
                max={DURATION.MAX_DAY}
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                className="w-28 px-2 py-1 bg-white border border-[#7b9bd6] shadow-[inset_1px_1px_0_rgba(0,0,0,0.15)] focus:outline-none focus:ring-2 focus:ring-[#7aa7ff]"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-28 text-left text-xs font-semibold text-[#1b3e8b] pb-2" />
                  {MICROMAIL_GRID_COLUMNS.map((column) => (
                    <th
                      key={`${column.criteria}-${column.activity}`}
                      className="text-center text-xs font-semibold text-[#1b3e8b] pb-2"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MICROMAIL_TASK_TYPES.map((task) => (
                  <tr key={task}>
                    <td className="pr-3 py-2 text-xs font-semibold text-[#1b3e8b] whitespace-nowrap">
                      {getMicromailTaskLabel(task)}
                    </td>
                    {MICROMAIL_GRID_COLUMNS.map((column) => {
                      const variant = getMicromailVariant(task, column.criteria, column.activity);
                      const isSelected = selectedVariantId === variant.id;
                      return (
                        <td key={variant.id} className="p-1">
                          <button
                            onClick={() => setSelectedVariantId(variant.id)}
                            onDoubleClick={() => launchVariant(variant.id)}
                            className={`w-full rounded border px-3 py-2 text-left transition select-none ${
                              isSelected
                                ? "bg-[#ddecff] border-[#94b8ff]"
                                : "bg-white/85 border-[#d4d4d4] hover:bg-[#eef6ff] hover:border-[#a9c6ff]"
                            }`}
                          >
                            <div className="text-xs font-semibold text-[#1b3e8b]">
                              {isSelected ? "► " : ""}
                              {task.charAt(0).toUpperCase() + task.slice(1)}
                            </div>
                            <div className="text-[11px] text-[#3b3b3b]">
                              {column.criteria === "absolute" ? "Abs" : "Rel"} ·{" "}
                              {column.activity === "active" ? "Act" : "Pass"}
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedVariant && (
            <div className="rounded border border-[#d4d4d4] bg-white/85 px-4 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-[#1b3e8b]">{selectedVariant.title}</div>
                  <div className="text-[12px] text-[#3b3b3b]">{selectedVariant.description}</div>
                </div>
                <button
                  onClick={() => launchVariant(selectedVariant.id)}
                  className="px-4 py-2 rounded bg-gradient-to-b from-[#fefefe] to-[#d6d6d6] border border-[#7f7f7f] shadow-[inset_1px_1px_0_rgba(255,255,255,0.75)] text-sm font-semibold text-[#1b3e8b] hover:from-[#ffffff] hover:to-[#cfcfcf]"
                >
                  Launch
                </button>
              </div>
              <div className="mt-2 text-[11px] text-[#3b3b3b]">
                Launches with duration <span className="font-mono">{durationValue}</span>s at{" "}
                <span className="font-mono">{buildLaunchPath(selectedVariant.id)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-white text-[12px] text-[#3b3b3b] border-t border-[#d8d8d8] rounded-b">
          Tip: Duration is clamped to {DURATION.MIN}–{DURATION.MAX_DAY} seconds.
        </div>
      </div>
    </div>
  );
};

export default MicroMailTaskSelector;
