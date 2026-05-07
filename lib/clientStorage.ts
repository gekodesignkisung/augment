"use client";

import Dexie, { type Table } from "dexie";
import { nanoid } from "nanoid";
import type { Conversation, ConvNode, UsagePattern } from "./types";

class AugmentDB extends Dexie {
  conversations!: Table<Conversation, string>;
  patterns!: Table<UsagePattern & { id: "singleton" }, string>;

  constructor() {
    super("augment");
    this.version(1).stores({
      conversations: "id, updatedAt, createdAt",
      patterns: "id",
    });
  }
}

let _db: AugmentDB | null = null;
function db(): AugmentDB {
  if (typeof window === "undefined") {
    throw new Error("clientStorage is browser-only");
  }
  if (!_db) _db = new AugmentDB();
  return _db;
}

export type ConvSummary = {
  id: string;
  title: string;
  updatedAt: number;
  nodeCount: number;
};

export async function listConversations(): Promise<ConvSummary[]> {
  const all = await db().conversations.orderBy("updatedAt").reverse().toArray();
  return all.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    nodeCount: Object.keys(c.nodes).length,
  }));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  return (await db().conversations.get(id)) ?? null;
}

export async function saveConversation(conv: Conversation): Promise<void> {
  conv.updatedAt = Date.now();
  await db().conversations.put(conv);
}

export async function deleteConversation(id: string): Promise<void> {
  await db().conversations.delete(id);
}

export function createConversation(title = "새 대화"): Conversation {
  const rootId = nanoid(8);
  const now = Date.now();
  const root: ConvNode = {
    id: rootId,
    kind: "note",
    text: "",
    parentId: null,
    children: [],
    createdAt: now,
  };
  return {
    id: nanoid(10),
    title,
    rootId,
    nodes: { [rootId]: root },
    createdAt: now,
    updatedAt: now,
  };
}

export function addNode(
  conv: Conversation,
  parentId: string,
  partial: Pick<ConvNode, "kind" | "text"> & { contextSnippet?: string }
): ConvNode {
  const id = nanoid(8);
  const node: ConvNode = {
    id,
    kind: partial.kind,
    text: partial.text,
    parentId,
    children: [],
    contextSnippet: partial.contextSnippet,
    createdAt: Date.now(),
  };
  conv.nodes[id] = node;
  const parent = conv.nodes[parentId];
  if (parent) parent.children.push(id);
  return node;
}

export function getPath(conv: Conversation, nodeId: string): ConvNode[] {
  const out: ConvNode[] = [];
  let cur: ConvNode | undefined = conv.nodes[nodeId];
  while (cur) {
    out.unshift(cur);
    cur = cur.parentId ? conv.nodes[cur.parentId] : undefined;
  }
  return out;
}

const DEFAULT_PATTERN: UsagePattern = {
  conversationsCreated: 0,
  nodesCreated: 0,
  branchesCreated: 0,
  viewSpecsUsed: 0,
  promotions: 0,
  viewSpecBreakdown: {},
  lastSeenAt: Date.now(),
};

export async function getPattern(): Promise<UsagePattern> {
  const cur = await db().patterns.get("singleton");
  if (!cur) return { ...DEFAULT_PATTERN };
  const { id: _omit, ...rest } = cur;
  return rest;
}

export async function bumpPattern(
  delta: Partial<Omit<UsagePattern, "viewSpecBreakdown" | "lastSeenAt">> & {
    viewSpec?: string;
  }
): Promise<UsagePattern> {
  const cur = await getPattern();
  const next: UsagePattern = {
    ...cur,
    conversationsCreated: cur.conversationsCreated + (delta.conversationsCreated ?? 0),
    nodesCreated: cur.nodesCreated + (delta.nodesCreated ?? 0),
    branchesCreated: cur.branchesCreated + (delta.branchesCreated ?? 0),
    viewSpecsUsed: cur.viewSpecsUsed + (delta.viewSpecsUsed ?? 0),
    promotions: cur.promotions + (delta.promotions ?? 0),
    viewSpecBreakdown: { ...cur.viewSpecBreakdown },
    lastSeenAt: Date.now(),
  };
  if (delta.viewSpec) {
    next.viewSpecBreakdown[delta.viewSpec] =
      (next.viewSpecBreakdown[delta.viewSpec] ?? 0) + 1;
  }
  await db().patterns.put({ id: "singleton", ...next });
  return next;
}

// Cross-conversation node index — replaces /api/nodes/index
export type IndexedNode = {
  conversationId: string;
  conversationTitle: string;
  node: ConvNode;
};

export async function indexNodes({
  tag,
  pinnedOnly,
}: {
  tag?: string | null;
  pinnedOnly?: boolean;
}): Promise<{ nodes: IndexedNode[]; tags: { name: string; count: number }[] }> {
  const all = await db().conversations.toArray();
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
  return {
    nodes: out,
    tags: Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}
