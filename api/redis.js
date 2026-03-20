let Redis;
try {
  Redis = require('ioredis');
} catch (e) {
  console.warn('ioredis module not found. Falling back to memory store.');
}

// Fallback to memory store if Redis is unavailable or fails to connect
let redisClient = null;
let useMemoryStore = false;
const memoryStore = new Map(); // Simple memory fallback Map<string, Map<string, string>>

try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      // Don't retry more than 3 times, fallback to memory
      if (times > 3) {
        console.warn('Redis connection failed too many times, falling back to memory store.');
        useMemoryStore = true;
        return null;
      }
      return Math.min(times * 50, 2000);
    }
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error', err.message);
  });
  
  redisClient.on('connect', () => {
    console.log('Connected to Redis (PoliBoard)');
    useMemoryStore = false;
  });
} catch (error) {
  console.warn('Failed to initialize Redis, using memory store fallback');
  useMemoryStore = true;
}

const REDIS_PREFIX = 'musicque-';

// In-memory buffer for batching Redis writes on high-freq draw:move
const pointBatchBuffer = new Map(); // Map<roomId, Map<strokeId, Point[]>>

const getSecondsUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
};

const saveStrokeToRedis = async (roomId, stroke) => {
  const key = `${REDIS_PREFIX}board:${roomId}`;
  const strokeJson = JSON.stringify(stroke);

  // Clear any pending batched points for this stroke since we are overwriting it
  if (pointBatchBuffer.has(roomId)) {
    pointBatchBuffer.get(roomId).delete(stroke.id);
  }

  if (useMemoryStore || !redisClient) {
    if (!memoryStore.has(key)) memoryStore.set(key, new Map());
    memoryStore.get(key).set(stroke.id, strokeJson);
    return;
  }

  try {
    await redisClient.hset(key, stroke.id, strokeJson);
    await redisClient.expire(key, getSecondsUntilMidnight());
  } catch (error) {
    console.error('Redis hset error', error);
  }
};

const getBoardData = async (roomId) => {
  const key = `${REDIS_PREFIX}board:${roomId}`;
  
  if (useMemoryStore || !redisClient) {
    if (!memoryStore.has(key)) return [];
    return Array.from(memoryStore.get(key).values()).map(s => JSON.parse(s));
  }

  try {
    const data = await redisClient.hgetall(key);
    return Object.values(data).map(s => JSON.parse(s));
  } catch (error) {
    console.error('Redis hgetall error', error);
    return [];
  }
};

const clearBoardInRedis = async (roomId) => {
  const key = `${REDIS_PREFIX}board:${roomId}`;
  
  if (useMemoryStore || !redisClient) {
    memoryStore.delete(key);
    return;
  }

  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Redis del error', error);
  }
};

// Clear ALL board data (used by midnight scheduler)
const clearAllBoards = async () => {
  // Memory store: delete all board keys
  if (useMemoryStore || !redisClient) {
    const keysToDelete = [];
    for (const key of memoryStore.keys()) {
      if (key.startsWith(`${REDIS_PREFIX}board:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => memoryStore.delete(k));
    console.log(`[Midnight Clear] Cleared ${keysToDelete.length} boards from memory store`);
    return keysToDelete.length;
  }

  // Redis: scan and delete all board keys
  try {
    let cursor = '0';
    let totalDeleted = 0;
    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', `${REDIS_PREFIX}board:*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisClient.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');
    console.log(`[Midnight Clear] Cleared ${totalDeleted} boards from Redis`);
    return totalDeleted;
  } catch (error) {
    console.error('[Midnight Clear] Redis scan/del error', error);
    return 0;
  }
};

// Periodically flush buffered points to Redis (Phase 1 Optimization)
const flushPointBuffer = async () => {
  if (useMemoryStore || !redisClient || pointBatchBuffer.size === 0) return;

  // Clone active batches to flush, clear original
  const batches = new Map(pointBatchBuffer);
  pointBatchBuffer.clear();

  for (const [roomId, strokes] of batches.entries()) {
    const key = `${REDIS_PREFIX}board:${roomId}`;
    for (const [strokeId, points] of strokes.entries()) {
      try {
        const raw = await redisClient.hget(key, strokeId);
        if (raw) {
          const stroke = JSON.parse(raw);
          if (stroke.type && stroke.type !== 'freehand') {
            stroke.points[1] = points[points.length - 1]; // Shapes: just keep latest end point
          } else {
            stroke.points.push(...points); // Freehand: append all batched points
          }
          await redisClient.hset(key, strokeId, JSON.stringify(stroke));
        }
      } catch (err) {
        console.error('Redis batch append error', err);
      }
    }
  }
};

setInterval(flushPointBuffer, 200);

// Append a single point to an existing stroke (incremental update)
// For shapes (rect, circle, line, caro*), replaces points[1] instead of pushing
const appendPointToStroke = async (roomId, strokeId, point) => {
  const key = `${REDIS_PREFIX}board:${roomId}`;

  if (useMemoryStore || !redisClient) {
    // Memory store handles synchronous access, no need to batch
    if (memoryStore.has(key) && memoryStore.get(key).has(strokeId)) {
      const stroke = JSON.parse(memoryStore.get(key).get(strokeId));
      if (stroke.type && stroke.type !== 'freehand') {
        stroke.points[1] = point; // Shapes: replace end point
      } else {
        stroke.points.push(point); // Freehand: append
      }
      memoryStore.get(key).set(strokeId, JSON.stringify(stroke));
    }
    return;
  }

  // Phase 1: Instead of expensive hget/hset per point, buffer it
  if (!pointBatchBuffer.has(roomId)) {
    pointBatchBuffer.set(roomId, new Map());
  }
  const roomBuffer = pointBatchBuffer.get(roomId);
  
  if (!roomBuffer.has(strokeId)) {
    roomBuffer.set(strokeId, []);
  }
  roomBuffer.get(strokeId).push(point);
};

const undoStrokeInRedis = async (roomId, strokeId) => {
  const key = `${REDIS_PREFIX}board:${roomId}`;
  
  if (useMemoryStore || !redisClient) {
    if (memoryStore.has(key)) {
      memoryStore.get(key).delete(strokeId);
    }
    return;
  }

  try {
    await redisClient.hdel(key, strokeId);
  } catch (error) {
    console.error('Redis hdel error', error);
  }
};

module.exports = {
  saveStrokeToRedis,
  getBoardData,
  clearBoardInRedis,
  clearAllBoards,
  appendPointToStroke,
  undoStrokeInRedis,
};
