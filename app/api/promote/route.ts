import { NextRequest, NextResponse } from "next/server";
import { bumpPattern, getConversation, saveConversation } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const { conversationId, nodeId }: { conversationId: string; nodeId: string } =
      await req.json();
    const conv = await getConversation(conversationId);
    if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });
    const node = conv.nodes[nodeId];
    if (!node) return NextResponse.json({ error: "node not found" }, { status: 404 });

    node.promoted = !node.promoted;
    await saveConversation(conv);
    if (node.promoted) await bumpPattern({ promotions: 1 });

    return NextResponse.json({ conversation: conv });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
