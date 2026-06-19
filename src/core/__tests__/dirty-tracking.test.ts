import { describe, it, expect } from "vitest";

class DirtyTracker {
  dirtyMin = -1;
  dirtyMax = -1;

  markDirty(index: number): void {
    if (this.dirtyMin === -1 || index < this.dirtyMin) {
      this.dirtyMin = index;
    }
    if (this.dirtyMax === -1 || index > this.dirtyMax) {
      this.dirtyMax = index;
    }
  }

  markAllDirty(count: number): void {
    if (count <= 0) {
      this.dirtyMin = -1;
      this.dirtyMax = -1;
      return;
    }
    this.dirtyMin = 0;
    this.dirtyMax = count - 1;
  }

  clearDirty(): void {
    this.dirtyMin = -1;
    this.dirtyMax = -1;
  }

  isDirty(): boolean {
    return this.dirtyMin !== -1;
  }

  getDirtyRange(): [number, number] | null {
    if (this.dirtyMin === -1) return null;
    return [this.dirtyMin, this.dirtyMax];
  }
}

describe("DirtyTracker", () => {
  it("starts clean", () => {
    const tracker = new DirtyTracker();
    expect(tracker.isDirty()).toBe(false);
    expect(tracker.getDirtyRange()).toBeNull();
  });

  it("tracks single dirty index", () => {
    const tracker = new DirtyTracker();
    tracker.markDirty(5);

    expect(tracker.isDirty()).toBe(true);
    expect(tracker.getDirtyRange()).toEqual([5, 5]);
  });

  it("expands range with multiple marks", () => {
    const tracker = new DirtyTracker();
    tracker.markDirty(5);
    tracker.markDirty(10);
    tracker.markDirty(2);

    expect(tracker.getDirtyRange()).toEqual([2, 10]);
  });

  it("markAllDirty covers entire range", () => {
    const tracker = new DirtyTracker();
    tracker.markAllDirty(100);

    expect(tracker.getDirtyRange()).toEqual([0, 99]);
  });

  it("markAllDirty with 0 count clears", () => {
    const tracker = new DirtyTracker();
    tracker.markDirty(5);
    tracker.markAllDirty(0);

    expect(tracker.isDirty()).toBe(false);
  });

  it("clearDirty resets state", () => {
    const tracker = new DirtyTracker();
    tracker.markDirty(5);
    tracker.clearDirty();

    expect(tracker.isDirty()).toBe(false);
    expect(tracker.getDirtyRange()).toBeNull();
  });

  it("handles sequential mark-clear cycles", () => {
    const tracker = new DirtyTracker();

    tracker.markDirty(3);
    tracker.markDirty(7);
    expect(tracker.getDirtyRange()).toEqual([3, 7]);

    tracker.clearDirty();
    expect(tracker.isDirty()).toBe(false);

    tracker.markDirty(1);
    expect(tracker.getDirtyRange()).toEqual([1, 1]);
  });
});
