import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
  connectTimeout?: number;
  queueLimit?: number;
}

/**
 * DatabaseManager class handles MySQL connection pooling and query execution
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 19.1, 19.2
 */
export class DatabaseManager {
  private pool: mysql.Pool | null = null;
  private config: DatabaseConfig;

  /**
   * Constructor accepting configuration from environment variables
   * Requirement 1.1: Read credentials from environment variables
   */
  constructor(config?: Partial<DatabaseConfig>) {
    // Load configuration from environment variables with defaults
    const portValue = config?.port || parseInt(process.env.DB_PORT || '3306', 10);
    
    this.config = {
      host: config?.host || process.env.DB_HOST || '',
      port: isNaN(portValue) ? 3306 : portValue, // Default to 3306 if port is invalid
      user: config?.user || process.env.DB_USER || '',
      password: config?.password || process.env.DB_PASS || '',
      database: config?.database || process.env.DB_NAME || '',
      connectionLimit: config?.connectionLimit || 10, // 10 max connections as specified
      connectTimeout: config?.connectTimeout || 30000, // 30s timeout as specified
      queueLimit: config?.queueLimit || 20, // 20 queue limit as specified
    };

    // Validate required configuration
    if (!this.config.host || !this.config.user || !this.config.database) {
      const error = 'Database configuration incomplete: DB_HOST, DB_USER, and DB_NAME are required';
      logger.error(error);
      throw new Error(error);
    }

    // Initialize connection pool
    this.initializePool();
  }

  /**
   * Initialize MySQL connection pool with auto-reconnect
   * Requirements 1.2, 1.4: Establish connection and maintain pool
   */
  private initializePool(): void {
    try {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        connectionLimit: this.config.connectionLimit,
        connectTimeout: this.config.connectTimeout,
        queueLimit: this.config.queueLimit,
        enableKeepAlive: true, // Auto-reconnect feature
        keepAliveInitialDelay: 0,
        waitForConnections: true,
      });

      logger.info('Database connection pool initialized successfully', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        connectionLimit: this.config.connectionLimit,
      });
    } catch (error) {
      // Requirement 19.1: Log connection errors
      logger.error('Failed to initialize database connection pool', {
        error: error instanceof Error ? error.message : String(error),
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
      });
      throw error;
    }
  }

  /**
   * Execute a SQL query with parameters
   * Requirement 1.5: Return results or error within 5 seconds
   * Requirement 19.2: Log query errors
   * 
   * @param sql - SQL query string (supports prepared statements with ?)
   * @param params - Query parameters (optional)
   * @returns Promise resolving to query results as array
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      const error = 'Database pool not initialized';
      logger.error(error);
      throw new Error(error);
    }

    const startTime = Date.now();

    try {
      // Execute query with 5-second timeout as per requirement 1.5
      const [rows] = await this.pool.execute(sql, params || []);
      
      const executionTime = Date.now() - startTime;
      
      // Log slow queries (>2 seconds as per design doc)
      if (executionTime > 2000) {
        logger.warn('Slow query detected', {
          sql,
          executionTime: `${executionTime}ms`,
          params: params ? '[REDACTED]' : undefined,
        });
      }

      // Log debug level query execution if configured
      if (process.env.LOG_LEVEL === 'debug') {
        logger.debug('Query executed', {
          sql,
          executionTime: `${executionTime}ms`,
          rowCount: Array.isArray(rows) ? rows.length : 0,
        });
      }

      return rows as T[];
    } catch (error) {
      // Requirement 19.2: Log query errors
      logger.error('Database query error', {
        sql,
        error: error instanceof Error ? error.message : String(error),
        params: params ? '[REDACTED]' : undefined,
      });
      throw error;
    }
  }

  /**
   * Execute a callback function within a database transaction
   * Requirement 1.3: Transaction management
   * 
   * @param callback - Async function to execute within transaction
   * @returns Promise resolving to callback result
   */
  async transaction<T>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      const error = 'Database pool not initialized';
      logger.error(error);
      throw new Error(error);
    }

    const connection = await this.pool.getConnection();

    try {
      // Start transaction
      await connection.beginTransaction();
      logger.debug('Transaction started');

      // Execute callback with connection
      const result = await callback(connection);

      // Commit transaction
      await connection.commit();
      logger.debug('Transaction committed');

      return result;
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      logger.error('Transaction rolled back', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      // Always release connection back to pool
      connection.release();
    }
  }

  /**
   * Get a connection from the pool for manual management
   * Requirement 1.3: Manual connection management
   * 
   * @returns Promise resolving to database connection
   */
  async getConnection(): Promise<mysql.PoolConnection> {
    if (!this.pool) {
      const error = 'Database pool not initialized';
      logger.error(error);
      throw new Error(error);
    }

    try {
      const connection = await this.pool.getConnection();
      logger.debug('Connection acquired from pool');
      return connection;
    } catch (error) {
      // Requirement 19.1: Log connection errors
      logger.error('Failed to get connection from pool', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Release a manually acquired connection back to the pool
   * Requirement 1.3: Manual connection management
   * 
   * @param connection - Connection to release
   */
  releaseConnection(connection: mysql.PoolConnection): void {
    try {
      connection.release();
      logger.debug('Connection released to pool');
    } catch (error) {
      logger.error('Failed to release connection', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Close the connection pool gracefully
   * Requirements 1.4, 19.1: Graceful shutdown with logging
   * 
   * @returns Promise resolving when pool is closed
   */
  async close(): Promise<void> {
    if (!this.pool) {
      logger.warn('Attempted to close non-existent database pool');
      return;
    }

    try {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection pool closed successfully');
    } catch (error) {
      // Requirement 19.1: Log connection errors
      logger.error('Error closing database pool', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Test database connection
   * Requirement 1.2: Establish connection with error handling
   * 
   * @returns Promise resolving to true if connection is successful
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1 as test');
      logger.info('Database connection test successful');
      return true;
    } catch (error) {
      // Requirement 1.3: Log connection failure
      logger.error('Database connection test failed', {
        error: error instanceof Error ? error.message : String(error),
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
      });
      return false;
    }
  }
}
