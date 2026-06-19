import type { BoxProps, Color4, LayoutProps, NodeHandlers, Vec2 } from "./types";

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
  parentId?: number;
  children: number[];
  worldPosition: Vec2;
  clipChildren: boolean;
  layout?: LayoutProps;
  layoutDirty: boolean;
}

const GRID_CELL_SIZE = 128;

export class SceneGraph {
  private nodes: RectNode[] = [];
  private indexById = new Map<number, number>();
  private gridCells = new Map<number, Set<number>>();
  private gridWidth = 0;
  private gridHeight = 0;
  private gridCols = 0;

  add(node: RectNode): number {
    const index = this.nodes.length;
    this.nodes.push(node);
    this.indexById.set(node.id, index);

    if (node.parentId !== undefined) {
      const parent = this.getById(node.parentId);
      if (parent) {
        parent.children.push(node.id);
      }
    }

    return index;
  }

  remove(id: number): { removedIndex: number; movedNode?: RectNode } | null {
    const index = this.indexById.get(id);
    if (index === undefined) {
      return null;
    }

    const node = this.nodes[index];

    if (node.parentId !== undefined) {
      const parent = this.getById(node.parentId);
      if (parent) {
        const childIdx = parent.children.indexOf(id);
        if (childIdx !== -1) {
          parent.children.splice(childIdx, 1);
        }
      }
    }

    const childrenToRemove = [...node.children];
    for (const childId of childrenToRemove) {
      const child = this.getById(childId);
      if (child) {
        child.parentId = undefined;
      }
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

  getNodeAndIndex(id: number): { node: RectNode; index: number } | undefined {
    const index = this.indexById.get(id);
    if (index === undefined) return undefined;
    return { node: this.nodes[index], index };
  }

  getChildren(id: number): RectNode[] {
    const node = this.getById(id);
    if (!node) {
      return [];
    }
    const children: RectNode[] = [];
    for (const childId of node.children) {
      const child = this.getById(childId);
      if (child) {
        children.push(child);
      }
    }
    return children;
  }

  all(): RectNode[] {
    return this.nodes;
  }

  count(): number {
    return this.nodes.length;
  }

  computeWorldPositions(): void {
    for (const node of this.nodes) {
      if (node.parentId === undefined) {
        this.computeWorldPositionRecursive(node, { x: 0, y: 0 });
      }
    }
  }

  markLayoutDirty(id: number): void {
    const node = this.getById(id);
    if (node) node.layoutDirty = true;
  }

  applyLayout(id: number): void {
    const node = this.getById(id);
    if (!node || !node.layout) {
      return;
    }

    if (!node.layoutDirty) return;

    const children = this.getChildren(id);
    if (children.length === 0) {
      node.layoutDirty = false;
      return;
    }

    const layout = node.layout;
    const padX = layout.paddingX ?? layout.padding ?? 0;
    const padY = layout.paddingY ?? layout.padding ?? 0;
    const gap = layout.gap ?? 0;
    const isRow = layout.direction === "row";

    let cursor = isRow ? padX : padY;
    const crossStart = isRow ? padY : padX;
    const crossSize = isRow
      ? node.size.y - padY * 2
      : node.size.x - padX * 2;

    for (const child of children) {
      const mainSize = isRow ? child.size.x : child.size.y;
      const childCrossSize = isRow ? child.size.y : child.size.x;

      let crossOffset = crossStart;
      if (layout.alignItems === "center") {
        crossOffset = crossStart + (crossSize - childCrossSize) / 2;
      } else if (layout.alignItems === "end") {
        crossOffset = crossStart + crossSize - childCrossSize;
      }

      if (isRow) {
        child.position = { x: cursor, y: crossOffset };
      } else {
        child.position = { x: crossOffset, y: cursor };
      }

      cursor += mainSize + gap;
    }

    node.layoutDirty = false;
  }

  updateGrid(canvasWidth: number, canvasHeight: number): void {
    this.gridWidth = canvasWidth;
    this.gridHeight = canvasHeight;
    this.gridCols = Math.max(1, Math.ceil(canvasWidth / GRID_CELL_SIZE));
    this.gridCells.clear();

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const wx = node.worldPosition.x;
      const wy = node.worldPosition.y;
      const minCol = Math.max(0, Math.floor(wx / GRID_CELL_SIZE));
      const maxCol = Math.max(0, Math.floor((wx + node.size.x) / GRID_CELL_SIZE));
      const minRow = Math.max(0, Math.floor(wy / GRID_CELL_SIZE));
      const maxRow = Math.max(0, Math.floor((wy + node.size.y) / GRID_CELL_SIZE));

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const key = r * this.gridCols + c;
          let cell = this.gridCells.get(key);
          if (!cell) {
            cell = new Set();
            this.gridCells.set(key, cell);
          }
          cell.add(i);
        }
      }
    }
  }

  hitTest(x: number, y: number): RectNode | undefined {
    if (this.gridCols > 0 && this.gridCells.size > 0) {
      const col = Math.floor(x / GRID_CELL_SIZE);
      const row = Math.floor(y / GRID_CELL_SIZE);
      const key = row * this.gridCols + col;
      const cell = this.gridCells.get(key);
      if (!cell) return undefined;

      let best: RectNode | undefined;
      let bestIndex = -1;
      for (const i of cell) {
        const node = this.nodes[i];
        const wx = node.worldPosition.x;
        const wy = node.worldPosition.y;
        if (x >= wx && x <= wx + node.size.x && y >= wy && y <= wy + node.size.y) {
          if (i > bestIndex) {
            bestIndex = i;
            best = node;
          }
        }
      }
      return best;
    }

    for (let i = this.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.nodes[i];
      const wx = node.worldPosition.x;
      const wy = node.worldPosition.y;
      if (x >= wx && x <= wx + node.size.x && y >= wy && y <= wy + node.size.y) {
        return node;
      }
    }
    return undefined;
  }

  private computeWorldPositionRecursive(node: RectNode, parentWorld: Vec2): void {
    node.worldPosition = {
      x: parentWorld.x + node.position.x,
      y: parentWorld.y + node.position.y,
    };

    for (const childId of node.children) {
      const child = this.getById(childId);
      if (child) {
        this.computeWorldPositionRecursive(child, node.worldPosition);
      }
    }
  }
}
