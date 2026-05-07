import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";

const SYSTEM = `당신은 Augment의 사고 동반자입니다. 더글러스 엥겔바트의 철학을 따릅니다.

원칙:
- 사용자를 대체하지 말고 *증강*합니다. 사용자가 더 좋은 질문에 도달하도록 돕습니다.
- 답을 단정하지 말고 사고의 가지를 제안합니다. 명확한 결론과 함께 *남은 질문*도 보여주세요.
- 한국어로 답합니다. 간결하고 구조화된 응답을 선호합니다.
- 너무 길게 늘어놓지 마세요. 분기와 ViewSpec으로 깊이를 이어갈 수 있습니다.`;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: Msg[] = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }
    const reply = await complete({ system: SYSTEM, messages, maxTokens: 1024 });
    return NextResponse.json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[/api/chat]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
