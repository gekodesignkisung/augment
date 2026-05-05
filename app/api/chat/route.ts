import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import {
  addNode,
  bumpPattern,
  getConversation,
  getPath,
  saveConversation,
} from "@/lib/storage";

const SYSTEM = `당신은 Augment의 사고 동반자입니다. 더글러스 엥겔바트의 철학을 따릅니다.

원칙:
- 사용자를 대체하지 말고 *증강*합니다. 사용자가 더 좋은 질문에 도달하도록 돕습니다.
- 답을 단정하지 말고 사고의 가지를 제안합니다. 명확한 결론과 함께 *남은 질문*도 보여주세요.
- 한국어로 답합니다. 간결하고 구조화된 응답을 선호합니다.
- 너무 길게 늘어놓지 마세요. 분기와 ViewSpec으로 깊이를 이어갈 수 있습니다.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      conversationId,
      parentId,
      userText,
      contextSnippet,
    }: {
      conversationId: string;
      parentId: string;
      userText: string;
      contextSnippet?: string;
    } = body;

    const conv = await getConversation(conversationId);
    if (!conv) return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    if (!conv.nodes[parentId]) {
      return NextResponse.json({ error: "parent not found" }, { status: 404 });
    }

    // Resolve any #id quotes embedded in user text
    const quoteIds: string[] = [];
    const idRegex = /#([A-Za-z0-9_-]{6,12})/g;
    let m: RegExpExecArray | null;
    while ((m = idRegex.exec(userText))) {
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

    const isBranch = !!contextSnippet;
    const isFirstUserMessage =
      !Object.values(conv.nodes).some((n) => n.kind === "user");
    const userNode = addNode(conv, parentId, {
      kind: "user",
      text: userText,
      contextSnippet,
    });

    const path = getPath(conv, userNode.id);
    const messages = path
      .filter((n) => n.kind === "user" || n.kind === "assistant")
      .map((n) => {
        if (n.id !== userNode.id) {
          // historical messages
          return {
            role: n.kind as "user" | "assistant",
            content:
              n.kind === "user" && n.contextSnippet
                ? `[이전 대화에서 인용한 문장: "${n.contextSnippet}"]\n\n${n.text}`
                : n.text,
          };
        }
        // current user message — prepend any #id quote blocks
        const parts: string[] = [];
        if (n.contextSnippet) parts.push(`[이전 대화에서 인용한 문장: "${n.contextSnippet}"]`);
        if (quoteBlock) parts.push(quoteBlock);
        parts.push(n.text);
        return {
          role: "user" as const,
          content: parts.join("\n\n"),
        };
      });

    const reply = await complete({
      system: SYSTEM,
      messages,
      maxTokens: 1024,
    });

    const assistantNode = addNode(conv, userNode.id, {
      kind: "assistant",
      text: reply,
    });

    // Auto-title on first user message
    if (isFirstUserMessage && (conv.title === "새 대화" || !conv.title.trim())) {
      try {
        const title = await complete({
          system:
            "사용자의 첫 질문/메시지를 보고 그 대화의 제목을 만드세요. 한국어로, 12자 이내, 따옴표·마침표·물음표 없이, 명사구로. 제목만 출력하세요.",
          messages: [{ role: "user", content: userText.slice(0, 600) }],
          maxTokens: 40,
        });
        const cleaned = title
          .trim()
          .replace(/^["'`「『]+|["'`」』]+$/g, "")
          .replace(/[.!?。！？]+$/g, "")
          .slice(0, 40);
        if (cleaned) conv.title = cleaned;
      } catch (titleErr) {
        console.warn("[title generation failed]", titleErr);
        // Fallback: first ~24 chars of user text
        conv.title = userText.trim().slice(0, 24) || "새 대화";
      }
    }

    await saveConversation(conv);
    await bumpPattern({
      nodesCreated: 2,
      branchesCreated: isBranch ? 1 : 0,
    });

    return NextResponse.json({
      conversation: conv,
      newUserNodeId: userNode.id,
      newAssistantNodeId: assistantNode.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[/api/chat]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
