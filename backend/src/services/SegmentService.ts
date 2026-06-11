import { DatabaseManager } from '../database/DatabaseManager';
import { logger } from '../utils/logger';

/**
 * Customer segment types
 */
export type SegmentType = 'recorrente' | 'inativo' | 'em_risco' | 'novo' | 'vip';

/**
 * Segment result with customer IDs
 */
export interface SegmentResult {
  segment: SegmentType;
  customerIds: number[];
  customerCount: number;
}

/**
 * Customer in segment with details
 */
export interface SegmentCustomer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  orderCount: number;
  totalSpent: number;
  lastPurchaseDate: Date | null;
  daysSinceLastPurchase: number | null;
}

/**
 * Filters for segmentation
 */
export interface SegmentFilters {
  startDate: string;
  endDate: string;
  businessUnit: 'ecommerce' | 'distributor' | 'all';
}

/**
 * SegmentService implements customer segmentation algorithms
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export class SegmentService {
  constructor(private db: DatabaseManager) {}

  /**
   * Identify all segments for customers in the period
   * Requirement 6.1
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to array of segment results
   */
  async identifySegments(filters: SegmentFilters): Promise<SegmentResult[]> {
    try {
      logger.debug('Identifying customer segments', { filters });

      const segments = await Promise.all([
        this.identifyRecurrent(filters),
        this.identifyInactive(filters),
        this.identifyAtRisk(filters),
        this.identifyNew(filters),
        this.identifyVIP(filters),
      ]);

      logger.debug('Segments identified successfully', {
        segmentCount: segments.length,
      });

      return segments;
    } catch (error) {
      logger.error('Error identifying segments', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Identify recurrent customers (>= 3 orders in period)
   * Requirement 6.2
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to segment result
   */
  async identifyRecurrent(filters: SegmentFilters): Promise<SegmentResult> {
    try {
      logger.debug('Identifying recurrent customers', { filters });

      const whereClauses: string[] = ['p.data_pedido BETWEEN ? AND ?'];
      const params: any[] = [filters.startDate, filters.endDate];

      if (filters.businessUnit !== 'all') {
        whereClauses.push('p.unidade_negocio = ?');
        params.push(filters.businessUnit);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      const sql = `
        SELECT c.id
        FROM clientes c
        INNER JOIN pedidos p ON c.id = p.cliente_id
        ${whereClause}
        GROUP BY c.id
        HAVING COUNT(DISTINCT p.id) >= 3
      `;

      const results = await this.db.query<any>(sql, params);
      const customerIds = results.map((row) => row.id);

      logger.debug('Recurrent customers identified', {
        count: customerIds.length,
      });

      return {
        segment: 'recorrente',
        customerIds,
        customerCount: customerIds.length,
      };
    } catch (error) {
      logger.error('Error identifying recurrent customers', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Identify inactive customers (last purchase > 90 days ago)
   * Requirement 6.3
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to segment result
   */
  async identifyInactive(filters: SegmentFilters): Promise<SegmentResult> {
    try {
      logger.debug('Identifying inactive customers', { filters });

      const whereClauses: string[] = [];
      const params: any[] = [];

      if (filters.businessUnit !== 'all') {
        whereClauses.push('c.unidade_negocio = ?');
        params.push(filters.businessUnit);
      }

      const whereClause =
        whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';

      const sql = `
        SELECT c.id
        FROM clientes c
        LEFT JOIN pedidos p ON c.id = p.cliente_id
          AND p.data_pedido >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        WHERE p.id IS NULL
        ${whereClause}
        GROUP BY c.id
      `;

      const results = await this.db.query<any>(sql, params);
      const customerIds = results.map((row) => row.id);

      logger.debug('Inactive customers identified', {
        count: customerIds.length,
      });

      return {
        segment: 'inativo',
        customerIds,
        customerCount: customerIds.length,
      };
    } catch (error) {
      logger.error('Error identifying inactive customers', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Identify at-risk customers (>= 50% reduction in order frequency)
   * Requirement 6.4
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to segment result
   */
  async identifyAtRisk(filters: SegmentFilters): Promise<SegmentResult> {
    try {
      logger.debug('Identifying at-risk customers', { filters });

      // Calculate period length
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      const periodDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate previous period dates
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - periodDays);

      const whereClauses: string[] = [];
      const params: any[] = [
        filters.startDate,
        filters.endDate,
        prevStartDate.toISOString().split('T')[0],
        prevEndDate.toISOString().split('T')[0],
      ];

      if (filters.businessUnit !== 'all') {
        whereClauses.push('current_orders.unidade_negocio = ?');
        whereClauses.push('previous_orders.unidade_negocio = ?');
        params.push(filters.businessUnit, filters.businessUnit);
      }

      const whereClause =
        whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';

      const sql = `
        SELECT 
          c.id,
          COALESCE(COUNT(DISTINCT current_orders.id), 0) as current_count,
          COALESCE(COUNT(DISTINCT previous_orders.id), 0) as previous_count
        FROM clientes c
        LEFT JOIN pedidos current_orders ON c.id = current_orders.cliente_id
          AND current_orders.data_pedido BETWEEN ? AND ?
        LEFT JOIN pedidos previous_orders ON c.id = previous_orders.cliente_id
          AND previous_orders.data_pedido BETWEEN ? AND ?
        ${whereClause}
        GROUP BY c.id
        HAVING previous_count > 0
          AND current_count < (previous_count * 0.5)
      `;

      const results = await this.db.query<any>(sql, params);
      const customerIds = results.map((row) => row.id);

      logger.debug('At-risk customers identified', {
        count: customerIds.length,
      });

      return {
        segment: 'em_risco',
        customerIds,
        customerCount: customerIds.length,
      };
    } catch (error) {
      logger.error('Error identifying at-risk customers', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Identify new customers (first purchase in period)
   * Requirement 6.5
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to segment result
   */
  async identifyNew(filters: SegmentFilters): Promise<SegmentResult> {
    try {
      logger.debug('Identifying new customers', { filters });

      const whereClauses: string[] = [];
      const params: any[] = [filters.startDate, filters.endDate];

      if (filters.businessUnit !== 'all') {
        whereClauses.push('p.unidade_negocio = ?');
        params.push(filters.businessUnit);
      }

      const whereClause =
        whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';

      const sql = `
        SELECT c.id
        FROM clientes c
        INNER JOIN (
          SELECT cliente_id, MIN(data_pedido) as first_purchase_date
          FROM pedidos
          GROUP BY cliente_id
        ) first_purchase ON c.id = first_purchase.cliente_id
        INNER JOIN pedidos p ON c.id = p.cliente_id
        WHERE first_purchase.first_purchase_date BETWEEN ? AND ?
        ${whereClause}
        GROUP BY c.id
      `;

      const results = await this.db.query<any>(sql, params);
      const customerIds = results.map((row) => row.id);

      logger.debug('New customers identified', {
        count: customerIds.length,
      });

      return {
        segment: 'novo',
        customerIds,
        customerCount: customerIds.length,
      };
    } catch (error) {
      logger.error('Error identifying new customers', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Identify VIP customers (top 10% by total spent)
   * Requirement 6.6
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to segment result
   */
  async identifyVIP(filters: SegmentFilters): Promise<SegmentResult> {
    try {
      logger.debug('Identifying VIP customers', { filters });

      const whereClauses: string[] = ['p.data_pedido BETWEEN ? AND ?'];
      const params: any[] = [filters.startDate, filters.endDate];

      if (filters.businessUnit !== 'all') {
        whereClauses.push('p.unidade_negocio = ?');
        params.push(filters.businessUnit);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      // First, get total customer count to calculate top 10%
      const countSql = `
        SELECT COUNT(DISTINCT c.id) as total
        FROM clientes c
        INNER JOIN pedidos p ON c.id = p.cliente_id
        ${whereClause}
      `;

      const [countResult] = await this.db.query<any>(countSql, params);
      const totalCustomers = countResult?.total || 0;
      const vipLimit = Math.ceil(totalCustomers * 0.1);

      if (vipLimit === 0) {
        return {
          segment: 'vip',
          customerIds: [],
          customerCount: 0,
        };
      }

      // Get top 10% by total spent
      const sql = `
        SELECT c.id
        FROM clientes c
        INNER JOIN pedidos p ON c.id = p.cliente_id
        ${whereClause}
        GROUP BY c.id
        ORDER BY SUM(p.valor_total) DESC
        LIMIT ?
      `;

      const vipParams = [...params, vipLimit];
      const results = await this.db.query<any>(sql, vipParams);
      const customerIds = results.map((row) => row.id);

      logger.debug('VIP customers identified', {
        count: customerIds.length,
      });

      return {
        segment: 'vip',
        customerIds,
        customerCount: customerIds.length,
      };
    } catch (error) {
      logger.error('Error identifying VIP customers', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Get full customer details for a specific segment
   * Requirement 6.1
   * 
   * @param segmentType - Type of segment
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to array of customers in segment
   */
  async getSegmentCustomers(
    segmentType: SegmentType,
    filters: SegmentFilters
  ): Promise<SegmentCustomer[]> {
    try {
      logger.debug('Getting segment customers', { segmentType, filters });

      // Get segment result
      let segmentResult: SegmentResult;

      switch (segmentType) {
        case 'recorrente':
          segmentResult = await this.identifyRecurrent(filters);
          break;
        case 'inativo':
          segmentResult = await this.identifyInactive(filters);
          break;
        case 'em_risco':
          segmentResult = await this.identifyAtRisk(filters);
          break;
        case 'novo':
          segmentResult = await this.identifyNew(filters);
          break;
        case 'vip':
          segmentResult = await this.identifyVIP(filters);
          break;
        default:
          throw new Error(`Unknown segment type: ${segmentType}`);
      }

      if (segmentResult.customerIds.length === 0) {
        return [];
      }

      // Get customer details
      const sql = `
        SELECT 
          c.id,
          c.nome as name,
          c.email,
          c.telefone as phone,
          c.whatsapp,
          c.cidade as city,
          c.estado as state,
          COUNT(DISTINCT p.id) as order_count,
          COALESCE(SUM(p.valor_total), 0) as total_spent,
          MAX(p.data_pedido) as last_purchase_date,
          DATEDIFF(CURDATE(), MAX(p.data_pedido)) as days_since_last_purchase
        FROM clientes c
        LEFT JOIN pedidos p ON c.id = p.cliente_id
        WHERE c.id IN (?)
        GROUP BY c.id, c.nome, c.email, c.telefone, c.whatsapp, c.cidade, c.estado
        ORDER BY total_spent DESC
      `;

      const results = await this.db.query<any>(sql, [segmentResult.customerIds]);

      return results.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        whatsapp: row.whatsapp,
        city: row.city,
        state: row.state,
        orderCount: parseInt(row.order_count, 10),
        totalSpent: parseFloat(row.total_spent),
        lastPurchaseDate: row.last_purchase_date ? new Date(row.last_purchase_date) : null,
        daysSinceLastPurchase: row.days_since_last_purchase
          ? parseInt(row.days_since_last_purchase, 10)
          : null,
      }));
    } catch (error) {
      logger.error('Error getting segment customers', {
        error: error instanceof Error ? error.message : String(error),
        segmentType,
        filters,
      });
      throw error;
    }
  }
}
