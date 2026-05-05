import { NextRequest, NextResponse } from "next/server";
import { listConversations } from "@/lib/storage";
import type { ConvNode } from "@/lib/types";

type IndexedNode = {
  conversationId: string;
  conversationTitle: string;
  node: ConvNode;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag");
  const pinnedOnly = url.searchParams.get("pinned") === "1";

  const all = await listConversations();
  const out: IndexedNode[] = [];
  const tagCounts: Record<string, number> = {};

  for (const conv of all) {
    for (const n of Object.values(conv.nodes)) {
      if (n.tags?.length) {
        for (const t of n.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      }
      if (tag && !(n.tags ?? []).includes(tag)) continue;
      if (pinnedOnly && !n.pinned) continue;
      if (!tag && !pinnedOnly) continue;
      out.push({
        conversationId: conv.id,
        conversationTitle: conv.title,
        node: n,
      });
    }
  }

  out.sort((a, b) => b.node.createdAt - a.node.createdAt);

  return NextResponse.json({
    nodes: out,
    tags: Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  });
}
