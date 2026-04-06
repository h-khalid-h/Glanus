/**
 * Lightweight in-memory TTL cache for hot-path data.
 *
 * Use for per-request deduplication and short-lived caches
 * (workspace access, user lookups, dashboard aggregations).
 *
 * Not shared across processes — safe for serverless.
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export class MemoryCache {
    private store = new Map<string, CacheEntry<unknown>>();
    private maxSize: number;

    constructor(maxSize = 500) {
        this.maxSize = maxSize;
    }

    get<T>(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value as T;
    }

    set<T>(key: string, value: T, ttlMs: number): void {
        // Evict oldest entries if at capacity
        if (this.store.size >= this.maxSize) {
            const firstKey = this.store.keys().next().value;
            if (firstKey) this.store.delete(firstKey);
        }
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    delete(key: string): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}

// Shared cache instances for different domains
// Short TTL (5s) for auth lookups — covers burst of requests from the same user
export const authCache = new MemoryCache(200);

// Medium TTL (15s) for workspace access checks
export const workspaceCache = new MemoryCache(300);

// Longer TTL (30s) for dashboard aggregations
export const dashboardCache = new MemoryCache(50);
