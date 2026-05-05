"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, ConvNode } from "@/lib/types";
import { getPath } from "@/lib/clientPath";
import Tooltip from "./Tooltip";
import GraphPane from "./GraphPane";

const QUICK_BRANCH_PROMPTS = [
  "더 자세히",
  "예시를 들어줘",
  "반대 관점은?",
  "근거가 뭐야?",
  "적용 사례는?",
];

function sendNow(text: string) {
  window.dispatchEvent(new CustomEvent("augment:send", { detail: text }));
}

export default function CanvasPane({
  conv,
  activePathTo,
  selectedId,
  onSelectNode,
  onBranchFromSnippet,
  onSend,
  onTogglePromote,
  busy,
  pendingBranchSnippet,
  onCancelBranch,
  coachSeen,
  openWhy,
  flashId,
  onCopyNodeId,
  onOpenJump,
  onRename,
  onPatchNode,
  onOpenCompare,
}: {
  conv: Conversation;
  activePathTo: string | null;
  selectedId: string | null;
  onSelectNode: (id: string) => void;
  onBranchFromSnippet: (snippet: string, fromNodeId: string) => void;
  onSend: (text: string) => void;
  onTogglePromote: (nodeId: string) => void;
  busy: boolean;
  pendingBranchSnippet: string | null;
  onCancelBranch: () => void;
  coachSeen: Record<string, boolean>;
  openWhy: (topic: string) => void;
  flashId: string | null;
  onCopyNodeId: (id: string) => void;
  onOpenJump: () => void;
  onRename: (title: string) => void;
  onPatchNode: (
    nodeId: string,
    patch: { memo?: string; tags?: string[]; pinned?: boolean }
  ) => void;
  onOpenCompare: (seedNodeId?: string | null) => void;
}) {
  const path = useMemo<ConvNode[]>(() => {
    if (!activePathTo) return [];
    return getPath(conv, activePathTo);
  }, [conv, activePathTo]);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(conv.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [graphOpen, setGraphOpen] = useState(false);

  useEffect(() => {
    if (!titleEditing) setTitleDraft(conv.title);
  }, [conv.title, titleEditing]);

  useEffect(() => {
    if (titleEditing) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [titleEditing]);

  const commitTitle = () => {
    setTitleEditing(false);
    if (titleDraft.trim() && titleDraft.trim() !== conv.title) {
      onRename(titleDraft);
    }
  };
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);

  const mentionItems = useMemo<ConvNode[]>(() => {
    if (!mention) return [];
    const all = Object.values(conv.nodes).filter(
      (n) => n.kind === "user" || n.kind === "assistant"
    );
    const q = mention.query.toLowerCase();
    const filtered = q
      ? all.filter((n) => n.id.toLowerCase().includes(q) || n.text.toLowerCase().includes(q))
      : all;
    return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  }, [mention, conv.nodes]);

  const detectMention = (value: string, caret: number) => {
    // Find the latest # before caret that starts a mention token
    const before = value.slice(0, caret);
    const idx = before.lastIndexOf("#");
    if (idx < 0) return setMention(null);
    // # must be at start or preceded by whitespace/newline
    if (idx > 0 && !/\s/.test(before[idx - 1])) return setMention(null);
    const token = before.slice(idx + 1);
    // valid token chars only
    if (!/^[A-Za-z0-9_-]*$/.test(token)) return setMention(null);
    if (token.length > 12) return setMention(null);
    setMention({ start: idx, query: token });
    setMentionIdx(0);
  };

  const insertMention = (id: string) => {
    if (!mention || !textareaRef.current) return;
    const el = textareaRef.current;
    const before = draft.slice(0, mention.start);
    const after = draft.slice(el.selectionStart ?? mention.start + 1 + mention.query.length);
    const insertion = `#${id} `;
    const next = before + insertion + after;
    setDraft(next);
    setMention(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + insertion.length;
      el.setSelectionRange(pos, pos);
    });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [path.length, busy]);

  useEffect(() => {
    const onPrefill = (e: Event) => {
      const ce = e as CustomEvent<string>;
      const text = ce.detail ?? "";
      setDraft(text);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(text.length, text.length);
          el.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      });
    };
    const onSendNow = (e: Event) => {
      const ce = e as CustomEvent<string>;
      const text = (ce.detail ?? "").trim();
      if (!text || busy) return;
      setDraft("");
      onSend(text);
    };
    window.addEventListener("augment:prefill", onPrefill);
    window.addEventListener("augment:send", onSendNow);
    return () => {
      window.removeEventListener("augment:prefill", onPrefill);
      window.removeEventListener("augment:send", onSendNow);
    };
  }, [busy, onSend]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text);
    setDraft("");
  };

  const showFirstMessageCoach = !coachSeen["first-message"] && path.length === 1;
  const showFirstBranchCoach =
    !coachSeen["first-branch"] && coachSeen["first-message"] && !pendingBranchSnippet;

  return (
    <>
      <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center justify-between px-6 gap-3">
        {titleEditing ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitle();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setTitleDraft(conv.title);
                setTitleEditing(false);
              }
            }}
            onBlur={commitTitle}
            className="flex-1 min-w-0 text-[15px] font-medium bg-transparent border border-[var(--accent)] rounded px-2 py-1 text-[var(--text)] outline-none"
          />
        ) : (
          <button
            onClick={() => setTitleEditing(true)}
            title="클릭하여 이름 변경"
            className="text-[15px] font-medium truncate text-left flex-1 min-w-0 hover:text-[var(--accent)] transition-colors"
          >
            {conv.title}
          </button>
        )}
        <div className="flex items-center gap-3 text-[var(--text-muted)] text-[13px]">
          <Tooltip content="노드 ID로 점프하거나 검색합니다" placement="bottom">
            <button
              onClick={onOpenJump}
              className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text)] flex items-center gap-1.5"
            >
              <span>점프</span>
              <span className="font-mono text-[11px] text-[var(--text-dim)]">⌘K</span>
            </button>
          </Tooltip>
          <Tooltip content="두 노드의 공통점·차이·빠진 시각을 함께 봅니다" placement="bottom">
            <button
              onClick={() => onOpenCompare(selectedId)}
              className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text)] flex items-center gap-1.5"
            >
              <span>비교</span>
              <span className="font-mono text-[11px] text-[var(--text-dim)]">⌘⇧C</span>
            </button>
          </Tooltip>
          <Tooltip content="대화 전체를 그래프로 봅니다" placement="bottom">
            <button
              onClick={() => setGraphOpen(true)}
              className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            >
              그래프
            </button>
          </Tooltip>
          <Tooltip content="ViewSpec이 무엇이고 왜 있는지" placement="bottom">
            <button onClick={() => openWhy("viewspec")} className="hover:text-[var(--text)]">
              다른 시각으로 보기란?
            </button>
          </Tooltip>
          <span className="text-[var(--text-dim)]">·</span>
          <Tooltip content="분기가 무엇이고 왜 있는지" placement="bottom">
            <button onClick={() => openWhy("branch")} className="hover:text-[var(--text)]">
              분기란?
            </button>
          </Tooltip>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-10 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {path.length <= 1 && (
            <div className="text-[var(--text-muted)] leading-relaxed py-16 text-center">
              <div className="mb-2 text-[16px] text-[var(--text)]">새로운 사고를 시작합니다.</div>
              <div className="text-[14px]">
                질문을 입력하세요. 답변을 받으면, 마음에 드는 문장에서 새 가지를 칠 수 있습니다.
              </div>
            </div>
          )}

          {path
            .filter((n) => n.kind !== "note")
            .map((n) => (
              <NodeBlock
                key={n.id}
                node={n}
                selected={selectedId === n.id}
                flashing={flashId === n.id}
                onSelect={() => onSelectNode(n.id)}
                onBranch={(snippet) => onBranchFromSnippet(snippet, n.id)}
                onTogglePromote={() => onTogglePromote(n.id)}
                onCopyNodeId={onCopyNodeId}
                onSaveMemo={(memo) => onPatchNode(n.id, { memo })}
                onSaveTags={(tags) => onPatchNode(n.id, { tags })}
                onTogglePin={() => onPatchNode(n.id, { pinned: !n.pinned })}
              />
            ))}

          {busy && (
            <div className="text-[14px] text-[var(--text-muted)] fade-in flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
              생각 중…
            </div>
          )}

          {showFirstMessageCoach && (
            <div className="text-[14px] text-[var(--accent)] fade-in mt-8 px-4 py-3 border border-[var(--accent)] rounded-md bg-[var(--accent-soft)] leading-relaxed">
              ↓ 아래에 질문을 입력해 시작해보세요.<br />
              답변을 받은 뒤, 마음에 드는 문장을 클릭하면 그 지점에서 새 가지가 생깁니다.
            </div>
          )}

          {showFirstBranchCoach && path.length > 1 && (
            <div className="text-[14px] text-[var(--text-muted)] fade-in mt-2 px-4 py-3 border border-[var(--border)] rounded-md leading-relaxed bg-[var(--bg-card)]">
              <span className="text-[var(--accent)]">💡</span> 답변의 한 문장 위에 마우스를 올려보세요. 클릭하면 그 문장에서 새 가지가 시작됩니다.
            </div>
          )}
        </div>
      </div>

      {pendingBranchSnippet && (
        <div className="border-t border-[var(--accent)] px-6 py-3 bg-[var(--accent-soft)]">
          <div className="flex items-start gap-3">
            <div className="text-[12px] font-semibold text-[var(--accent)] mt-0.5 shrink-0">
              분기 시작
            </div>
            <div className="flex-1 text-[14px] text-[var(--text)] leading-relaxed">
              <div className="text-[12px] text-[var(--text-muted)] mb-0.5">선택한 문장</div>
              <div>"{pendingBranchSnippet}"</div>
            </div>
            <button
              onClick={onCancelBranch}
              className="text-[var(--text-muted)] hover:text-[var(--text)] text-[13px]"
            >
              취소
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[11px] text-[var(--text-muted)] self-center mr-1">
              빠른 질문 (클릭 시 즉시 전송):
            </span>
            {QUICK_BRANCH_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => sendNow(q)}
                disabled={busy}
                className="text-[12px] px-2.5 py-1 rounded-full border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="px-6 pb-6 pt-4 relative bg-[var(--bg-elev)] border-t border-[var(--border)]"
      >
        <div className="max-w-2xl mx-auto relative">
          <div className="relative bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-xl focus-within:border-[var(--accent)] transition-colors flex flex-col shadow-sm">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                detectMention(e.target.value, e.target.selectionStart ?? 0);
              }}
              onKeyUp={(e) => {
                const t = e.currentTarget;
                detectMention(t.value, t.selectionStart ?? 0);
              }}
              onClick={(e) => {
                const t = e.currentTarget;
                detectMention(t.value, t.selectionStart ?? 0);
              }}
              onKeyDown={(e) => {
                if (mention && mentionItems.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIdx((i) => Math.min(mentionItems.length - 1, i + 1));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIdx((i) => Math.max(0, i - 1));
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    insertMention(mentionItems[mentionIdx].id);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setMention(null);
                    return;
                  }
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e);
              }}
              placeholder={
                pendingBranchSnippet
                  ? "이 문장에서 어떻게 가지를 칠지 적어주세요…"
                  : "질문하거나, 사고를 이어가세요.  # 로 다른 노드 인용,  ⌘+Enter 전송"
              }
              rows={2}
              disabled={busy}
              className="w-full bg-transparent border-0 rounded-t-xl px-4 pt-3 pb-2 text-[15px] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none resize-none leading-relaxed"
            />
            <div className="flex justify-end px-2.5 pb-2.5">
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="px-3.5 py-1.5 bg-[var(--text)] text-[var(--bg)] rounded-md text-[13px] font-medium disabled:opacity-25 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                전송
              </button>
            </div>

            {mention && mentionItems.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-md shadow-lg overflow-hidden fade-in z-20">
                <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
                  노드 인용 — ↑↓ 선택, Enter 삽입, Esc 취소
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {mentionItems.map((n, i) => (
                    <button
                      key={n.id}
                      type="button"
                      onMouseEnter={() => setMentionIdx(i)}
                      onClick={(ev) => {
                        ev.preventDefault();
                        insertMention(n.id);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start gap-2 ${
                        i === mentionIdx ? "bg-[var(--bg-hover)]" : "hover:bg-[var(--bg-hover)]"
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
                        <span className="block text-[13px] text-[var(--text)] truncate">
                          {n.promoted && <span className="text-[var(--accent)] mr-1">★</span>}
                          {n.text.slice(0, 80) || "(빈 노드)"}
                        </span>
                        <span className="text-[10px] text-[var(--accent)] font-mono">
                          #{n.id} · {n.kind === "user" ? "당신" : "Augment"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </form>

      {graphOpen && (
        <GraphPane
          conv={conv}
          selectedId={selectedId}
          onJump={(id) => {
            onSelectNode(id);
            setGraphOpen(false);
          }}
          onClose={() => setGraphOpen(false)}
        />
      )}
    </>
  );
}

function NodeBlock({
  node,
  selected,
  flashing,
  onSelect,
  onBranch,
  onTogglePromote,
  onCopyNodeId,
  onSaveMemo,
  onSaveTags,
  onTogglePin,
}: {
  node: ConvNode;
  selected: boolean;
  flashing: boolean;
  onSelect: () => void;
  onBranch: (snippet: string) => void;
  onTogglePromote: () => void;
  onCopyNodeId: (id: string) => void;
  onSaveMemo: (memo: string) => void;
  onSaveTags: (tags: string[]) => void;
  onTogglePin: () => void;
}) {
  const isUser = node.kind === "user";
  const blockRef = useRef<HTMLDivElement>(null);
  const [memoEditing, setMemoEditing] = useState(false);
  const [memoDraft, setMemoDraft] = useState(node.memo ?? "");
  const memoTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (flashing) {
      blockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [flashing]);

  useEffect(() => {
    if (!memoEditing) setMemoDraft(node.memo ?? "");
  }, [node.memo, memoEditing]);

  useEffect(() => {
    if (memoEditing) {
      requestAnimationFrame(() => {
        const el = memoTextareaRef.current;
        if (el) {
          el.focus();
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      });
    }
  }, [memoEditing]);

  const commitMemo = () => {
    setMemoEditing(false);
    if ((memoDraft.trim() || "") !== (node.memo ?? "")) {
      onSaveMemo(memoDraft);
    }
  };

  return (
    <div
      ref={blockRef}
      onClick={onSelect}
      className={`fade-in group relative rounded-lg px-5 py-4 transition-colors ${
        selected ? "bg-[var(--bg-card)] shadow-sm" : "hover:bg-[var(--bg-elev)]"
      } ${node.promoted ? "promoted" : ""} ${flashing ? "node-flash" : ""}`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5 text-[13px]">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background:
                node.kind === "user"
                  ? "var(--user)"
                  : node.kind === "assistant"
                    ? "var(--assistant)"
                    : "var(--note)",
            }}
          />
          <span className="font-medium text-[var(--text-muted)]">
            {node.kind === "user" ? "당신" : "Augment"}
          </span>
          <Tooltip
            content="이 노드의 주소를 복사합니다 (⌘K로 점프 또는 입력창에 인용)"
            placement="bottom"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyNodeId(node.id);
              }}
              className="text-[var(--accent)] opacity-40 hover:opacity-100 font-mono text-[12px]"
            >
              #{node.id}
            </button>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            data-tip={node.pinned ? "핀을 해제합니다" : "이 노드를 핀에 보관합니다"}
            className={`text-[13px] px-2 py-1 rounded transition-opacity ${
              node.pinned
                ? "text-[var(--accent)] opacity-100"
                : "text-[var(--text-muted)] hover:text-[var(--text)] opacity-0 group-hover:opacity-100"
            }`}
          >
            {node.pinned ? "📌 핀됨" : "📌 핀"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMemoEditing(true);
            }}
            data-tip={node.memo ? "메모를 편집합니다" : "이 노드에 메모를 답니다"}
            className={`text-[13px] px-2 py-1 rounded transition-opacity ${
              node.memo
                ? "text-[var(--note)] opacity-100"
                : "text-[var(--text-muted)] hover:text-[var(--note)] opacity-0 group-hover:opacity-100"
            }`}
          >
            ✎ 메모
          </button>
          {!isUser && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePromote();
              }}
              data-tip={node.promoted ? "승격을 해제합니다" : "이 답을 좋은 결정으로 승격합니다"}
              className={`text-[13px] px-2 py-1 rounded transition-opacity ${
                node.promoted
                  ? "text-[var(--accent)] opacity-100"
                  : "text-[var(--text-muted)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100"
              }`}
            >
              {node.promoted ? "★ 승격됨" : "☆ 승격하기"}
            </button>
          )}
        </div>
      </div>

      {node.contextSnippet && isUser && (
        <div className="text-[13px] text-[var(--text-muted)] border-l-2 border-[var(--accent)] pl-3 py-1 mb-3 italic bg-[var(--accent-soft)] rounded-r">
          "{node.contextSnippet}"
        </div>
      )}

      <div className="text-[16px] leading-[1.7] text-[var(--text)]">
        {isUser ? (
          <div className="whitespace-pre-wrap">{node.text}</div>
        ) : (
          <SentenceBranchableText text={node.text} onBranch={onBranch} />
        )}
      </div>

      <TagRow tags={node.tags ?? []} onSave={onSaveTags} />

      {(memoEditing || node.memo) && (
        <div
          className="mt-3 border-l-2 border-[var(--note)] pl-3 py-1 bg-[color-mix(in_srgb,var(--note)_8%,transparent)] rounded-r"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[11px] uppercase tracking-wider text-[var(--note)] mb-1 font-medium">
            메모
          </div>
          {memoEditing ? (
            <>
              <textarea
                ref={memoTextareaRef}
                value={memoDraft}
                onChange={(e) => setMemoDraft(e.target.value)}
                onBlur={commitMemo}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    commitMemo();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setMemoDraft(node.memo ?? "");
                    setMemoEditing(false);
                  }
                }}
                placeholder="이 노드를 본 *내* 생각을 적어두세요. (⌘+Enter 저장, Esc 취소)"
                rows={2}
                className="w-full bg-transparent border-0 outline-none text-[13px] text-[var(--text)] placeholder:text-[var(--text-dim)] resize-none leading-relaxed"
              />
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                ⌘+Enter 저장 · Esc 취소 · 빈 메모는 자동 삭제
              </div>
            </>
          ) : (
            <button
              onClick={() => setMemoEditing(true)}
              className="text-left w-full text-[13px] text-[var(--text)] whitespace-pre-wrap leading-relaxed"
            >
              {node.memo}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SentenceBranchableText({
  text,
  onBranch,
}: {
  text: string;
  onBranch: (snippet: string) => void;
}) {
  // Split by sentence-like boundaries while preserving structure (paragraphs)
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {paragraphs.map((para, pi) => {
        const sentences = splitSentences(para);
        return (
          <p key={pi} className="leading-relaxed">
            {sentences.map((s, si) => (
              <span
                key={si}
                className="sentence"
                onClick={(e) => {
                  e.stopPropagation();
                  onBranch(s.trim());
                }}
                data-tip="이 문장에서 분기"
              >
                {s}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function TagRow({
  tags,
  onSave,
}: {
  tags: string[];
  onSave: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) requestAnimationFrame(() => inputRef.current?.focus());
  }, [adding]);

  const normalize = (s: string) => s.trim().replace(/^#/, "").replace(/\s+/g, "-");

  const commitAdd = () => {
    const v = normalize(draft);
    setAdding(false);
    setDraft("");
    if (!v) return;
    if (tags.includes(v)) return;
    onSave([...tags, v]);
  };

  const removeTag = (t: string) => {
    onSave(tags.filter((x) => x !== t));
  };

  if (tags.length === 0 && !adding) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setAdding(true);
        }}
        className="mt-3 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        + 태그 추가
      </button>
    );
  }

  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {tags.map((t) => (
        <span
          key={t}
          className="group/tag inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)]"
        >
          <span className="text-[var(--accent)]">#</span>
          <span>{t}</span>
          <button
            onClick={() => removeTag(t)}
            data-tip="태그 제거"
            className="text-[var(--text-dim)] hover:text-[var(--accent)] -mr-0.5"
            aria-label={`${t} 제거`}
          >
            ✕
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitAdd();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft("");
              setAdding(false);
            } else if (e.key === "," || e.key === " ") {
              e.preventDefault();
              commitAdd();
              setAdding(true);
            }
          }}
          onBlur={commitAdd}
          placeholder="태그명"
          className="text-[12px] bg-transparent border border-[var(--accent)] rounded-full px-2 py-0.5 text-[var(--text)] placeholder:text-[var(--text-dim)] outline-none w-24"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-[12px] px-2 py-0.5 rounded-full border border-dashed border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          + 태그
        </button>
      )}
    </div>
  );
}

function splitSentences(text: string): string[] {
  // Korean + English sentence split. Keeps trailing punctuation/whitespace.
  const re = /[^.!?。！？\n]+[.!?。！？]+\s*|[^.!?。！？\n]+$/g;
  const matches = text.match(re);
  return matches && matches.length > 0 ? matches : [text];
}
