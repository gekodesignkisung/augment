"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, ConvNode } from "@/lib/types";

type LaidOut = {
  id: string;
  x: number;
  y: number;
  node: ConvNode;
  parentId: string | null;
};

const NODE_W = 18;
const NODE_GAP_X = 28;
const LEVEL_GAP_Y = 70;

// Tidy tree layout (a simplified Reingold-Tilford)
function layout(conv: Conversation): { nodes: LaidOut[]; width: number; height: number } {
  const root = conv.nodes[conv.rootId];
  if (!root) return { nodes: [], width: 0, height: 0 };

  // Subtree widths in number of leaves
  const widths = new Map<string, number>();
  function computeWidth(id: string): number {
    const n = conv.nodes[id];
    if (!n || n.children.length === 0) {
      widths.set(id, 1);
      return 1;
    }
    const sum = n.children.reduce((s, c) => s + computeWidth(c), 0);
    widths.set(id, sum);
    return sum;
  }
  computeWidth(conv.rootId);

  // x is in "slots", we'll multiply later
  const out: LaidOut[] = [];
  function place(id: string, depth: number, slotStart: number) {
    const n = conv.nodes[id];
    if (!n) return;
    const w = widths.get(id) ?? 1;
    const center = slotStart + w / 2;
    out.push({ id, x: center, y: depth, node: n, parentId: n.parentId });
    let cursor = slotStart;
    for (const c of n.children) {
      const cw = widths.get(c) ?? 1;
      place(c, depth + 1, cursor);
      cursor += cw;
    }
  }
  place(conv.rootId, 0, 0);

  // Skip the synthetic root (no kind for root note) — we still keep coord but won't render visible if empty
  const totalSlots = widths.get(conv.rootId) ?? 1;
  const width = totalSlots * NODE_GAP_X + 80;
  const maxDepth = out.reduce((m, p) => Math.max(m, p.y), 0);
  const height = (maxDepth + 1) * LEVEL_GAP_Y + 80;

  // Convert slot units to pixels, center
  const ox = 40;
  const oy = 40;
  const px = (slot: number) => ox + slot * NODE_GAP_X;
  const py = (depth: number) => oy + depth * LEVEL_GAP_Y;

  return {
    nodes: out.map((p) => ({ ...p, x: px(p.x), y: py(p.y) })),
    width,
    height,
  };
}

export default function GraphPane({
  conv,
  selectedId,
  onJump,
  onClose,
}: {
  conv: Conversation;
  selectedId: string | null;
  onJump: (nodeId: string) => void;
  onClose: () => void;
}) {
  const { nodes, width, height } = useMemo(() => layout(conv), [conv]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  // Highlight ancestors of hovered/selected node
  const highlightSet = useMemo(() => {
    const set = new Set<string>();
    let cur: string | null = hoverId ?? selectedId;
    while (cur) {
      set.add(cur);
      const n = byId.get(cur);
      cur = n?.parentId ?? null;
    }
    return set;
  }, [hoverId, selectedId, byId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => Math.min(2.5, Math.max(0.4, z + delta)));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
  };
  const onMouseUp = () => {
    dragging.current = null;
  };

  return (
    <div className="absolute inset-0 z-30 bg-[var(--bg)] flex flex-col fade-in">
      <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center justify-between px-6">
        <div className="text-[15px] font-medium">사고 그래프</div>
        <div className="flex items-center gap-3 text-[13px] text-[var(--text-muted)]">
          <span>휠: 확대 · 드래그: 이동 · 클릭: 점프</span>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          >
            초기화
          </button>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          >
            닫기 (Esc)
          </button>
        </div>
      </header>

      <div
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          <svg width={width} height={height} style={{ display: "block" }}>
            {/* Edges (parent → child) */}
            {nodes.map((n) => {
              if (!n.parentId) return null;
              const p = byId.get(n.parentId);
              if (!p) return null;
              const isHl = highlightSet.has(n.id) && highlightSet.has(n.parentId);
              return (
                <path
                  key={`e-${n.id}`}
                  d={`M ${p.x} ${p.y} C ${p.x} ${(p.y + n.y) / 2}, ${n.x} ${(p.y + n.y) / 2}, ${n.x} ${n.y}`}
                  stroke={isHl ? "var(--accent)" : "var(--border-strong)"}
                  strokeWidth={isHl ? 1.5 : 1}
                  fill="none"
                  opacity={isHl ? 1 : 0.5}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((n) => {
              const isRoot = n.parentId === null;
              if (isRoot) return null; // hide synthetic root
              const isSelected = selectedId === n.id;
              const isHover = hoverId === n.id;
              const isHl = highlightSet.has(n.id);
              const baseR =
                n.node.kind === "user" ? 4 : n.node.kind === "assistant" ? 5 : 4;
              const r = isSelected || isHover ? baseR + 2 : baseR;
              const fill =
                n.node.kind === "user"
                  ? "var(--user)"
                  : n.node.kind === "assistant"
                    ? "var(--assistant)"
                    : "var(--note)";
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  onMouseEnter={() => setHoverId(n.id)}
                  onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
                  onClick={(e) => {
                    e.stopPropagation();
                    onJump(n.id);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    r={r + 4}
                    fill={isHl || isHover ? "var(--accent-soft)" : "transparent"}
                  />
                  <circle
                    r={r}
                    fill={fill}
                    stroke={n.node.promoted ? "var(--accent)" : "transparent"}
                    strokeWidth={n.node.promoted ? 2 : 0}
                  />
                  {n.node.pinned && (
                    <text
                      x={r + 4}
                      y={-r - 2}
                      fontSize="10"
                      fill="var(--text-muted)"
                    >
                      📌
                    </text>
                  )}
                  {n.node.memo && (
                    <text
                      x={-r - 10}
                      y={-r - 2}
                      fontSize="10"
                      fill="var(--note)"
                    >
                      ✎
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover preview card */}
        {hoverId && (() => {
          const n = byId.get(hoverId);
          if (!n) return null;
          const left = Math.min(
            window.innerWidth - 320,
            n.x * zoom + pan.x + 14
          );
          const top = Math.max(70, n.y * zoom + pan.y + 14);
          return (
            <div
              className="absolute pointer-events-none z-40 max-w-[300px] bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-md p-3 shadow-lg fade-in"
              style={{ left, top }}
            >
              <div className="flex items-center gap-2 text-[11px] mb-1">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    background:
                      n.node.kind === "user" ? "var(--user)" : "var(--assistant)",
                  }}
                />
                <span className="text-[var(--text-muted)] font-medium">
                  {n.node.kind === "user" ? "당신" : "Augment"}
                </span>
                <span className="text-[var(--accent)] font-mono">#{n.id}</span>
                {n.node.promoted && <span className="text-[var(--accent)]">★</span>}
                {n.node.pinned && <span>📌</span>}
                {n.node.memo && <span className="text-[var(--note)]">✎</span>}
              </div>
              <div className="text-[13px] text-[var(--text)] leading-snug line-clamp-4">
                {n.node.text || "(빈 노드)"}
              </div>
              {n.node.tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {n.node.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]"
                    >
                      <span className="text-[var(--accent)]">#</span>
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              {n.node.memo && (
                <div className="mt-2 text-[12px] text-[var(--note)] italic border-l-2 border-[var(--note)] pl-2">
                  {n.node.memo}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
