/**
 * Shared Redis client for auth operations.
 *
 * Uses a lazy, module-level singleton so all server-side imports share one
 * Redis connection.  The client is optional: when REDIS_URL is absent or the
 * connection fails every operation degrades gracefully (see each function).
 */

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

let _client: RedisClientType | null = null;
let _ready = false;

export async function getAuthRedis(): Promise<RedisClientType | null> {
    if (!process.env.REDIS_URL) return null;
    if (_client && _ready) return _client;

    try {
        _client = createClient({
            url: process.env.REDIS_URL,
            socket: { reconnectStrategy: false, connectTimeout: 3_000 },
        }) as RedisClientType;

        _client.on('error', () => { _ready = false; });
        _client.on('ready', () => { _ready = true; });

        await _client.connect();
        return _client;
    } catch {
        return null;
    }
}
