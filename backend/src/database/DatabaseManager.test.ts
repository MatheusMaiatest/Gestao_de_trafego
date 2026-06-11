import { DatabaseManager } from './DatabaseManager';
import mysql from 'mysql2/promise';

// Mock mysql2/promise
jest.mock('mysql2/promise');
jest.mock('../utils/logger');

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  let mockPool: any;
  let mockConnection: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock connection
    mockConnection = {
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    // Create mock pool
    mockPool = {
      execute: jest.fn(),
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      end: jest.fn().mockResolvedValue(undefined),
    };

    // Mock createPool to return our mock pool
    (mysql.createPool as jest.Mock).mockReturnValue(mockPool);

    // Set environment variables
    process.env.DB_HOST = 'test-host';
    process.env.DB_PORT = '3306';
    process.env.DB_USER = 'test-user';
    process.env.DB_PASS = 'test-pass';
    process.env.DB_NAME = 'test-db';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASS;
    delete process.env.DB_NAME;
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      dbManager = new DatabaseManager();
      
      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'test-host',
          port: 3306,
          user: 'test-user',
          password: 'test-pass',
          database: 'test-db',
          connectionLimit: 10,
          connectTimeout: 30000,
          queueLimit: 20,
        })
      );
    });

    it('should initialize with custom configuration', () => {
      dbManager = new DatabaseManager({
        host: 'custom-host',
        port: 3307,
        user: 'custom-user',
        password: 'custom-pass',
        database: 'custom-db',
        connectionLimit: 15,
        connectTimeout: 40000,
        queueLimit: 25,
      });

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'custom-host',
          port: 3307,
          user: 'custom-user',
          password: 'custom-pass',
          database: 'custom-db',
          connectionLimit: 15,
          connectTimeout: 40000,
          queueLimit: 25,
        })
      );
    });

    it('should throw error when required config is missing', () => {
      delete process.env.DB_HOST;
      
      expect(() => new DatabaseManager()).toThrow(
        'Database configuration incomplete: DB_HOST, DB_USER, and DB_NAME are required'
      );
    });

    it('should configure auto-reconnect', () => {
      dbManager = new DatabaseManager();

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
          waitForConnections: true,
        })
      );
    });
  });

  describe('query', () => {
    beforeEach(() => {
      dbManager = new DatabaseManager();
    });

    it('should execute query and return results', async () => {
      const mockResults = [{ id: 1, name: 'Test' }];
      mockPool.execute.mockResolvedValue([mockResults, []]);

      const results = await dbManager.query('SELECT * FROM test');

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM test', []);
      expect(results).toEqual(mockResults);
    });

    it('should execute query with parameters', async () => {
      const mockResults = [{ id: 1, name: 'Test' }];
      mockPool.execute.mockResolvedValue([mockResults, []]);

      const results = await dbManager.query('SELECT * FROM test WHERE id = ?', [1]);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM test WHERE id = ?', [1]);
      expect(results).toEqual(mockResults);
    });

    it('should handle query errors', async () => {
      mockPool.execute.mockRejectedValue(new Error('Query failed'));

      await expect(dbManager.query('INVALID SQL')).rejects.toThrow('Query failed');
    });

    it('should throw error if pool is not initialized', async () => {
      // Close the pool
      await dbManager.close();

      await expect(dbManager.query('SELECT 1')).rejects.toThrow('Database pool not initialized');
    });
  });

  describe('transaction', () => {
    beforeEach(() => {
      dbManager = new DatabaseManager();
    });

    it('should execute callback within transaction and commit', async () => {
      const mockResults = { success: true };
      const callback = jest.fn().mockResolvedValue(mockResults);

      const result = await dbManager.transaction(callback);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(result).toEqual(mockResults);
    });

    it('should rollback transaction on error', async () => {
      const callback = jest.fn().mockRejectedValue(new Error('Transaction failed'));

      await expect(dbManager.transaction(callback)).rejects.toThrow('Transaction failed');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    it('should release connection even if commit fails', async () => {
      const callback = jest.fn().mockResolvedValue({ success: true });
      mockConnection.commit.mockRejectedValue(new Error('Commit failed'));

      await expect(dbManager.transaction(callback)).rejects.toThrow('Commit failed');

      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('getConnection and releaseConnection', () => {
    beforeEach(() => {
      dbManager = new DatabaseManager();
    });

    it('should get connection from pool', async () => {
      const connection = await dbManager.getConnection();

      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(connection).toBe(mockConnection);
    });

    it('should release connection back to pool', () => {
      dbManager.releaseConnection(mockConnection);

      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should handle connection acquisition errors', async () => {
      mockPool.getConnection.mockRejectedValue(new Error('Connection failed'));

      await expect(dbManager.getConnection()).rejects.toThrow('Connection failed');
    });
  });

  describe('close', () => {
    beforeEach(() => {
      dbManager = new DatabaseManager();
    });

    it('should close the connection pool', async () => {
      await dbManager.close();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle errors when closing pool', async () => {
      mockPool.end.mockRejectedValue(new Error('Close failed'));

      await expect(dbManager.close()).rejects.toThrow('Close failed');
    });

    it('should not throw when closing non-existent pool', async () => {
      await dbManager.close();
      
      // Close again - should not throw
      await expect(dbManager.close()).resolves.toBeUndefined();
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      dbManager = new DatabaseManager();
    });

    it('should return true when connection test succeeds', async () => {
      mockPool.execute.mockResolvedValue([[{ test: 1 }], []]);

      const result = await dbManager.testConnection();

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT 1 as test', []);
      expect(result).toBe(true);
    });

    it('should return false when connection test fails', async () => {
      mockPool.execute.mockRejectedValue(new Error('Connection failed'));

      const result = await dbManager.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty query results', async () => {
      dbManager = new DatabaseManager();
      mockPool.execute.mockResolvedValue([[], []]);

      const results = await dbManager.query('SELECT * FROM empty_table');

      expect(results).toEqual([]);
    });

    it('should handle null parameters', async () => {
      dbManager = new DatabaseManager();
      const mockResults = [{ id: 1 }];
      mockPool.execute.mockResolvedValue([mockResults, []]);

      const results = await dbManager.query('SELECT * FROM test WHERE name IS NULL', [null]);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM test WHERE name IS NULL', [null]);
      expect(results).toEqual(mockResults);
    });

    it('should use default port when DB_PORT is not a valid number', () => {
      process.env.DB_PORT = 'invalid';
      
      dbManager = new DatabaseManager();

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 3306, // Should default to 3306
        })
      );
    });
  });
});
