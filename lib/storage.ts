import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import type { Conversation, ConvNode, UsagePattern } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const CONV_DIR = path.join(DATA_DIR, "conversations");
const PATTERN_FILE = path.join(DATA_DIR, "patterns.json");

async function ensureDirs() {
  await fs.mkdir(CONV_DIR, { recursive: true });
}

export async function listConversations(): Promise<Conversation[]> {
  await ensureDirs();
  const files = await fs.readdir(CONV_DIR);
  const out: Conversation[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(CONV_DIR, f), "utf-8");
      out.push(JSON.parse(raw));
    } catch {}
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(path.join(CONV_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await ensureDirs();
  conv.updatedAt = Date.now();
  await fs.writeFile(
    path.join(CONV_DIR, `${conv.id}.json`),
    JSON.stringify(conv, null, 2),
    "utf-8"
  );
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    await fs.unlink(path.join(CONV_DIR, `${id}.json`));
  } catch {}
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
  const path: ConvNode[] = [];
  let cur: ConvNode | undefined = conv.nodes[nodeId];
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? conv.nodes[cur.parentId] : undefined;
  }
  return path;
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
  await ensureDirs();
  try {
    const raw = await fs.readFile(PATTERN_FILE, "utf-8");
    return { ...DEFAULT_PATTERN, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PATTERN };
  }
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
  await fs.writeFile(PATTERN_FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
