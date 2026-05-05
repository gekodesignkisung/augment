"use client";

import type { Conversation, ConvNode } from "@/lib/types";
import { useMemo } from "react";

export default function TreePane({
  conv,
  activePathTo,
  selectedId,
  onSelect,
}: {
  conv: Conversation;
  activePathTo: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const activePath = useMemo(() => {
    const set = new Set<string>();
    let cur: string | null = activePathTo;
    while (cur) {
      set.add(cur);
      const n: ConvNode | undefined = conv.nodes[cur];
      cur = n?.parentId ?? null;
    }
    return set;
  }, [conv, activePathTo]);

  return (
    <div className="text-[13px]">
      {renderNode(conv.rootId, 0)}
    </div>
  );

  function renderNode(id: string, depth: number) {
    const n = conv.nodes[id];
    if (!n) return null;
    const isRoot = n.parentId === null;
    const isSelected = selectedId === id;
    const isOnActive = activePath.has(id);

    const label = nodeLabel(n);
    return (
      <div key={id}>
        {!isRoot && (
          <button
            onClick={() => onSelect(id)}
            className={`w-full text-left rounded px-2 py-1.5 my-[1px] flex items-start gap-2 transition-colors ${
              isSelected
                ? "bg-[var(--accent-soft)] text-[var(--text)]"
                : isOnActive
                  ? "text-[var(--text)] bg-[var(--bg-card)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
            }`}
            style={{ paddingLeft: `${0.5 + (depth - 1) * 0.85}rem` }}
          >
            <span
              className="shrink-0 mt-[7px] inline-block w-2 h-2 rounded-full"
              style={{ background: kindColor(n.kind), opacity: n.promoted ? 1 : 0.7 }}
            />
            <span className="flex-1 truncate leading-snug">
              {n.promoted && <span className="text-[var(--accent)] mr-1">★</span>}
              {n.memo && (
                <span
                  className="text-[var(--note)] mr-1"
                  title="메모 있음"
                >
                  ✎
                </span>
              )}
              {label}
            </span>
          </button>
        )}
        {n.children.map((cid) => renderNode(cid, depth + 1))}
      </div>
    );
  }
}

function nodeLabel(n: ConvNode): string {
  const t = n.text.trim();
  if (!t) return n.kind === "user" ? "(빈 질문)" : "(빈 응답)";
  return t.length > 60 ? t.slice(0, 60) + "…" : t;
}

function kindColor(kind: string): string {
  if (kind === "user") return "var(--user)";
  if (kind === "assistant") return "var(--assistant)";
  return "var(--note)";
}
