export type NodeType = "file" | "directory";

export interface FileNode {
  path: string;
  type: NodeType;
  content?: string;
}
