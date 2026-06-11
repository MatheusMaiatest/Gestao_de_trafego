import { DatabaseManager } from '../database/DatabaseManager';
import { logger } from '../utils/logger';
import { SegmentType } from '../types/api.types';

/**
 * Product entity
 */
export interface Product {
  id: number;
  code: string;
  name: string;
  totalQuantitySold: number;
  totalRevenue: number;
  orderCount: number;
  averageUnitPrice: number;
}

/**
 * Product pair for co-occurrence analysis
 */
export interface ProductPair {
  product1Id: number;
  product1Name: string;
  product2Id: number;
  product2Name: string;
  coOccurrenceCount: number;
  coOccurrencePercentage: number;
}

/**
 * Customer who purchased a product
 */
export interface ProductCustomer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  totalQuantityPurchased: number;
  totalSpentOnProduct: number;
  lastPurchaseDate: Date;
}

/**
 * Order containing product pair
 */
export interface ProductPairOrder {
  orderId: number;
  orderNumber: string;
  orderDate: Date;
  customerName: string;
  totalValue: number;
}

/**
 * ProductService handles product analysis queries
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 15.1, 15.2, 15.3, 15.4, 15.5, 20.3
 */
export class ProductService {
  constructor(private db: DatabaseManager) {}

  /**
   * Get top selling products ordered by quantity or revenue
   * Requirements: 8.1, 8.2, 20.3
   * 
   * @param orderBy - Sort by 'quantity' or 'revenue'
   * @param limit - Maximum number of products to return
   * @param businessUnit - Filter by business unit
   * @param startDate - Start date for filtering
   * @param endDate - End date for filtering
   * @returns Promise resolving to array of products
   */
  async getTopSellingProducts(
    orderBy: 'quantity' | 'revenue',
    limit: number = 20,
    businessUnit: 'ecommerce' | 'distribuidor' | 'all' = 'all',
    startDate?: string,
    endDate?: string
  ): Promise<Product[]> {
    try {
      logger.debug('Fetching top selling products', {
        orderBy,
        limit,
        businessUnit,
        startDate,
        endDate,
      });

      // Build WHERE clause for business unit and date filters
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (businessUnit !== 'all') {
        whereClauses.push('p.unidade_negocio = ?');
        params.push(businessUnit);
      }

      if (startDate && endDate) {
        whereClauses.push('p.data_pedido BETWEEN ? AND ?');
        params.push(startDate, endDate);
      }

      const whereClause = whereClauses.length > 0 
        ? `WHERE ${whereClauses.join(' AND ')}` 
        : '';

      // Determine ORDER BY clause
      const orderByClause = orderBy === 'quantity' 
        ? 'ORDER BY total_quantity_sold DESC' 
        : 'ORDER BY total_revenue DESC';

      // Prepared statement to get top selling products
      const sql = `
        SELECT 
          prod.id,
          prod.codigo as code,
          prod.nome as name,
          COALESCE(SUM(ip.quantidade), 0) as total_quantity_sold,
          COALESCE(SUM(ip.preco_total), 0) as total_revenue,
          COUNT(DISTINCT p.id) as order_count,
          COALESCE(AVG(ip.preco_unitario), 0) as average_unit_price
        FROM produtos prod
        LEFT JOIN itens_pedido ip ON prod.id = ip.produto_id
        LEFT JOIN pedidos p ON ip.pedido_id = p.id
        ${whereClause}
        GROUP BY prod.id, prod.codigo, prod.nome
        HAVING total_quantity_sold > 0
        ${orderByClause}
        LIMIT ?
      `;

      params.push(limit);

      const results = await this.db.query<any>(sql, params);

      return results.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        totalQuantitySold: parseInt(row.total_quantity_sold, 10),
        totalRevenue: parseFloat(row.total_revenue),
        orderCount: parseInt(row.order_count, 10),
        averageUnitPrice: parseFloat(row.average_unit_price),
      }));
    } catch (error) {
      logger.error('Error fetching top selling products', {
        error: error instanceof Error ? error.message : String(error),
        orderBy,
        limit,
      });
      throw error;
    }
  }

  /**
   * Get product co-occurrence (products frequently bought together)
   * Requirements: 8.3, 15.1, 15.2, 15.3, 20.3
   * 
   * @param minFrequency - Minimum co-occurrence frequency filter
   * @param businessUnit - Filter by business unit
   * @param startDate - Start date for filtering
   * @param endDate - End date for filtering
   * @param limit - Maximum number of pairs to return (default: 20)
   * @returns Promise resolving to array of product pairs
   */
  async getProductCoOccurrence(
    minFrequency: number = 2,
    businessUnit: 'ecommerce' | 'distribuidor' | 'all' = 'all',
    startDate?: string,
    endDate?: string,
    limit: number = 20
  ): Promise<ProductPair[]> {
    try {
      logger.debug('Fetching product co-occurrence', {
        minFrequency,
        businessUnit,
        startDate,
        endDate,
        limit,
      });

      // Build WHERE clause
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (businessUnit !== 'all') {
        whereClauses.push('ped.unidade_negocio = ?');
        params.push(businessUnit);
      }

      if (startDate && endDate) {
        whereClauses.push('ped.data_pedido BETWEEN ? AND ?');
        params.push(startDate, endDate);
      }

      const whereClause = whereClauses.length > 0 
        ? `WHERE ${whereClauses.join(' AND ')}` 
        : '';

      // Prepared statement for product pairs appearing in same orders
      const sql = `
        SELECT 
          i1.produto_id as produto1_id,
          p1.nome as produto1_nome,
          i2.produto_id as produto2_id,
          p2.nome as produto2_nome,
          COUNT(DISTINCT i1.pedido_id) as co_ocorrencias
        FROM itens_pedido i1
        INNER JOIN itens_pedido i2 ON i1.pedido_id = i2.pedido_id 
          AND i1.produto_id < i2.produto_id
        INNER JOIN produtos p1 ON i1.produto_id = p1.id
        INNER JOIN produtos p2 ON i2.produto_id = p2.id
        INNER JOIN pedidos ped ON i1.pedido_id = ped.id
        ${whereClause}
        GROUP BY i1.produto_id, i2.produto_id, p1.nome, p2.nome
        HAVING co_ocorrencias >= ?
        ORDER BY co_ocorrencias DESC
        LIMIT ?
      `;

      params.push(minFrequency, limit);

      const results = await this.db.query<any>(sql, params);

      // Get total order count for percentage calculation
      const totalOrdersSql = `
        SELECT COUNT(DISTINCT id) as total
        FROM pedidos
        ${whereClause}
      `;

      const totalOrdersParams = whereClauses.length > 0 
        ? params.slice(0, whereClauses.length) 
        : [];

      const [totalOrders] = await this.db.query<any>(totalOrdersSql, totalOrdersParams);
      const total = totalOrders?.total || 1; // Avoid division by zero

      return results.map((row) => ({
        product1Id: row.produto1_id,
        product1Name: row.produto1_nome,
        product2Id: row.produto2_id,
        product2Name: row.produto2_nome,
        coOccurrenceCount: parseInt(row.co_ocorrencias, 10),
        coOccurrencePercentage: (parseInt(row.co_ocorrencias, 10) / total) * 100,
      }));
    } catch (error) {
      logger.error('Error fetching product co-occurrence', {
        error: error instanceof Error ? error.message : String(error),
        minFrequency,
      });
      throw error;
    }
  }

  /**
   * Get top products for a specific customer segment (VIP or Recurrent)
   * Requirements: 8.4, 8.5, 20.3
   * 
   * @param segment - Customer segment type
   * @param businessUnit - Filter by business unit
   * @param startDate - Start date for filtering
   * @param endDate - End date for filtering
   * @param limit - Maximum number of products to return
   * @returns Promise resolving to array of products
   */
  async getProductsBySegment(
    segment: SegmentType,
    businessUnit: 'ecommerce' | 'distribuidor' | 'all' = 'all',
    startDate?: string,
    endDate?: string,
    limit: number = 20
  ): Promise<Product[]> {
    try {
      logger.debug('Fetching products by segment', {
        segment,
        businessUnit,
        startDate,
        endDate,
        limit,
      });

      // Build customer subquery based on segment type
      let customerSubquery = '';
      const params: any[] = [];

      if (segment === 'vip') {
        // VIP: Top 10% by total spent
        customerSubquery = `
          SELECT c.id
          FROM clientes c
          INNER JOIN pedidos p ON c.id = p.cliente_id
          ${startDate && endDate ? 'WHERE p.data_pedido BETWEEN ? AND ?' : ''}
          GROUP BY c.id
          ORDER BY SUM(p.valor_total) DESC
          LIMIT (SELECT CEIL(COUNT(DISTINCT cliente_id) * 0.1) FROM pedidos)
        `;
        if (startDate && endDate) {
          params.push(startDate, endDate);
        }
      } else if (segment === 'recorrente') {
        // Recorrente: 3 or more orders in period
        customerSubquery = `
          SELECT c.id
          FROM clientes c
          INNER JOIN pedidos p ON c.id = p.cliente_id
          ${startDate && endDate ? 'WHERE p.data_pedido BETWEEN ? AND ?' : ''}
          GROUP BY c.id
          HAVING COUNT(p.id) >= 3
        `;
        if (startDate && endDate) {
          params.push(startDate, endDate);
        }
      } else {
        // For other segments, return empty array (not implemented yet)
        logger.warn('Segment type not supported for product analysis', { segment });
        return [];
      }

      // Build WHERE clause for business unit
      const whereClauses: string[] = [`p.cliente_id IN (${customerSubquery})`];

      if (businessUnit !== 'all') {
        whereClauses.push('p.unidade_negocio = ?');
        params.push(businessUnit);
      }

      if (startDate && endDate) {
        whereClauses.push('p.data_pedido BETWEEN ? AND ?');
        params.push(startDate, endDate);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      // Prepared statement to get top products for segment
      const sql = `
        SELECT 
          prod.id,
          prod.codigo as code,
          prod.nome as name,
          COALESCE(SUM(ip.quantidade), 0) as total_quantity_sold,
          COALESCE(SUM(ip.preco_total), 0) as total_revenue,
          COUNT(DISTINCT p.id) as order_count,
          COALESCE(AVG(ip.preco_unitario), 0) as average_unit_price
        FROM produtos prod
        INNER JOIN itens_pedido ip ON prod.id = ip.produto_id
        INNER JOIN pedidos p ON ip.pedido_id = p.id
        ${whereClause}
        GROUP BY prod.id, prod.codigo, prod.nome
        ORDER BY total_quantity_sold DESC
        LIMIT ?
      `;

      params.push(limit);

      const results = await this.db.query<any>(sql, params);

      return results.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        totalQuantitySold: parseInt(row.total_quantity_sold, 10),
        totalRevenue: parseFloat(row.total_revenue),
        orderCount: parseInt(row.order_count, 10),
        averageUnitPrice: parseFloat(row.average_unit_price),
      }));
    } catch (error) {
      logger.error('Error fetching products by segment', {
        error: error instanceof Error ? error.message : String(error),
        segment,
      });
      throw error;
    }
  }

  /**
   * Get list of customers who purchased a specific product
   * Requirements: 8.6, 20.3
   * 
   * @param productId - Product ID
   * @param startDate - Start date for filtering
   * @param endDate - End date for filtering
   * @returns Promise resolving to array of customers
   */
  async getProductCustomers(
    productId: number,
    startDate?: string,
    endDate?: string
  ): Promise<ProductCustomer[]> {
    try {
      logger.debug('Fetching customers for product', {
        productId,
        startDate,
        endDate,
      });

      // Build WHERE clause
      const whereClauses: string[] = ['ip.produto_id = ?'];
      const params: any[] = [productId];

      if (startDate && endDate) {
        whereClauses.push('p.data_pedido BETWEEN ? AND ?');
        params.push(startDate, endDate);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      // Prepared statement to get customers who purchased product
      const sql = `
        SELECT 
          c.id,
          c.nome as name,
          c.email,
          c.telefone as phone,
          c.whatsapp,
          c.cidade as city,
          c.estado as state,
          SUM(ip.quantidade) as total_quantity_purchased,
          SUM(ip.preco_total) as total_spent_on_product,
          MAX(p.data_pedido) as last_purchase_date
        FROM clientes c
        INNER JOIN pedidos p ON c.id = p.cliente_id
        INNER JOIN itens_pedido ip ON p.id = ip.pedido_id
        ${whereClause}
        GROUP BY c.id, c.nome, c.email, c.telefone, c.whatsapp, c.cidade, c.estado
        ORDER BY total_quantity_purchased DESC
      `;

      const results = await this.db.query<any>(sql, params);

      return results.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        whatsapp: row.whatsapp,
        city: row.city,
        state: row.state,
        totalQuantityPurchased: parseInt(row.total_quantity_purchased, 10),
        totalSpentOnProduct: parseFloat(row.total_spent_on_product),
        lastPurchaseDate: new Date(row.last_purchase_date),
      }));
    } catch (error) {
      logger.error('Error fetching customers for product', {
        error: error instanceof Error ? error.message : String(error),
        productId,
      });
      throw error;
    }
  }

  /**
   * Get orders containing both products in a pair
   * Requirements: 15.4, 15.5, 20.3
   * 
   * @param product1Id - First product ID
   * @param product2Id - Second product ID
   * @param startDate - Start date for filtering
   * @param endDate - End date for filtering
   * @returns Promise resolving to array of orders
   */
  async getOrdersByProductPair(
    product1Id: number,
    product2Id: number,
    startDate?: string,
    endDate?: string
  ): Promise<ProductPairOrder[]> {
    try {
      logger.debug('Fetching orders for product pair', {
        product1Id,
        product2Id,
        startDate,
        endDate,
      });

      // Build WHERE clause
      const whereClauses: string[] = [];
      const params: any[] = [product1Id, product2Id];

      if (startDate && endDate) {
        whereClauses.push('p.data_pedido BETWEEN ? AND ?');
        params.push(startDate, endDate);
      }

      const whereClause = whereClauses.length > 0 
        ? `AND ${whereClauses.join(' AND ')}` 
        : '';

      // Prepared statement to get orders containing both products
      const sql = `
        SELECT DISTINCT
          p.id as order_id,
          p.numero_pedido as order_number,
          p.data_pedido as order_date,
          c.nome as customer_name,
          p.valor_total as total_value
        FROM pedidos p
        INNER JOIN clientes c ON p.cliente_id = c.id
        INNER JOIN itens_pedido ip1 ON p.id = ip1.pedido_id AND ip1.produto_id = ?
        INNER JOIN itens_pedido ip2 ON p.id = ip2.pedido_id AND ip2.produto_id = ?
        ${whereClause}
        ORDER BY p.data_pedido DESC
      `;

      const results = await this.db.query<any>(sql, params);

      return results.map((row) => ({
        orderId: row.order_id,
        orderNumber: row.order_number,
        orderDate: new Date(row.order_date),
        customerName: row.customer_name,
        totalValue: parseFloat(row.total_value),
      }));
    } catch (error) {
      logger.error('Error fetching orders for product pair', {
        error: error instanceof Error ? error.message : String(error),
        product1Id,
        product2Id,
      });
      throw error;
    }
  }
}
