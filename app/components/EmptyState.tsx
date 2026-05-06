"use client";

type ConvSummary = { id: string; title: string; updatedAt: number; nodeCount: number };

export default function EmptyState({
  onNew,
  openWhy,
  list,
  onLoad,
}: {
  onNew: () => void;
  openWhy: (topic: string) => void;
  list?: ConvSummary[];
  onLoad?: (id: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 h-full">
      <div className="max-w-[720px] text-center">

        <h1 className="text-[36px] font-semibold mb-5 text-[var(--text)] leading-tight">
          답이 아니라, 더 좋은 질문에 도달하기 위한 작업대.
        </h1>
        <p className="text-[17px] text-[var(--text-muted)] leading-relaxed mb-12">
          AUGMENT는 더글러스 엥겔바트의 철학을 따른 AI 사고 도구입니다.<br />
          채팅이 아니라 사고의 가지를 보존하는 트리, 답변을 다른 시각으로 다시 보는 ViewSpec,<br />
          좋은 결론을 누적시키는 Promote.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onNew}
            className="px-6 py-3 bg-[var(--text)] text-[var(--bg)] rounded-md text-[16px] font-medium hover:opacity-90 transition-opacity"
          >
            첫 대화 시작
          </button>
          <button
            onClick={() => openWhy("intro")}
            className="px-6 py-3 border border-[var(--border)] rounded-md text-[16px] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-card)] transition-colors"
          >
            왜 이렇게 만들었나?
          </button>
        </div>

        {/* 지난 대화 목록 */}
        {list && list.length > 0 && onLoad && (
          <div className="mt-12 text-left max-w-[480px] mx-auto">
            <div className="text-[13px] font-medium text-[var(--text-muted)] mb-3">지난 대화</div>
            <div className="flex flex-col gap-1">
              {list.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onLoad(c.id)}
                  className="text-left px-4 py-2.5 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-card)] transition-colors"
                >
                  <div className="text-[14px] text-[var(--text)] truncate">{c.title}</div>
                  <div className="text-[12px] text-[var(--text-dim)] mt-0.5">{c.nodeCount}개 생각</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-14 grid grid-cols-3 gap-3 text-left">
          <Tile
            label="트리"
            desc="대화는 일자가 아니라 가지로 자랍니다"
            topic="tree"
            openWhy={openWhy}
          />
          <Tile
            label="다른 시각"
            desc="같은 답을 다른 렌즈로 다시 봅니다"
            topic="viewspec"
            openWhy={openWhy}
          />
          <Tile
            label="승격"
            desc="좋은 가지를 결정 기록으로 보존합니다"
            topic="promote"
            openWhy={openWhy}
          />
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  desc,
  topic,
  openWhy,
}: {
  label: string;
  desc: string;
  topic: string;
  openWhy: (t: string) => void;
}) {
  return (
    <button
      onClick={() => openWhy(topic)}
      className="text-left p-4 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-card)] transition-colors"
    >
      <div className="text-[14px] font-medium text-[var(--accent)] mb-1.5">{label}</div>
      <div className="text-[13px] text-[var(--text-muted)] leading-snug">{desc}</div>
    </button>
  );
}
