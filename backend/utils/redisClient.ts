import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log(`[System] Connecting to Redis at ${REDIS_URL}`);

// Primary client for KV operations
export const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null // Required for BullMQ
});

// Subscriber client (Redis requires dedicated connection for Sub)
export const subRedis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null
});

// Publisher client
export const pubRedis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null
});
