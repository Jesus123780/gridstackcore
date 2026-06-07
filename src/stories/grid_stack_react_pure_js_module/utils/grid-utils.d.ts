import { GridItem } from '../types/types';

interface Node {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
}

export function normalizeNode(raw?: Partial<Node> | any): Node;
export function rectsCollide(a: Node | null, b: Node | null): boolean;
export function cloneLayout(layout?: Partial<Node>[]): GridItem[];
export function dedupeLayoutById(layout?: Partial<Node>[]): GridItem[];
export function inBounds(node: Node | null, cols?: number): boolean;

declare const _default: {
  normalizeNode: typeof normalizeNode;
  rectsCollide: typeof rectsCollide;
  cloneLayout: typeof cloneLayout;
  dedupeLayoutById: typeof dedupeLayoutById;
  inBounds: typeof inBounds;
};

export default _default;
