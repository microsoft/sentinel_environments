import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { ComponentType } from "react";

interface Variant {
  path: string;
  title: string;
  component: ComponentType;
}

interface VariantSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  taskIcon: string;
  variants: Variant[];
}

const VariantSelector = ({
  isOpen,
  onClose,
  taskTitle,
  taskIcon,
  variants
}: VariantSelectorProps) => {
  const navigate = useNavigate();
  const [isMaximized, setIsMaximized] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [windowPosition, setWindowPosition] = useState<{ x: number; y: number } | null>(null);
  const closeWindow = useCallback(() => {
    setIsMaximized(false);
    onClose();
  }, [onClose]);
  const getCenteredPosition = (width = 460, height = 320) => {
    const x = Math.max((window.innerWidth - width) / 2, 16);
    const y = Math.max((window.innerHeight - height) / 2, 32);
    return { x, y };
  };

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeWindow();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, closeWindow]);

  useEffect(() => {
    if (!isOpen) {
      setWindowPosition(null);
      setIsMaximized(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (
      isOpen &&
      !isMaximized &&
      windowPosition === null
    ) {
      const width = modalRef.current?.offsetWidth || 460;
      const height = modalRef.current?.offsetHeight || 320;
      setWindowPosition(getCenteredPosition(width, height));
    }
  }, [isOpen, isMaximized, windowPosition]);

  if (!isOpen) return null;

  const handleVariantSelect = (variantPath: string) => {
    navigate(variantPath.startsWith("/") ? variantPath : `/${variantPath}`);
    closeWindow();
  };

  // Handle click outside the modal
  const handleBackdropClick = () => {
    closeWindow();
  };

  const windowSizeClasses = isMaximized
    ? "w-[92vw] max-w-[960px] h-[70vh]"
    : "w-[min(460px,calc(100%-32px))]";
  const contentMaxHeight = isMaximized ? "calc(70vh - 110px)" : "auto";

  const toggleMaximize = () => setIsMaximized((prev) => !prev);

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMaximized) return;
    event.preventDefault();
    const initialPosition =
      windowPosition ||
      getCenteredPosition(
        modalRef.current?.offsetWidth,
        modalRef.current?.offsetHeight
      );
    const startX = event.clientX;
    const startY = event.clientY;
    const handleMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const width = modalRef.current?.offsetWidth || 460;
      const height = modalRef.current?.offsetHeight || 320;
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

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-[rgba(7,13,37,0.55)]"
        onClick={handleBackdropClick}
      />
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
            <span className="truncate max-w-[240px]">{taskTitle}</span>
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

        <div
          className="px-5 py-4 space-y-4 text-[#3b3b3b] overflow-y-auto"
          style={{ maxHeight: contentMaxHeight }}
        >
          <p className="text-sm">
            Choose the variant you want to launch:
          </p>
          <div className="space-y-3">
            {variants.map((variant) => (
              <button
                key={variant.path}
                onClick={() => handleVariantSelect(variant.path)}
                className="w-full flex items-center justify-between rounded border border-[#d4d4d4] bg-white/85 px-4 py-3 text-left hover:bg-[#ddecff] hover:border-[#94b8ff] transition"
              >
                <span className="font-semibold text-[#1b3e8b]">
                  {variant.title}
                </span>
                <span className="text-[#1b3e8b] text-lg">›</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 bg-white text-[12px] text-[#3b3b3b] border-t border-[#d8d8d8] rounded-b">
          Each variant tracks progress separately and may introduce new visuals,
          distractors, or adversarial twists.
        </div>
      </div>
    </div>
  );
};

export default VariantSelector;
