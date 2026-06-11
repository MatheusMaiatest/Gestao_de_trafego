import { DatabaseManager } from '../database/DatabaseManager';
import { logger } from '../utils/logger';

/**
 * Order entity representing a customer order
 */
export interface Order {
  id: number;
  clientId: number;
  orderNumber: string;
  orderDate: Date;
  totalValue: number;
  discountCoupon: string | null;
  businessUnit: 'ecommerce' | 'distributor';
  items?: OrderItem[];
}

/**
 * Order item entity representing individual products in an order
 */
export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * Parameters for filtering orders by date range and business unit
 */
export interface OrderFilters {
  startDate: string;
  endDate: string;
  businessUnit?: 'ecommerce' | 'distributor' | 'all';
  customerId?: number;
}

/**
 * OrderService provides data access methods for order-related queries
 * Requirements: 5.1, 17.1, 20.3
 */
export class OrderService {
  constructor(private db: DatabaseManager) {}

  /**
   * Get orders by customer ID with order items
   * Requirement 5.1: Display purchase history ordered by date
   * Requirement 20.3: Use prepared statements for all queries
   * 
   * @param customerId - The customer ID to fetch orders for
   * @param filters - Optional date range filters
   * @returns Promise resolving to array of orders with items
   */
  async getOrdersByCustomer(
    customerId: number,
    filters?: { startDate?: string; endDate?: string }
  ): Promise<Order[]> {
    try {
      logger.debug('Fetching orders by customer', { customerId, filters });

      // Build query with optional date filters
      let sql = `
        SELECT 
          p.id,
          p.cliente_id as clientId,
          p.numero_pedido as orderNumber,
          p.data_pedido as orderDate,
          p.valor_total as totalValue,
          p.cupom_desconto as discountCoupon,
          p.unidade_negocio as businessUnit
        FROM pedidos p
        WHERE p.cliente_id = ?
      `;

      const params: any[] = [customerId];

      if (filters?.startDate && filters?.endDate) {
        sql += ` AND p.data_pedido BETWEEN ? AND ?`;
        params.push(filters.startDate, filters.endDate);
      }

      sql += ` ORDER BY p.data_pedido DESC`;

      const orders = await this.db.query<Order>(sql, params);

      // Fetch items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await this.getOrderItems(order.id);
          return { ...order, items };
        })
      );

      logger.debug('Orders fetched successfully', { 
        customerId, 
        orderCount: ordersWithItems.length 
      });

      return ordersWithItems;
    } catch (error) {
      logger.error('Error fetching orders by customer', {
        customerId,
        filters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get orders by date range with filters for business unit and optional customer
   * Requirement 5.1: Display purchase history ordered by date
   * Requirement 20.3: Use prepared statements for all queries
   * 
   * @param filters - Date range, business unit, and optional customer filter
   * @returns Promise resolving to array of orders
   */
  async getOrdersByDateRange(filters: OrderFilters): Promise<Order[]> {
    try {
      logger.debug('Fetching orders by date range', { filters });

      let sql = `
        SELECT 
          p.id,
          p.cliente_id as clientId,
          p.numero_pedido as orderNumber,
          p.data_pedido as orderDate,
          p.valor_total as totalValue,
          p.cupom_desconto as discountCoupon,
          p.unidade_negocio as businessUnit
        FROM pedidos p
        WHERE p.data_pedido BETWEEN ? AND ?
      `;

      const params: any[] = [filters.startDate, filters.endDate];

      // Add business unit filter if not 'all'
      if (filters.businessUnit && filters.businessUnit !== 'all') {
        sql += ` AND p.unidade_negocio = ?`;
        params.push(filters.businessUnit);
      }

      // Add customer filter if provided
      if (filters.customerId) {
        sql += ` AND p.cliente_id = ?`;
        params.push(filters.customerId);
      }

      sql += ` ORDER BY p.data_pedido DESC`;

      const orders = await this.db.query<Order>(sql, params);

      logger.debug('Orders fetched successfully', { 
        orderCount: orders.length,
        filters 
      });

      return orders;
    } catch (error) {
      logger.error('Error fetching orders by date range', {
        filters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get full order details with items by order ID
   * Requirement 5.1: Display purchase history
   * Requirement 20.3: Use prepared statements for all queries
   * 
   * @param orderId - The order ID to fetch
   * @returns Promise resolving to order with items or null if not found
   */
  async getOrderById(orderId: number): Promise<Order | null> {
    try {
      logger.debug('Fetching order by ID', { orderId });

      const sql = `
        SELECT 
          p.id,
          p.cliente_id as clientId,
          p.numero_pedido as orderNumber,
          p.data_pedido as orderDate,
          p.valor_total as totalValue,
          p.cupom_desconto as discountCoupon,
          p.unidade_negocio as businessUnit
        FROM pedidos p
        WHERE p.id = ?
      `;

      const orders = await this.db.query<Order>(sql, [orderId]);

      if (orders.length === 0) {
        logger.debug('Order not found', { orderId });
        return null;
      }

      const order = orders[0];

      // Fetch order items
      const items = await this.getOrderItems(orderId);
      order.items = items;

      logger.debug('Order fetched successfully', { orderId });

      return order;
    } catch (error) {
      logger.error('Error fetching order by ID', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get orders that used discount coupons
   * Requirement 17.1: Identify orders that used discount coupons
   * Requirement 20.3: Use prepared statements for all queries
   * 
   * @param filters - Date range and business unit filters
   * @returns Promise resolving to array of orders with coupons
   */
  async getOrdersWithCoupon(filters: OrderFilters): Promise<Order[]> {
    try {
      logger.debug('Fetching orders with coupons', { filters });

      let sql = `
        SELECT 
          p.id,
          p.cliente_id as clientId,
          p.numero_pedido as orderNumber,
          p.data_pedido as orderDate,
          p.valor_total as totalValue,
          p.cupom_desconto as discountCoupon,
          p.unidade_negocio as businessUnit
        FROM pedidos p
        WHERE p.data_pedido BETWEEN ? AND ?
          AND p.cupom_desconto IS NOT NULL
          AND p.cupom_desconto != ''
      `;

      const params: any[] = [filters.startDate, filters.endDate];

      // Add business unit filter if not 'all'
      if (filters.businessUnit && filters.businessUnit !== 'all') {
        sql += ` AND p.unidade_negocio = ?`;
        params.push(filters.businessUnit);
      }

      sql += ` ORDER BY p.data_pedido DESC`;

      const orders = await this.db.query<Order>(sql, params);

      logger.debug('Orders with coupons fetched successfully', { 
        orderCount: orders.length,
        filters 
      });

      return orders;
    } catch (error) {
      logger.error('Error fetching orders with coupons', {
        filters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get order items for a specific order
   * Helper method to fetch items associated with an order
   * Requirement 5.1: Display purchase history
   * Requirement 20.3: Use prepared statements for all queries
   * 
   * @param orderId - The order ID to fetch items for
   * @returns Promise resolving to array of order items
   */
  private async getOrderItems(orderId: number): Promise<OrderItem[]> {
    try {
      const sql = `
        SELECT 
          ip.id,
          ip.pedido_id as orderId,
          ip.produto_id as productId,
          pr.nome as productName,
          ip.quantidade as quantity,
          ip.preco_unitario as unitPrice,
          ip.preco_total as totalPrice
        FROM itens_pedido ip
        INNER JOIN produtos pr ON ip.produto_id = pr.id
        WHERE ip.pedido_id = ?
        ORDER BY ip.id
      `;

      const items = await this.db.query<OrderItem>(sql, [orderId]);

      return items;
    } catch (error) {
      logger.error('Error fetching order items', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get order by order number (for search functionality)
   * Requirement 20.3: Use prepared statements for all queries
   * 
   * @param orderNumber - The order number to search for
   * @returns Promise resolving to order with items or null if not found
   */
  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    try {
      logger.debug('Fetching order by number', { orderNumber });

      const sql = `
        SELECT 
          p.id,
          p.cliente_id as clientId,
          p.numero_pedido as orderNumber,
          p.data_pedido as orderDate,
          p.valor_total as totalValue,
          p.cupom_desconto as discountCoupon,
          p.unidade_negocio as businessUnit
        FROM pedidos p
        WHERE p.numero_pedido = ?
      `;

      const orders = await this.db.query<Order>(sql, [orderNumber]);

      if (orders.length === 0) {
        logger.debug('Order not found', { orderNumber });
        return null;
      }

      const order = orders[0];

      // Fetch order items
      const items = await this.getOrderItems(order.id);
      order.items = items;

      logger.debug('Order fetched successfully', { orderNumber });

      return order;
    } catch (error) {
      logger.error('Error fetching order by number', {
        orderNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
