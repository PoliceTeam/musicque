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

const getSecondsUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
};

const saveStrokeToRedis = async (roomId, stroke) => {
  const key = `board:${roomId}`;
  const strokeJson = JSON.stringify(stroke);

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
  const key = `board:${roomId}`;
  
  if (useMemoryStore || !redisClient) {
    if (!memoryStore.has(key)) return [];
    return Array.from(memoryStore.get(key).values()).map(s => JSON.parse(s));
  }

  try {
    const data = await redisClient.hgetall(key);
    if (Object.keys(data).length > 0) {
      // reset TTL on read
      await redisClient.expire(key, getSecondsUntilMidnight());
    }
    return Object.values(data).map(s => JSON.parse(s));
  } catch (error) {
    console.error('Redis hgetall error', error);
    return [];
  }
};

const clearBoardInRedis = async (roomId) => {
  const key = `board:${roomId}`;
  
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

// Append a single point to an existing stroke (incremental update)
const appendPointToStroke = async (roomId, strokeId, point) => {
  const key = `board:${roomId}`;

  if (useMemoryStore || !redisClient) {
    if (memoryStore.has(key) && memoryStore.get(key).has(strokeId)) {
      const stroke = JSON.parse(memoryStore.get(key).get(strokeId));
      stroke.points.push(point);
      memoryStore.get(key).set(strokeId, JSON.stringify(stroke));
    }
    return;
  }

  try {
    const raw = await redisClient.hget(key, strokeId);
    if (raw) {
      const stroke = JSON.parse(raw);
      stroke.points.push(point);
      await redisClient.hset(key, strokeId, JSON.stringify(stroke));
    }
  } catch (error) {
    console.error('Redis appendPoint error', error);
  }
};

const undoStrokeInRedis = async (roomId, strokeId) => {
  const key = `board:${roomId}`;
  
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
  appendPointToStroke,
  undoStrokeInRedis,
};
