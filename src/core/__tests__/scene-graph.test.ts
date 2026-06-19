import { describe, it, expect } from "vitest";
import { SceneGraph, RectNode } from "../scene-graph";

function makeNode(id: number, x = 0, y = 0, w = 10, h = 10, parentId?: number): RectNode {
  return {
    id,
    kind: "rect",
    position: { x, y },
    size: { x: w, y: h },
    color: { r: 1, g: 1, b: 1, a: 1 },
    isHovered: false,
    radius: 0,
    softness: 1,
    gradientColor: { r: 1, g: 1, b: 1, a: 1 },
    gradientMix: 0,
    shadowColor: { r: 0, g: 0, b: 0, a: 0 },
    shadowOffset: { x: 0, y: 0 },
    shadowBlur: 0,
    shadowSpread: 0,
    parentId,
    children: [],
    worldPosition: { x, y },
    clipChildren: false,
    layoutDirty: false,
  };
}

describe("SceneGraph", () => {
  describe("add", () => {
    it("adds a node and returns its index", () => {
      const sg = new SceneGraph();
      const index = sg.add(makeNode(1));
      expect(index).toBe(0);
      expect(sg.count()).toBe(1);
    });

    it("assigns sequential indices", () => {
      const sg = new SceneGraph();
      expect(sg.add(makeNode(1))).toBe(0);
      expect(sg.add(makeNode(2))).toBe(1);
      expect(sg.add(makeNode(3))).toBe(2);
      expect(sg.count()).toBe(3);
    });

    it("registers child with parent", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1));
      sg.add(makeNode(2, 10, 10, 5, 5, 1));

      const parent = sg.getById(1)!;
      expect(parent.children).toContain(2);
    });
  });

  describe("remove", () => {
    it("removes a node by id", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1));
      sg.add(makeNode(2));

      const result = sg.remove(1);
      expect(result).not.toBeNull();
      expect(sg.count()).toBe(1);
      expect(sg.getById(1)).toBeUndefined();
    });

    it("returns null for non-existent id", () => {
      const sg = new SceneGraph();
      expect(sg.remove(999)).toBeNull();
    });

    it("swaps with tail on removal", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1));
      sg.add(makeNode(2));
      sg.add(makeNode(3));

      const result = sg.remove(1)!;
      expect(result.removedIndex).toBe(0);
      expect(result.movedNode?.id).toBe(3);
      expect(sg.getIndex(3)).toBe(0);
    });

    it("removes child from parent's children array", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1));
      sg.add(makeNode(2, 0, 0, 10, 10, 1));

      sg.remove(2);

      const parent = sg.getById(1)!;
      expect(parent.children).not.toContain(2);
    });

    it("orphans children when parent is removed", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1));
      sg.add(makeNode(2, 0, 0, 10, 10, 1));

      sg.remove(1);

      const child = sg.getById(2);
      expect(child).toBeDefined();
      expect(child!.parentId).toBeUndefined();
    });
  });

  describe("getById / getIndex", () => {
    it("retrieves node by id", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(42, 100, 200));

      const node = sg.getById(42);
      expect(node).toBeDefined();
      expect(node!.position.x).toBe(100);
    });

    it("returns undefined for missing id", () => {
      const sg = new SceneGraph();
      expect(sg.getById(1)).toBeUndefined();
      expect(sg.getIndex(1)).toBeUndefined();
    });
  });

  describe("hitTest", () => {
    it("finds node at point", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1, 0, 0, 100, 100));
      sg.computeWorldPositions();

      const hit = sg.hitTest(50, 50);
      expect(hit).toBeDefined();
      expect(hit!.id).toBe(1);
    });

    it("returns undefined when no hit", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1, 0, 0, 10, 10));
      sg.computeWorldPositions();

      expect(sg.hitTest(50, 50)).toBeUndefined();
    });

    it("returns topmost (last) node on overlap", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1, 0, 0, 100, 100));
      sg.add(makeNode(2, 0, 0, 100, 100));
      sg.computeWorldPositions();

      const hit = sg.hitTest(50, 50);
      expect(hit!.id).toBe(2);
    });

    it("uses world positions for hit testing", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1, 100, 100, 200, 200));
      sg.add(makeNode(2, 10, 10, 50, 50, 1));
      sg.computeWorldPositions();

      const hit = sg.hitTest(115, 115);
      expect(hit).toBeDefined();
      expect(hit!.id).toBe(2);
    });
  });

  describe("computeWorldPositions", () => {
    it("sets world position for root nodes", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1, 50, 60));
      sg.computeWorldPositions();

      const node = sg.getById(1)!;
      expect(node.worldPosition.x).toBe(50);
      expect(node.worldPosition.y).toBe(60);
    });

    it("accumulates parent position for children", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1, 100, 100, 200, 200));
      sg.add(makeNode(2, 10, 20, 50, 50, 1));
      sg.computeWorldPositions();

      const child = sg.getById(2)!;
      expect(child.worldPosition.x).toBe(110);
      expect(child.worldPosition.y).toBe(120);
    });

    it("handles deeply nested hierarchy", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1, 10, 10, 200, 200));
      sg.add(makeNode(2, 20, 20, 100, 100, 1));
      sg.add(makeNode(3, 5, 5, 50, 50, 2));
      sg.computeWorldPositions();

      const leaf = sg.getById(3)!;
      expect(leaf.worldPosition.x).toBe(35);
      expect(leaf.worldPosition.y).toBe(35);
    });
  });

  describe("applyLayout", () => {
    it("arranges children in a row", () => {
      const sg = new SceneGraph();
      const parent = makeNode(1, 0, 0, 400, 100);
      parent.layout = { direction: "row", gap: 10, padding: 5 };
      parent.layoutDirty = true;
      sg.add(parent);
      sg.add(makeNode(2, 0, 0, 50, 30, 1));
      sg.add(makeNode(3, 0, 0, 60, 30, 1));

      sg.applyLayout(1);

      const child1 = sg.getById(2)!;
      const child2 = sg.getById(3)!;

      expect(child1.position.x).toBe(5);
      expect(child2.position.x).toBe(65);
    });

    it("arranges children in a column", () => {
      const sg = new SceneGraph();
      const parent = makeNode(1, 0, 0, 100, 400);
      parent.layout = { direction: "column", gap: 10, padding: 5 };
      parent.layoutDirty = true;
      sg.add(parent);
      sg.add(makeNode(2, 0, 0, 30, 50, 1));
      sg.add(makeNode(3, 0, 0, 30, 60, 1));

      sg.applyLayout(1);

      const child1 = sg.getById(2)!;
      const child2 = sg.getById(3)!;

      expect(child1.position.y).toBe(5);
      expect(child2.position.y).toBe(65);
    });

    it("centers children in cross axis", () => {
      const sg = new SceneGraph();
      const parent = makeNode(1, 0, 0, 400, 100);
      parent.layout = { direction: "row", gap: 0, padding: 0, alignItems: "center" };
      parent.layoutDirty = true;
      sg.add(parent);
      sg.add(makeNode(2, 0, 0, 50, 30, 1));

      sg.applyLayout(1);

      const child = sg.getById(2)!;
      expect(child.position.y).toBe(35);
    });

    it("does nothing for node without layout", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1, 0, 0, 100, 100));
      sg.applyLayout(1);
    });
  });

  describe("getChildren", () => {
    it("returns empty array for childless nodes", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1));
      expect(sg.getChildren(1)).toHaveLength(0);
    });

    it("returns child nodes", () => {
      const sg = new SceneGraph();
      sg.add(makeNode(1, 0, 0, 200, 200));
      sg.add(makeNode(2, 0, 0, 50, 50, 1));
      sg.add(makeNode(3, 0, 0, 50, 50, 1));

      const children = sg.getChildren(1);
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id)).toEqual([2, 3]);
    });

    it("returns empty for non-existent id", () => {
      const sg = new SceneGraph();
      expect(sg.getChildren(999)).toHaveLength(0);
    });
  });
});
