"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Conversation, ConvNode } from "@/lib/types";

export default function JumpPalette({
  open,
  conv,
  onClose,
  onJump,
}: {
  open: boolean;
  conv: Conversation | null;
  onClose: () => void;
  onJump: (nodeId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo<ConvNode[]>(() => {
    if (!conv) return [];
    const all = Object.values(conv.nodes).filter(
      (n) => n.kind === "user" || n.kind === "assistant"
    );
    const q = query.trim().replace(/^#/, "").toLowerCase();
    if (!q) {
      return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
    }
    const tagQ = q.startsWith("#") ? q.slice(1) : q;
    const matched = all.filter(
      (n) =>
        n.id.toLowerCase().includes(q) ||
        n.text.toLowerCase().includes(q) ||
        (n.memo ?? "").toLowerCase().includes(q) ||
        (n.tags ?? []).some((t) => t.toLowerCase().includes(tagQ))
    );
    return matched.sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  }, [conv, query]);

  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [items, active]);

  if (!mounted || !open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // direct ID input wins
      const direct = query.trim().replace(/^#/, "");
      if (direct && conv?.nodes[direct]) {
        onJump(direct);
        onClose();
        return;
      }
      const it = items[active];
      if (it) {
        onJump(it.id);
        onClose();
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[560px] max-w-[90vw] bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-lg shadow-2xl overflow-hidden fade-in">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="노드 ID(#abc12345) 또는 키워드를 입력해 점프…"
            className="w-full bg-transparent text-[15px] text-[var(--text)] placeholder:text-[var(--text-dim)] outline-none"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {!conv && (
            <div className="px-4 py-6 text-[14px] text-[var(--text-muted)]">
              먼저 대화를 선택하거나 시작하세요.
            </div>
          )}
          {conv && items.length === 0 && (
            <div className="px-4 py-6 text-[14px] text-[var(--text-muted)]">
              일치하는 노드가 없습니다.
            </div>
          )}
          {items.map((n, i) => (
            <button
              key={n.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                onJump(n.id);
                onClose();
              }}
              className={`w-full text-left px-4 py-2.5 flex items-start gap-3 ${
                i === active ? "bg-[var(--bg-hover)]" : "hover:bg-[var(--bg-hover)]"
              }`}
            >
              <span
                className="shrink-0 mt-1.5 inline-block w-2 h-2 rounded-full"
                style={{
                  background:
                    n.kind === "user" ? "var(--user)" : "var(--assistant)",
                }}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] text-[var(--text)] truncate leading-snug">
                  {n.pinned && <span className="mr-1">📌</span>}
                  {n.promoted && <span className="text-[var(--accent)] mr-1">★</span>}
                  {n.memo && <span className="text-[var(--note)] mr-1">✎</span>}
                  {n.text.slice(0, 100) || "(빈 노드)"}
                </span>
                {n.memo && (
                  <span className="block text-[12px] text-[var(--note)] truncate italic">
                    메모: {n.memo}
                  </span>
                )}
                <span className="text-[11px] text-[var(--accent)] font-mono">
                  #{n.id} · {n.kind === "user" ? "당신" : "Augment"}
                  {n.tags?.length ? (
                    <span className="ml-2 text-[var(--text-muted)]">
                      {n.tags.map((t) => `#${t}`).join(" ")}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] flex justify-between">
          <span>↑↓ 선택 · Enter 점프 · Esc 닫기</span>
          <span className="text-[var(--text-dim)]">⌘K 로 다시 열기</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
