export type NodeKind = "user" | "assistant" | "note";

export interface ConvNode {
  id: string;
  kind: NodeKind;
  text: string;
  parentId: string | null;
  children: string[];
  promoted?: boolean;
  contextSnippet?: string;
  memo?: string;
  tags?: string[];
  pinned?: boolean;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  rootId: string;
  nodes: Record<string, ConvNode>;
  createdAt: number;
  updatedAt: number;
}

export interface UsagePattern {
  conversationsCreated: number;
  nodesCreated: number;
  branchesCreated: number;
  viewSpecsUsed: number;
  promotions: number;
  viewSpecBreakdown: Record<string, number>;
  lastSeenAt: number;
}

export type ViewSpecKind = "summary" | "threeLine" | "counter" | "nextQuestions";

export interface ViewSpecResult {
  kind: ViewSpecKind;
  text: string;
}
