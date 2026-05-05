import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import { getConversation, listConversations } from "@/lib/storage";
import type { ConvNode, Conversation } from "@/lib/types";

type Ref = { conversationId: string; nodeId: string };

const SYSTEM = `당신은 사고의 두 갈래를 비교하는 분석가입니다. 두 텍스트를 받아 다음 4개 섹션으로 한국어 답변하세요. 매우 간결하게.

## 공통점
- 두 답이 모두 인정하는 것 / 같은 가정

## 차이
- 한쪽은 강조하고 다른 쪽은 안 한 것
- 강조점·결론·접근의 차이

## 빠진 시각
- 둘 다 다루지 않은 것 / 무의식적 가정

## 한 줄 종합
- 사용자가 이 둘에서 무엇을 얻고 어디로 가야 하는지

각 섹션은 짧은 불릿 2-3개로. 군더더기 없이.`;

async function findNode(refs: Ref[]): Promise<{
  node: ConvNode;
  convTitle: string;
}[]> {
  const out: { node: ConvNode; convTitle: string }[] = [];
  // Cache loaded conversations
  const cache = new Map<string, Conversation>();
  for (const r of refs) {
    let conv = cache.get(r.conversationId);
    if (!conv) {
      const loaded = await getConversation(r.conversationId);
      if (!loaded) continue;
      cache.set(r.conversationId, loaded);
      conv = loaded;
    }
    const node = conv.nodes[r.nodeId];
    if (node) out.push({ node, convTitle: conv.title });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const refs: Ref[] = body.refs ?? [];
    if (!Array.isArray(refs) || refs.length !== 2) {
      return NextResponse.json({ error: "두 개의 노드 참조가 필요합니다" }, { status: 400 });
    }

    const found = await findNode(refs);
    if (found.length !== 2) {
      return NextResponse.json({ error: "노드를 찾을 수 없습니다" }, { status: 404 });
    }

    // If user passed plain ids without conv, try to discover
    const a = found[0];
    const b = found[1];
    if (!a.node.text.trim() || !b.node.text.trim()) {
      return NextResponse.json(
        { error: "텍스트가 없는 노드는 비교할 수 없습니다" },
        { status: 400 }
      );
    }

    const reply = await complete({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `## 노드 A (#${a.node.id} · ${a.convTitle})\n${a.node.text.slice(0, 1500)}\n\n## 노드 B (#${b.node.id} · ${b.convTitle})\n${b.node.text.slice(0, 1500)}`,
        },
      ],
      maxTokens: 700,
    });

    return NextResponse.json({
      result: reply,
      a: { id: a.node.id, conversationTitle: a.convTitle },
      b: { id: b.node.id, conversationTitle: b.convTitle },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[/api/compare]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Helper for clients that only have ids and want server to resolve conv
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const ids: string[] = body.ids ?? [];
    if (ids.length !== 2) {
      return NextResponse.json({ error: "두 ID 필요" }, { status: 400 });
    }
    const all = await listConversations();
    const refs: Ref[] = [];
    for (const id of ids) {
      for (const conv of all) {
        if (conv.nodes[id]) {
          refs.push({ conversationId: conv.id, nodeId: id });
          break;
        }
      }
    }
    if (refs.length !== 2) {
      return NextResponse.json({ error: "노드를 찾지 못했습니다" }, { status: 404 });
    }
    // Re-call POST logic
    const r = await fetch(new URL("/api/compare", req.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refs }),
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
