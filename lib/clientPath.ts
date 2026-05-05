import type { Conversation, ConvNode } from "./types";

export function getPath(conv: Conversation, nodeId: string | null): ConvNode[] {
  if (!nodeId) return [];
  const out: ConvNode[] = [];
  let cur: ConvNode | undefined = conv.nodes[nodeId];
  while (cur) {
    out.unshift(cur);
    cur = cur.parentId ? conv.nodes[cur.parentId] : undefined;
  }
  return out;
}
