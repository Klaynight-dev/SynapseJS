import type { BoxProps, Color4, NodeHandlers, Vec2 } from "./types";

export interface RectNode extends BoxProps, NodeHandlers {
  id: number;
  kind: "rect";
  isHovered: boolean;
  radius: number;
  softness: number;
  gradientColor: Color4;
  gradientMix: number;
  shadowColor: Color4;
  shadowOffset: Vec2;
  shadowBlur: number;
  shadowSpread: number;
}

export class SceneGraph {
  private nodes: RectNode[] = [];
  private indexById = new Map<number, number>();

  add(node: RectNode): number {
    const index = this.nodes.length;
    this.nodes.push(node);
    this.indexById.set(node.id, index);
    return index;
  }

  remove(id: number): { removedIndex: number; movedNode?: RectNode } | null {
    const index = this.indexById.get(id);
    if (index === undefined) {
      return null;
    }

    const lastIndex = this.nodes.length - 1;
    const removedIndex = index;
    let movedNode: RectNode | undefined;

    if (index !== lastIndex) {
      const tail = this.nodes[lastIndex];
      this.nodes[index] = tail;
      this.indexById.set(tail.id, index);
      movedNode = tail;
    }

    this.nodes.pop();
    this.indexById.delete(id);
    return { removedIndex, movedNode };
  }

  getById(id: number): RectNode | undefined {
    const index = this.indexById.get(id);
    if (index === undefined) {
      return undefined;
    }
    return this.nodes[index];
  }

  getIndex(id: number): number | undefined {
    return this.indexById.get(id);
  }

  all(): RectNode[] {
    return this.nodes;
  }

  count(): number {
    return this.nodes.length;
  }

  hitTest(x: number, y: number): RectNode | undefined {
    for (let i = this.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.nodes[i];
      const withinX = x >= node.position.x && x <= node.position.x + node.size.x;
      const withinY = y >= node.position.y && y <= node.position.y + node.size.y;
      if (withinX && withinY) {
        return node;
      }
    }
    return undefined;
  }
}
