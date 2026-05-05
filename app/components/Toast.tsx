"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ToastMsg = { id: number; text: string; tone: "info" | "error" };

let push: ((text: string, tone?: "info" | "error") => void) | null = null;

export function toast(text: string, tone: "info" | "error" = "info") {
  push?.(text, tone);
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    push = (text, tone = "info") => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, text, tone }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((m) => m.id !== id));
      }, 2200);
    };
    return () => {
      push = null;
    };
  }, []);

  if (!mounted) return null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {items.map((m) => (
        <div
          key={m.id}
          className="fade-in"
          style={{
            background: m.tone === "error" ? "#7f1d1d" : "#1a1916",
            color: "#faf8f3",
            padding: "8px 14px",
            borderRadius: 6,
            fontSize: 13,
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          }}
        >
          {m.text}
        </div>
      ))}
    </div>,
    document.body
  );
}
