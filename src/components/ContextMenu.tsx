"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type ContextMenuItem = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
};

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: y, left: x });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;
    setPosition({ left: Math.min(x, Math.max(8, maxLeft)), top: Math.min(y, Math.max(8, maxTop)) });
  }, [x, y]);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ top: position.top, left: position.left }}
      className="fixed z-[3000] min-w-[210px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            onClose();
            item.onClick();
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
            item.danger ? "text-red-600" : "text-slate-700"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
