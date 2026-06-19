export interface WorkerUpdateMessage {
  type: "update";
  positions: Float32Array;
  velocities: Float32Array;
  count: number;
  boundsX: number;
  boundsY: number;
  sizeX: number;
  sizeY: number;
}

export interface WorkerResultMessage {
  type: "result";
  positions: Float32Array;
  velocities: Float32Array;
}

export interface WorkerInitMessage {
  type: "init";
}

const workerCode = `
self.onmessage = function(e) {
  const msg = e.data;
  if (msg.type !== 'update') return;

  const positions = msg.positions;
  const velocities = msg.velocities;
  const count = msg.count;
  const maxX = Math.max(0, msg.boundsX - msg.sizeX);
  const maxY = Math.max(0, msg.boundsY - msg.sizeY);

  for (let i = 0; i < count; i++) {
    const pi = i * 2;
    let px = positions[pi] + velocities[pi];
    let py = positions[pi + 1] + velocities[pi + 1];

    if (px <= 0 || px >= maxX) {
      velocities[pi] *= -1;
      px = Math.max(0, Math.min(px, maxX));
    }

    if (py <= 0 || py >= maxY) {
      velocities[pi + 1] *= -1;
      py = Math.max(0, Math.min(py, maxY));
    }

    positions[pi] = px;
    positions[pi + 1] = py;
  }

  self.postMessage({
    type: 'result',
    positions: positions,
    velocities: velocities
  }, [positions.buffer, velocities.buffer]);
};
`;

export class UpdateWorker {
  private worker: Worker;
  private pendingResolve: ((result: WorkerResultMessage) => void) | null = null;

  constructor() {
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    this.worker = new Worker(url);
    URL.revokeObjectURL(url);

    this.worker.onmessage = (e: MessageEvent<WorkerResultMessage>) => {
      if (this.pendingResolve && e.data.type === "result") {
        this.pendingResolve(e.data);
        this.pendingResolve = null;
      }
    };
  }

  update(
    positions: Float32Array,
    velocities: Float32Array,
    count: number,
    boundsX: number,
    boundsY: number,
    sizeX: number,
    sizeY: number
  ): Promise<WorkerResultMessage> {
    return new Promise((resolve) => {
      this.pendingResolve = resolve;

      const byteLen = count * 2 * 4;
      const posBuf = positions.buffer.slice(0, byteLen);
      const velBuf = velocities.buffer.slice(0, byteLen);

      const msg: WorkerUpdateMessage = {
        type: "update",
        positions: new Float32Array(posBuf),
        velocities: new Float32Array(velBuf),
        count,
        boundsX,
        boundsY,
        sizeX,
        sizeY,
      };

      this.worker.postMessage(msg, [posBuf, velBuf]);
    });
  }

  destroy(): void {
    this.worker.terminate();
  }
}
