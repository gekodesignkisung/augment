"use client";

import { cloneElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom" | "left" | "right";

type AnchorProps = {
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  ref?: React.Ref<HTMLElement>;
};

export default function Tooltip({
  content,
  placement = "top",
  children,
}: {
  content: string;
  placement?: Placement;
  children: React.ReactElement<AnchorProps>;
}) {
  const ref = useRef<HTMLElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    let top = 0;
    let left = 0;
    if (placement === "top") {
      top = r.top - margin;
      left = r.left + r.width / 2;
    } else if (placement === "bottom") {
      top = r.bottom + margin;
      left = r.left + r.width / 2;
    } else if (placement === "left") {
      top = r.top + r.height / 2;
      left = r.left - margin;
    } else {
      top = r.top + r.height / 2;
      left = r.right + margin;
    }
    setPos({ top, left });
  };

  const hide = () => setPos(null);

  const original = children.props;
  const withHandlers = cloneElement(children, {
    ref,
    onMouseEnter: (e: React.MouseEvent) => {
      show();
      original.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      original.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      show();
      original.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hide();
      original.onBlur?.(e);
    },
  });

  return (
    <>
      {withHandlers}
      {mounted && pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: transformFor(placement),
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className="tooltip-bubble"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

function transformFor(placement: Placement): string {
  switch (placement) {
    case "top":
      return "translate(-50%, -100%)";
    case "bottom":
      return "translate(-50%, 0)";
    case "left":
      return "translate(-100%, -50%)";
    case "right":
      return "translate(0, -50%)";
  }
}
