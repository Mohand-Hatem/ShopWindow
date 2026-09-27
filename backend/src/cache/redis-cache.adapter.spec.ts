import { Test, TestingModule } from '@nestjs/testing';
import { RedisCacheAdapter, REDIS_CLIENT } from './redis-cache.adapter';
import Redis from 'ioredis';

describe('RedisCacheAdapter (Unit Tests)', () => {
  let adapter: RedisCacheAdapter;
  let mockRedis: Partial<Record<keyof Redis, jest.Mock>>;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
      incr: jest.fn(),
      ttl: jest.fn(),
      ping: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCacheAdapter,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    adapter = module.get<RedisCacheAdapter>(RedisCacheAdapter);
  });

  describe('get<T>()', () => {
    it('should return null when key does not exist in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await adapter.get('missing-key');
      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('missing-key');
    });

    it('should parse and return typed object on cache hit', async () => {
      const mockProduct = { id: '123', name: 'Mechanical Keyboard', price: 99.99 };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockProduct));

      const result = await adapter.get<typeof mockProduct>('prod:detail:123');
      expect(result).toEqual(mockProduct);
      expect(mockRedis.get).toHaveBeenCalledWith('prod:detail:123');
    });

    it('should handle corrupted JSON gracefully and return null', async () => {
      mockRedis.get.mockResolvedValue('not-a-valid-json{');

      const result = await adapter.get('corrupted-key');
      expect(result).toBeNull();
    });
  });

  describe('set<T>()', () => {
    it('should store serialized JSON without TTL when ttlSeconds is not provided', async () => {
      const data = { count: 42 };
      mockRedis.set.mockResolvedValue('OK');

      await adapter.set('stats:count', data);
      expect(mockRedis.set).toHaveBeenCalledWith('stats:count', JSON.stringify(data));
    });

    it('should store serialized JSON with EX option when ttlSeconds is provided', async () => {
      const data = { token: 'abc' };
      mockRedis.set.mockResolvedValue('OK');

      await adapter.set('session:abc', data, 300);
      expect(mockRedis.set).toHaveBeenCalledWith('session:abc', JSON.stringify(data), 'EX', 300);
    });
  });

  describe('del()', () => {
    it('should delete key via redis.del()', async () => {
      mockRedis.del.mockResolvedValue(1);

      await adapter.del('prod:detail:123');
      expect(mockRedis.del).toHaveBeenCalledWith('prod:detail:123');
    });
  });

  describe('delByPattern()', () => {
    it('should iterate with SCAN and delete matching keys in batches', async () => {
      // First iteration returns cursor '42' with 2 keys
      // Second iteration returns cursor '0' (finished) with 1 key
      mockRedis.scan
        .mockResolvedValueOnce(['42', ['prod:list:1', 'prod:list:2']])
        .mockResolvedValueOnce(['0', ['prod:list:3']]);
      mockRedis.del.mockResolvedValue(1);

      await adapter.delByPattern('prod:list:*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.scan).toHaveBeenNthCalledWith(1, '0', 'MATCH', 'prod:list:*', 'COUNT', 100);
      expect(mockRedis.scan).toHaveBeenNthCalledWith(2, '42', 'MATCH', 'prod:list:*', 'COUNT', 100);
      expect(mockRedis.del).toHaveBeenCalledWith('prod:list:1', 'prod:list:2');
      expect(mockRedis.del).toHaveBeenCalledWith('prod:list:3');
    });

    it('should not call del if no matching keys are found', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      await adapter.delByPattern('nonexistent:*');
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'nonexistent:*', 'COUNT', 100);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('incr()', () => {
    it('should atomically increment key and return the new number', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const result = await adapter.incr('counter:version');
      expect(result).toBe(5);
      expect(mockRedis.incr).toHaveBeenCalledWith('counter:version');
    });
  });

  describe('ttl()', () => {
    it('should return remaining seconds when key has a TTL', async () => {
      mockRedis.ttl.mockResolvedValue(285);

      const remaining = await adapter.ttl('prod:detail:slug:test');
      expect(remaining).toBe(285);
      expect(mockRedis.ttl).toHaveBeenCalledWith('prod:detail:slug:test');
    });

    it('should return -1 when key exists without expiration', async () => {
      mockRedis.ttl.mockResolvedValue(-1);

      const remaining = await adapter.ttl('immortal:key');
      expect(remaining).toBe(-1);
    });

    it('should return -2 when key does not exist', async () => {
      mockRedis.ttl.mockResolvedValue(-2);

      const remaining = await adapter.ttl('expired:key');
      expect(remaining).toBe(-2);
    });
  });

  describe('isHealthy()', () => {
    it('should return true when redis.ping() returns PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const healthy = await adapter.isHealthy();
      expect(healthy).toBe(true);
    });

    it('should return false when redis.ping() throws an error', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const healthy = await adapter.isHealthy();
      expect(healthy).toBe(false);
    });
  });

  describe('getListVersion()', () => {
    it('should return 1 when key is not in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);

      const ver = await adapter.getListVersion();
      expect(ver).toBe(1);
      expect(mockRedis.get).toHaveBeenCalledWith('prod:listVer');
    });

    it('should return parsed integer when version exists in Redis', async () => {
      mockRedis.get.mockResolvedValue('7');

      const ver = await adapter.getListVersion();
      expect(ver).toBe(7);
    });

    it('should return 1 when redis throws an error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis offline'));

      const ver = await adapter.getListVersion();
      expect(ver).toBe(1);
    });
  });

  describe('bumpListVersion()', () => {
    it('should call redis.incr and return the new version number', async () => {
      mockRedis.incr.mockResolvedValue(8);

      const ver = await adapter.bumpListVersion();
      expect(ver).toBe(8);
      expect(mockRedis.incr).toHaveBeenCalledWith('prod:listVer');
    });
  });
});
