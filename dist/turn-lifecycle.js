/**
 * Turn-scoped pending-id tracking shared by approvals and user-input.
 * Bumping generation invalidates every outstanding track for that surface.
 */
export class TurnScopedLifecycle {
    pending = new Map();
    generation = 0;
    beginTurn(turnId) {
        this.generation += 1;
        for (const [id, meta] of this.pending) {
            if (meta.turnId !== turnId) {
                this.pending.delete(id);
            }
        }
        return this.generation;
    }
    track(id, turnId, generation) {
        if (generation !== this.generation) {
            return false;
        }
        this.pending.set(id, { turnId });
        return true;
    }
    isLive(id, turnId, generation) {
        if (generation !== this.generation) {
            return false;
        }
        return this.pending.get(id)?.turnId === turnId;
    }
    resolve(id) {
        this.pending.delete(id);
    }
    has(id) {
        return this.pending.has(id);
    }
    disposeTurn(turnId) {
        for (const [id, meta] of this.pending) {
            if (meta.turnId === turnId) {
                this.pending.delete(id);
            }
        }
    }
    disposeAll() {
        this.pending.clear();
        this.generation += 1;
    }
}
