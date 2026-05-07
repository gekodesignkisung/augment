"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, ConvNode, ViewSpecKind } from "@/lib/types";
import TreePane from "./TreePane";
import CanvasPane from "./CanvasPane";
import ViewSpecPane from "./ViewSpecPane";
import WhyPanel from "./WhyPanel";
import EmptyState from "./EmptyState";
import JumpPalette from "./JumpPalette";
import NodeIndexPanel from "./NodeIndexPanel";
import ComparePanel from "./ComparePanel";
import { toast } from "./Toast";
import {
  addNode,
  bumpPattern,
  createConversation as createConv,
  deleteConversation as deleteConv,
  getConversation,
  getPath,
  listConversations,
  saveConversation,
} from "@/lib/clientStorage";

type ConvSummary = { id: string; title: string; updatedAt: number; nodeCount: number };

export default function Workbench() {
  const [list, setList] = useState<ConvSummary[]>([]);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [activePathTo, setActivePathTo] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingBranchSnippet, setPendingBranchSnippet] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [whyTopic, setWhyTopic] = useState<string>("intro");
  const [busy, setBusy] = useState(false);
  const [coachSeen, setCoachSeen] = useState<Record<string, boolean>>({});
  const [jumpOpen, setJumpOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSeed, setCompareSeed] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);

  // Load conversation list
  const refreshList = useCallback(async () => {
    setList(await listConversations());
  }, []);

  useEffect(() => {
    refreshList();
    try {
      const seen = JSON.parse(localStorage.getItem("augment.coach") ?? "{}");
      setCoachSeen(seen);
    } catch {}
    const onWhy = (e: Event) => {
      const ce = e as CustomEvent<string>;
      setWhyTopic(ce.detail);
      setWhyOpen(true);
    };
    window.addEventListener("augment:why", onWhy);

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setJumpOpen((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setCompareSeed(selectedNodeIdRef.current);
        setCompareOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("augment:why", onWhy);
      window.removeEventListener("keydown", onKey);
    };
  }, [refreshList]);

  const markCoach = useCallback((key: string) => {
    setCoachSeen((prev) => {
      const next = { ...prev, [key]: true };
      localStorage.setItem("augment.coach", JSON.stringify(next));
      return next;
    });
  }, []);

  const newConversation = async () => {
    const c = createConv();
    await saveConversation(c);
    await bumpPattern({ conversationsCreated: 1 });
    setConv(c);
    setActivePathTo(c.rootId);
    setSelectedNodeId(null);
    refreshList();
  };

  const renameConversation = async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const target = await getConversation(id);
    if (!target) return;
    target.title = trimmed.slice(0, 80);
    await saveConversation(target);
    if (conv?.id === id) setConv(target);
    refreshList();
  };

  const deleteConversation = async (id: string) => {
    if (!confirm("이 대화를 삭제할까요? 되돌릴 수 없습니다.")) return;
    await deleteConv(id);
    if (conv?.id === id) {
      setConv(null);
      setActivePathTo(null);
      setSelectedNodeId(null);
    }
    refreshList();
  };

  const loadConversation = async (id: string) => {
    const c = await getConversation(id);
    if (!c) return;
    setConv(c);
    const leaf = pickDefaultLeaf(c);
    setActivePathTo(leaf);
    setSelectedNodeId(null);
  };

  const sendMessage = async (text: string) => {
    if (!conv || !activePathTo || busy) return;
    setBusy(true);
    try {
      const parentId = activePathTo;
      const snippet = pendingBranchSnippet;

      // Resolve any #id quotes in user text
      const quoteIds: string[] = [];
      const idRegex = /#([A-Za-z0-9_-]{6,12})/g;
      let m: RegExpExecArray | null;
      while ((m = idRegex.exec(text))) {
        const qid = m[1];
        if (conv.nodes[qid] && !quoteIds.includes(qid)) quoteIds.push(qid);
      }
      const quoteBlock =
        quoteIds.length > 0
          ? quoteIds
              .map((qid) => {
                const n = conv.nodes[qid];
                const speaker = n.kind === "user" ? "당신" : "Augment";
                return `[인용한 노드 #${qid} (${speaker}): "${n.text.slice(0, 600)}"]`;
              })
              .join("\n")
          : "";

      // Add user node locally
      const isFirstUserMessage = !Object.values(conv.nodes).some((n) => n.kind === "user");
      const userNode = addNode(conv, parentId, {
        kind: "user",
        text,
        contextSnippet: snippet ?? undefined,
      });

      // Build messages from path
      const path = getPath(conv, userNode.id);
      const messages = path
        .filter((n) => n.kind === "user" || n.kind === "assistant")
        .map((n) => {
          if (n.id !== userNode.id) {
            return {
              role: n.kind as "user" | "assistant",
              content:
                n.kind === "user" && n.contextSnippet
                  ? `[이전 대화에서 인용한 문장: "${n.contextSnippet}"]\n\n${n.text}`
                  : n.text,
            };
          }
          const parts: string[] = [];
          if (n.contextSnippet) parts.push(`[이전 대화에서 인용한 문장: "${n.contextSnippet}"]`);
          if (quoteBlock) parts.push(quoteBlock);
          parts.push(n.text);
          return { role: "user" as const, content: parts.join("\n\n") };
        });

      // Call server (only for AI proxy)
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await r.json();
      if (data.error) {
        console.error("[chat error]", data.error);
        alert("오류: " + data.error);
        // rollback the user node
        const parent = conv.nodes[parentId];
        if (parent) parent.children = parent.children.filter((c) => c !== userNode.id);
        delete conv.nodes[userNode.id];
        return;
      }

      const assistantNode = addNode(conv, userNode.id, {
        kind: "assistant",
        text: data.reply,
      });

      // Auto-title on first user message
      if (isFirstUserMessage && (conv.title === "새 대화" || !conv.title.trim())) {
        try {
          const t = await fetch("/api/title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userText: text }),
          });
          const td = await t.json();
          if (td.title) conv.title = td.title;
        } catch {}
      }

      await saveConversation(conv);
      await bumpPattern({ nodesCreated: 2, branchesCreated: snippet ? 1 : 0 });

      setConv({ ...conv });
      setActivePathTo(assistantNode.id);
      setPendingBranchSnippet(null);
      markCoach("first-message");
      if (snippet) markCoach("first-branch");
      refreshList();
    } finally {
      setBusy(false);
    }
  };

  const startBranchFromSnippet = (snippet: string, fromNodeId: string) => {
    setPendingBranchSnippet(snippet);
    setActivePathTo(fromNodeId);
    setSelectedNodeId(fromNodeId);
  };

  const patchNode = async (
    nodeId: string,
    patch: { memo?: string; tags?: string[]; pinned?: boolean }
  ) => {
    if (!conv) return;
    const node = conv.nodes[nodeId];
    if (!node) return;
    if (patch.memo !== undefined) node.memo = patch.memo.trim() || undefined;
    if (patch.tags !== undefined) {
      const cleaned = patch.tags
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 24);
      node.tags = cleaned.length ? cleaned : undefined;
    }
    if (patch.pinned !== undefined) node.pinned = patch.pinned || undefined;
    await saveConversation(conv);
    setConv({ ...conv });
  };

  const togglePromote = async (nodeId: string) => {
    if (!conv) return;
    const node = conv.nodes[nodeId];
    if (!node) return;
    node.promoted = !node.promoted;
    await saveConversation(conv);
    if (node.promoted) await bumpPattern({ promotions: 1 });
    setConv({ ...conv });
  };

  const onSelectNode = (id: string) => {
    setSelectedNodeId(id);
    setActivePathTo(id);
  };

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  const jumpToNode = useCallback(
    (id: string) => {
      if (!conv || !conv.nodes[id]) {
        toast(`#${id} 노드를 찾을 수 없습니다`, "error");
        return;
      }
      setSelectedNodeId(id);
      setActivePathTo(id);
      setFlashId(id);
      window.setTimeout(() => setFlashId(null), 1300);
      toast(`#${id} 로 이동`);
    },
    [conv]
  );

  const copyNodeId = useCallback((id: string) => {
    navigator.clipboard.writeText(`#${id}`);
    toast(`#${id} 복사됨 — ⌘K 로 붙여넣어 점프하거나, 입력창에 인용`);
  }, []);

  const jumpAcrossConversations = useCallback(
    async (targetConvId: string, nodeId: string) => {
      if (conv?.id === targetConvId) {
        jumpToNode(nodeId);
        return;
      }
      const c = await getConversation(targetConvId);
      if (!c) {
        toast("대화를 찾을 수 없습니다", "error");
        return;
      }
      setConv(c);
      if (c.nodes[nodeId]) {
        setSelectedNodeId(nodeId);
        setActivePathTo(nodeId);
        setFlashId(nodeId);
        window.setTimeout(() => setFlashId(null), 1300);
        toast(`${c.title} 의 #${nodeId} 로 이동`);
      }
    },
    [conv?.id, jumpToNode]
  );

  // URL hash → jump on load and when conv changes
  useEffect(() => {
    if (!conv) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && conv.nodes[hash]) {
      jumpToNode(hash);
    }
  }, [conv, jumpToNode]);

  const selectedNode: ConvNode | null = useMemo(() => {
    if (!conv || !selectedNodeId) return null;
    return conv.nodes[selectedNodeId] ?? null;
  }, [conv, selectedNodeId]);

  const openWhy = (topic: string) => {
    setWhyTopic(topic);
    setWhyOpen(true);
  };

  // No conversation → fullscreen intro
  if (!conv) {
    return (
      <div className="h-screen w-screen bg-[var(--bg)] text-[var(--text)]">
        <EmptyState onNew={newConversation} openWhy={openWhy} list={list} onLoad={loadConversation} />
        <WhyPanel open={whyOpen} topic={whyTopic} onClose={() => setWhyOpen(false)} />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-[var(--bg)] text-[var(--text)]">
      {/* LEFT: Tree + conversation list */}
      <aside className="flex-[1.5] min-w-[240px] shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--bg-elev)]">
        <header className="h-14 flex items-center justify-between px-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-semibold tracking-tight">Augment</span>
            <button
              data-tip="이 도구가 무엇이고 왜 만들었는지"
              data-tip-pos="below"
              onClick={() => openWhy("intro")}
              className="text-[var(--text-muted)] hover:text-[var(--text)] text-[13px] px-2 py-0.5 rounded border border-[var(--border)]"
            >
              ?
            </button>
          </div>
          <button
            onClick={newConversation}
            data-tip="새로운 대화를 시작합니다"
            data-tip-pos="below-left"
            className="text-[13px] px-2.5 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded border border-[var(--border)]"
          >
            + 새 대화
          </button>
        </header>

        <div className="overflow-y-auto py-3 px-2 border-b border-[var(--border)] max-h-[30%]">
          <div className="text-[12px] font-medium text-[var(--text-muted)] px-2 mb-2">
            지난 대화
          </div>
          {list.length === 0 && (
            <div className="text-[13px] text-[var(--text-dim)] px-2 py-1">아직 없습니다</div>
          )}
          {list.map((c) => (
            <ConvListItem
              key={c.id}
              summary={c}
              isActive={conv?.id === c.id}
              onOpen={() => loadConversation(c.id)}
              onDelete={() => deleteConversation(c.id)}
              onRename={(title) => renameConversation(c.id, title)}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2.5">
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">
              사고 트리
            </div>
            <button
              data-tip="왜 채팅이 아니라 트리인가?"
              data-tip-pos="below-left"
              onClick={() => openWhy("tree")}
              className="text-[var(--text-muted)] hover:text-[var(--text)] text-[13px]"
            >
              ?
            </button>
          </div>
          {conv ? (
            <TreePane
              conv={conv}
              activePathTo={activePathTo}
              selectedId={selectedNodeId}
              onSelect={onSelectNode}
            />
          ) : (
            <div className="text-[13px] text-[var(--text-dim)] px-2 py-1 leading-relaxed">
              대화를 선택하거나<br />새로 시작하세요
            </div>
          )}
        </div>

        <NodeIndexPanel
          refreshKey={conv?.updatedAt ?? 0}
          onJump={jumpAcrossConversations}
        />
      </aside>

      {/* CENTER: Canvas */}
      <main className="flex-[3] flex flex-col min-w-0 relative">
        <CanvasPane
          conv={conv}
          activePathTo={activePathTo}
          selectedId={selectedNodeId}
          onSelectNode={onSelectNode}
          onBranchFromSnippet={startBranchFromSnippet}
          onSend={sendMessage}
          onTogglePromote={togglePromote}
          busy={busy}
          pendingBranchSnippet={pendingBranchSnippet}
          onCancelBranch={() => setPendingBranchSnippet(null)}
          coachSeen={coachSeen}
          openWhy={openWhy}
          flashId={flashId}
          onCopyNodeId={copyNodeId}
          onOpenJump={() => setJumpOpen(true)}
          onRename={(title) => renameConversation(conv.id, title)}
          onPatchNode={patchNode}
          onOpenCompare={(seedNodeId) => {
            setCompareSeed(seedNodeId ?? null);
            setCompareOpen(true);
          }}
        />
      </main>

      {/* RIGHT: ViewSpec */}
      <aside className="flex-[2] min-w-0 border-l border-[var(--border)] bg-[var(--bg-elev)] flex flex-col">
        <ViewSpecPane node={selectedNode} openWhy={openWhy} />
      </aside>

      <WhyPanel open={whyOpen} topic={whyTopic} onClose={() => setWhyOpen(false)} />
      <JumpPalette
        open={jumpOpen}
        conv={conv}
        onClose={() => setJumpOpen(false)}
        onJump={jumpToNode}
      />
      <ComparePanel
        open={compareOpen}
        conv={conv}
        initialNodeId={compareSeed}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
}

function ConvListItem({
  summary,
  isActive,
  onOpen,
  onDelete,
  onRename,
}: {
  summary: ConvSummary;
  isActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(summary.title);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, summary.title]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== summary.title) onRename(draft);
  };

  return (
    <div
      className={`group relative rounded transition-colors ${
        isActive ? "bg-[var(--bg-hover)]" : "hover:bg-[var(--bg-hover)]"
      }`}
    >
      {editing ? (
        <div className="px-2 py-2 pr-8">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
              }
            }}
            onBlur={commit}
            className="w-full bg-[var(--bg-card)] border border-[var(--accent)] rounded px-1.5 py-1 text-[13px] text-[var(--text)] outline-none"
          />
          <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{summary.nodeCount}개 생각</div>
        </div>
      ) : (
        <button
          onClick={onOpen}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className={`w-full text-left px-2 py-2 pr-8 text-[13px] ${
            isActive ? "text-[var(--text)]" : "text-[var(--text-muted)]"
          }`}
          title="더블클릭하여 이름 변경"
        >
          <div className="truncate leading-snug">{summary.title}</div>
          <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{summary.nodeCount}개 생각</div>
        </button>
      )}
      {!editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          data-tip="이 대화를 삭제합니다"
          data-tip-pos="left"
          className="absolute bottom-1 right-1.5 w-6 h-6 rounded text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--bg-card)] flex items-center justify-center text-[14px] opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="대화 삭제"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function pickDefaultLeaf(conv: Conversation): string {
  // Prefer the most recently created leaf
  const leaves = Object.values(conv.nodes).filter((n) => n.children.length === 0);
  if (leaves.length === 0) return conv.rootId;
  leaves.sort((a, b) => b.createdAt - a.createdAt);
  return leaves[0].id;
}
