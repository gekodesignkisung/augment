import { NextRequest, NextResponse } from "next/server";
import { getConversation, saveConversation } from "@/lib/storage";

type Ctx = { params: Promise<{ nodeId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { nodeId } = await params;
    const body = await req.json();
    const conversationId: string | undefined = body.conversationId;
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }
    const conv = await getConversation(conversationId);
    if (!conv) return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    const node = conv.nodes[nodeId];
    if (!node) return NextResponse.json({ error: "node not found" }, { status: 404 });

    if (typeof body.memo === "string") {
      node.memo = body.memo.trim() || undefined;
    }
    if (Array.isArray(body.tags)) {
      const cleaned = body.tags
        .map((t: unknown) => (typeof t === "string" ? t.trim() : ""))
        .filter((t: string) => t.length > 0)
        .slice(0, 24);
      node.tags = cleaned.length ? cleaned : undefined;
    }
    if (typeof body.pinned === "boolean") {
      node.pinned = body.pinned || undefined;
    }

    await saveConversation(conv);
    return NextResponse.json({ conversation: conv });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[/api/nodes/:id PATCH]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
