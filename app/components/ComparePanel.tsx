"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Conversation, ConvNode } from "@/lib/types";

type Ref = { conversationId: string; nodeId: string; node: ConvNode; convTitle: string };

export default function ComparePanel({
  open,
  conv,
  initialNodeId,
  onClose,
}: {
  open: boolean;
  conv: Conversation | null;
  initialNodeId: string | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [a, setA] = useState<Ref | null>(null);
  const [b, setB] = useState<Ref | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<"a" | "b" | null>(null);

  useEffect(() => setMounted(true), []);

  // initialize A from passed nodeId
  useEffect(() => {
    if (open && conv && initialNodeId && conv.nodes[initialNodeId]) {
      setA({
        conversationId: conv.id,
        nodeId: initialNodeId,
        node: conv.nodes[initialNodeId],
        convTitle: conv.title,
      });
      setB(null);
      setResult(null);
      setPickerFor("b");
    }
  }, [open, conv, initialNodeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pickerFor) setPickerFor(null);
        else onClose();
      }
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pickerFor, onClose]);

  const runCompare = async () => {
    if (!a || !b) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refs: [
            { conversationId: a.conversationId, nodeId: a.nodeId },
            { conversationId: b.conversationId, nodeId: b.nodeId },
          ],
        }),
      });
      const data = await r.json();
      setResult(data.result ?? data.error ?? "오류");
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh]">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="relative w-[720px] max-w-[92vw] max-h-[84vh] bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-lg shadow-2xl overflow-hidden flex flex-col fade-in">
        <header className="shrink-0 px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="text-[15px] font-medium">두 노드 비교</div>
          <button
            onClick={onClose}
            className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            닫기 (Esc)
          </button>
        </header>

        <div className="shrink-0 px-5 py-4 grid grid-cols-2 gap-3 border-b border-[var(--border)]">
          <NodeSlot label="A" ref_={a} onPick={() => setPickerFor("a")} onClear={() => setA(null)} />
          <NodeSlot label="B" ref_={b} onPick={() => setPickerFor("b")} onClear={() => setB(null)} />
        </div>

        <div className="shrink-0 px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="text-[12px] text-[var(--text-muted)]">
            두 답의 공통점·차이·빠진 시각을 함께 봅니다.
          </div>
          <button
            onClick={runCompare}
            disabled={!a || !b || busy}
            className="px-3.5 py-1.5 bg-[var(--text)] text-[var(--bg)] rounded-md text-[13px] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
          >
            {busy ? "분석 중…" : "비교 실행"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {busy ? (
            <div className="flex items-center gap-2 text-[14px] text-[var(--text-muted)]">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
              두 답을 함께 읽는 중…
            </div>
          ) : result ? (
            <div className="text-[15px] text-[var(--text)] whitespace-pre-wrap leading-[1.7] fade-in">
              {result}
            </div>
          ) : (
            <div className="text-[14px] text-[var(--text-muted)] leading-relaxed">
              A, B 두 노드를 고르고 <em>비교 실행</em>을 눌러주세요.
              <br />
              <br />
              비교는 분기로 갈라진 두 답을 다시 합쳐 사고하기 위한 도구입니다.
              하나의 정답이 아니라 두 시각의 *공통 영역*과 *블라인드 스폿*을 함께 봅니다.
            </div>
          )}
        </div>

        {pickerFor && (
          <NodePicker
            conv={conv}
            excludeId={pickerFor === "a" ? b?.nodeId : a?.nodeId}
            onClose={() => setPickerFor(null)}
            onPick={(ref) => {
              if (pickerFor === "a") setA(ref);
              else setB(ref);
              setPickerFor(null);
              setResult(null);
            }}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

function NodeSlot({
  label,
  ref_,
  onPick,
  onClear,
}: {
  label: string;
  ref_: Ref | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="border border-[var(--border)] rounded-md p-3 min-h-[88px] flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] uppercase tracking-wider text-[var(--accent)] font-medium">
          노드 {label}
        </div>
        {ref_ && (
          <button
            onClick={onClear}
            className="text-[11px] text-[var(--text-dim)] hover:text-[var(--accent)]"
          >
            지우기
          </button>
        )}
      </div>
      {ref_ ? (
        <button
          onClick={onPick}
          className="text-left flex-1 hover:opacity-80"
        >
          <div className="text-[13px] text-[var(--text)] line-clamp-3 leading-snug">
            {ref_.node.text.slice(0, 200) || "(빈 노드)"}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
            #{ref_.nodeId} · {ref_.convTitle}
          </div>
        </button>
      ) : (
        <button
          onClick={onPick}
          className="flex-1 text-[13px] text-[var(--text-muted)] hover:text-[var(--accent)] text-left"
        >
          + 노드 고르기
        </button>
      )}
    </div>
  );
}

function NodePicker({
  conv,
  excludeId,
  onClose,
  onPick,
}: {
  conv: Conversation | null;
  excludeId?: string;
  onClose: () => void;
  onPick: (ref: Ref) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scope, setScope] = useState<"current" | "all">("current");
  const [allNodes, setAllNodes] = useState<
    { conversationId: string; conversationTitle: string; node: ConvNode }[]
  >([]);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (scope === "all") {
      // Pull a broad set: pinned + tags listing returns nodes; we fetch all conversations directly
      fetch("/api/conversations")
        .then((r) => r.json())
        .then(async (list: { id: string; title: string }[]) => {
          const aggregate: typeof allNodes = [];
          for (const item of list) {
            const r = await fetch(`/api/conversations/${item.id}`);
            if (!r.ok) continue;
            const c: Conversation = await r.json();
            for (const n of Object.values(c.nodes)) {
              if (n.kind === "user" || n.kind === "assistant") {
                aggregate.push({
                  conversationId: c.id,
                  conversationTitle: c.title,
                  node: n,
                });
              }
            }
          }
          aggregate.sort((a, b) => b.node.createdAt - a.node.createdAt);
          setAllNodes(aggregate);
        })
        .catch(() => {});
    }
  }, [scope]);

  const items = useMemo(() => {
    const pool =
      scope === "current"
        ? conv
          ? Object.values(conv.nodes)
              .filter((n) => n.kind === "user" || n.kind === "assistant")
              .map((n) => ({
                conversationId: conv.id,
                conversationTitle: conv.title,
                node: n,
              }))
          : []
        : allNodes;

    const q = query.trim().replace(/^#/, "").toLowerCase();
    let filtered = pool.filter((it) => it.node.id !== excludeId);
    if (q) {
      filtered = filtered.filter(
        (it) =>
          it.node.id.toLowerCase().includes(q) ||
          it.node.text.toLowerCase().includes(q) ||
          (it.node.memo ?? "").toLowerCase().includes(q) ||
          (it.node.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return filtered.sort((a, b) => b.node.createdAt - a.node.createdAt).slice(0, 40);
  }, [scope, conv, allNodes, query, excludeId]);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[560px] max-w-[90vw] bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-lg shadow-2xl overflow-hidden flex flex-col fade-in">
        <div className="shrink-0 px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const it = items[active];
                if (it) {
                  onPick({
                    conversationId: it.conversationId,
                    nodeId: it.node.id,
                    node: it.node,
                    convTitle: it.conversationTitle,
                  });
                }
              }
            }}
            placeholder="노드를 검색…"
            className="flex-1 bg-transparent text-[14px] text-[var(--text)] placeholder:text-[var(--text-dim)] outline-none"
          />
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => setScope("current")}
              className={`px-2 py-0.5 rounded ${
                scope === "current"
                  ? "bg-[var(--bg-hover)] text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              현재 대화
            </button>
            <button
              onClick={() => setScope("all")}
              className={`px-2 py-0.5 rounded ${
                scope === "all"
                  ? "bg-[var(--bg-hover)] text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              전체
            </button>
          </div>
        </div>
        <div className="flex-1 max-h-[50vh] overflow-y-auto">
          {items.length === 0 && (
            <div className="px-4 py-6 text-[13px] text-[var(--text-muted)]">
              일치하는 노드가 없습니다.
            </div>
          )}
          {items.map((it, i) => (
            <button
              key={`${it.conversationId}:${it.node.id}`}
              onMouseEnter={() => setActive(i)}
              onClick={() =>
                onPick({
                  conversationId: it.conversationId,
                  nodeId: it.node.id,
                  node: it.node,
                  convTitle: it.conversationTitle,
                })
              }
              className={`w-full text-left px-4 py-2.5 flex items-start gap-2 ${
                i === active ? "bg-[var(--bg-hover)]" : "hover:bg-[var(--bg-hover)]"
              }`}
            >
              <span
                className="shrink-0 mt-1.5 inline-block w-2 h-2 rounded-full"
                style={{
                  background:
                    it.node.kind === "user" ? "var(--user)" : "var(--assistant)",
                }}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] text-[var(--text)] truncate leading-snug">
                  {it.node.promoted && <span className="text-[var(--accent)] mr-1">★</span>}
                  {it.node.text.slice(0, 100) || "(빈 노드)"}
                </span>
                <span className="text-[11px] text-[var(--accent)] font-mono">
                  #{it.node.id}
                  {scope === "all" && (
                    <span className="ml-2 text-[var(--text-dim)]">{it.conversationTitle}</span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
