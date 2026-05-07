"use client";

import { useEffect, useMemo, useState } from "react";
import type { ConvNode } from "@/lib/types";
import { indexNodes, type IndexedNode } from "@/lib/clientStorage";

type IndexResponse = {
  nodes: IndexedNode[];
  tags: { name: string; count: number }[];
};

export default function NodeIndexPanel({
  refreshKey,
  onJump,
}: {
  refreshKey: number;
  onJump: (conversationId: string, nodeId: string) => void;
}) {
  const [tagsOnly, setTagsOnly] = useState<IndexResponse["tags"]>([]);
  const [pinned, setPinned] = useState<IndexedNode[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [taggedNodes, setTaggedNodes] = useState<IndexedNode[]>([]);
  const [view, setView] = useState<"pinned" | "tags">("pinned");

  // initial load: pinned + all tags
  useEffect(() => {
    indexNodes({ pinnedOnly: true })
      .then((data: IndexResponse) => {
        setPinned(data.nodes);
        setTagsOnly(data.tags);
      })
      .catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    if (!activeTag) {
      setTaggedNodes([]);
      return;
    }
    indexNodes({ tag: activeTag })
      .then((data: IndexResponse) => setTaggedNodes(data.nodes))
      .catch(() => {});
  }, [activeTag, refreshKey]);

  const hasAny = pinned.length > 0 || tagsOnly.length > 0;
  if (!hasAny) return null;

  return (
    <div className="border-t border-[var(--border)] flex flex-col max-h-[40%] min-h-0">
      <div className="shrink-0 flex border-b border-[var(--border)]">
        <button
          onClick={() => setView("pinned")}
          className={`flex-1 px-3 py-2 text-[12px] transition-colors ${
            view === "pinned"
              ? "text-[var(--text)] font-medium border-b-2 border-[var(--accent)] -mb-px"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          📌 핀 ({pinned.length})
        </button>
        <button
          onClick={() => setView("tags")}
          className={`flex-1 px-3 py-2 text-[12px] transition-colors ${
            view === "tags"
              ? "text-[var(--text)] font-medium border-b-2 border-[var(--accent)] -mb-px"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          # 태그 ({tagsOnly.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {view === "pinned" ? (
          pinned.length === 0 ? (
            <div className="text-[12px] text-[var(--text-dim)] px-2 py-2 leading-relaxed">
              핀된 노드가 없습니다.<br />
              자주 참조하고 싶은 노드의 📌 버튼을 눌러 보관하세요.
            </div>
          ) : (
            pinned.map((it) => (
              <NodeRow
                key={`${it.conversationId}:${it.node.id}`}
                item={it}
                onClick={() => onJump(it.conversationId, it.node.id)}
              />
            ))
          )
        ) : (
          <TagsView
            tags={tagsOnly}
            activeTag={activeTag}
            onSelectTag={setActiveTag}
            taggedNodes={taggedNodes}
            onJump={onJump}
          />
        )}
      </div>
    </div>
  );
}

function NodeRow({
  item,
  onClick,
}: {
  item: IndexedNode;
  onClick: () => void;
}) {
  const n = item.node;
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-1.5 rounded text-[12px] hover:bg-[var(--bg-hover)] transition-colors"
    >
      <div className="flex items-start gap-1.5">
        <span
          className="shrink-0 mt-1 inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: n.kind === "user" ? "var(--user)" : "var(--assistant)" }}
        />
        <div className="flex-1 min-w-0">
          <div className="truncate text-[var(--text)] leading-snug">
            {n.promoted && <span className="text-[var(--accent)] mr-1">★</span>}
            {n.memo && <span className="text-[var(--note)] mr-1">✎</span>}
            {n.text.slice(0, 80) || "(빈 노드)"}
          </div>
          <div className="text-[10px] text-[var(--text-dim)] truncate">
            {item.conversationTitle}
          </div>
        </div>
      </div>
    </button>
  );
}

function TagsView({
  tags,
  activeTag,
  onSelectTag,
  taggedNodes,
  onJump,
}: {
  tags: { name: string; count: number }[];
  activeTag: string | null;
  onSelectTag: (t: string | null) => void;
  taggedNodes: IndexedNode[];
  onJump: (conversationId: string, nodeId: string) => void;
}) {
  if (tags.length === 0) {
    return (
      <div className="text-[12px] text-[var(--text-dim)] px-2 py-2 leading-relaxed">
        아직 태그가 없습니다.<br />
        노드 아래 + 태그 버튼으로 추가하세요.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2 px-1">
        {tags.map((t) => (
          <button
            key={t.name}
            onClick={() => onSelectTag(activeTag === t.name ? null : t.name)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
              activeTag === t.name
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            }`}
          >
            <span className="text-[var(--accent)]">#</span>
            {t.name}
            <span className="ml-1 text-[var(--text-dim)]">{t.count}</span>
          </button>
        ))}
      </div>
      {activeTag && (
        <div className="border-t border-[var(--border)] pt-1.5">
          {taggedNodes.length === 0 ? (
            <div className="text-[11px] text-[var(--text-dim)] px-2">없음</div>
          ) : (
            taggedNodes.map((it) => (
              <NodeRow
                key={`${it.conversationId}:${it.node.id}`}
                item={it}
                onClick={() => onJump(it.conversationId, it.node.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
