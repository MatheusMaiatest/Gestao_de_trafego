import { DatabaseManager } from '../database/DatabaseManager';
import { logger } from '../utils/logger';

/**
 * Geographic location metrics
 */
export interface LocationMetrics {
  location: string;
  customerCount: number;
  totalRevenue: number;
  averageTicket: number;
  orderCount: number;
}

/**
 * Customer in a location
 */
export interface LocationCustomer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  totalSpent: number;
  orderCount: number;
}

/**
 * Filters for geolocation analysis
 */
export interface GeolocationFilters {
  startDate: string;
  endDate: string;
  businessUnit: 'ecommerce' | 'distributor' | 'all';
  states?: string[];
}

/**
 * GeolocationService handles geographic aggregation and analysis
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */
export class GeolocationService {
  constructor(private db: DatabaseManager) {}

  /**
   * Aggregate customers and revenue by state
   * Requirements: 16.1, 16.2, 16.4, 16.6
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to array of state metrics
   */
  async aggregateByState(filters: GeolocationFilters): Promise<LocationMetrics[]> {
    try {
      logger.debug('Aggregating by state', { filters });

      const whereClauses: string[] = ['p.data_pedido BETWEEN ? AND ?'];
      const params: any[] = [filters.startDate, filters.endDate];

      if (filters.businessUnit !== 'all') {
        whereClauses.push('p.unidade_negocio = ?');
        params.push(filters.businessUnit);
      }

      // Add state filter if provided
      if (filters.states && filters.states.length > 0) {
        whereClauses.push('c.estado IN (?)');
        params.push(filters.states);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      const sql = `
        SELECT 
          c.estado as location,
          COUNT(DISTINCT c.id) as customer_count,
          COALESCE(SUM(p.valor_total), 0) as total_revenue,
          COALESCE(AVG(p.valor_total), 0) as average_ticket,
          COUNT(DISTINCT p.id) as order_count
        FROM clientes c
        INNER JOIN pedidos p ON c.id = p.cliente_id
        ${whereClause}
        GROUP BY c.estado
        HAVING c.estado IS NOT NULL AND c.estado != ''
        ORDER BY customer_count DESC
      `;

      const results = await this.db.query<any>(sql, params);

      const stateMetrics: LocationMetrics[] = results.map((row) => ({
        location: row.location,
        customerCount: parseInt(row.customer_count, 10),
        totalRevenue: parseFloat(row.total_revenue),
        averageTicket: parseFloat(row.average_ticket),
        orderCount: parseInt(row.order_count, 10),
      }));

      logger.debug('State aggregation completed', {
        stateCount: stateMetrics.length,
      });

      return stateMetrics;
    } catch (error) {
      logger.error('Error aggregating by state', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Aggregate customers and revenue by city
   * Requirements: 16.1, 16.3, 16.4, 16.6
   * 
   * @param filters - Date range, business unit, and optional state filters
   * @returns Promise resolving to array of city metrics
   */
  async aggregateByCity(filters: GeolocationFilters): Promise<LocationMetrics[]> {
    try {
      logger.debug('Aggregating by city', { filters });

      const whereClauses: string[] = ['p.data_pedido BETWEEN ? AND ?'];
      const params: any[] = [filters.startDate, filters.endDate];

      if (filters.businessUnit !== 'all') {
        whereClauses.push('p.unidade_negocio = ?');
        params.push(filters.businessUnit);
      }

      // Add state filter if provided (to filter cities by state)
      if (filters.states && filters.states.length > 0) {
        whereClauses.push('c.estado IN (?)');
        params.push(filters.states);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      const sql = `
        SELECT 
          CONCAT(c.cidade, ', ', c.estado) as location,
          COUNT(DISTINCT c.id) as customer_count,
          COALESCE(SUM(p.valor_total), 0) as total_revenue,
          COALESCE(AVG(p.valor_total), 0) as average_ticket,
          COUNT(DISTINCT p.id) as order_count
        FROM clientes c
        INNER JOIN pedidos p ON c.id = p.cliente_id
        ${whereClause}
        GROUP BY c.cidade, c.estado
        HAVING c.cidade IS NOT NULL AND c.cidade != ''
          AND c.estado IS NOT NULL AND c.estado != ''
        ORDER BY customer_count DESC
      `;

      const results = await this.db.query<any>(sql, params);

      const cityMetrics: LocationMetrics[] = results.map((row) => ({
        location: row.location,
        customerCount: parseInt(row.customer_count, 10),
        totalRevenue: parseFloat(row.total_revenue),
        averageTicket: parseFloat(row.average_ticket),
        orderCount: parseInt(row.order_count, 10),
      }));

      logger.debug('City aggregation completed', {
        cityCount: cityMetrics.length,
      });

      return cityMetrics;
    } catch (error) {
      logger.error('Error aggregating by city', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  /**
   * Get customers for a specific location (state and/or city)
   * Requirements: 16.5
   * 
   * @param state - State code (e.g., 'SP', 'RJ')
   * @param city - Optional city name
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to array of customers
   */
  async getCustomersByLocation(
    state: string,
    city: string | null,
    filters: GeolocationFilters
  ): Promise<LocationCustomer[]> {
    try {
      logger.debug('Getting customers by location', { state, city, filters });

      const whereClauses: string[] = [
        'p.data_pedido BETWEEN ? AND ?',
        'c.estado = ?',
      ];
      const params: any[] = [filters.startDate, filters.endDate, state];

      if (city) {
        whereClauses.push('c.cidade = ?');
        params.push(city);
      }

      if (filters.businessUnit !== 'all') {
        whereClauses.push('p.unidade_negocio = ?');
        params.push(filters.businessUnit);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      const sql = `
        SELECT 
          c.id,
          c.nome as name,
          c.email,
          c.telefone as phone,
          c.whatsapp,
          c.cidade as city,
          c.estado as state,
          COALESCE(SUM(p.valor_total), 0) as total_spent,
          COUNT(DISTINCT p.id) as order_count
        FROM clientes c
        INNER JOIN pedidos p ON c.id = p.cliente_id
        ${whereClause}
        GROUP BY c.id, c.nome, c.email, c.telefone, c.whatsapp, c.cidade, c.estado
        ORDER BY total_spent DESC
      `;

      const results = await this.db.query<any>(sql, params);

      const customers: LocationCustomer[] = results.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        whatsapp: row.whatsapp,
        city: row.city,
        state: row.state,
        totalSpent: parseFloat(row.total_spent),
        orderCount: parseInt(row.order_count, 10),
      }));

      logger.debug('Customers by location fetched', {
        customerCount: customers.length,
      });

      return customers;
    } catch (error) {
      logger.error('Error getting customers by location', {
        error: error instanceof Error ? error.message : String(error),
        state,
        city,
        filters,
      });
      throw error;
    }
  }
}
