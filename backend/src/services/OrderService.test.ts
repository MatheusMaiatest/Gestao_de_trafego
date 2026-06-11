import { OrderService, Order, OrderItem } from './OrderService';
import { DatabaseManager } from '../database/DatabaseManager';

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('OrderService', () => {
  let orderService: OrderService;
  let mockDb: jest.Mocked<DatabaseManager>;

  beforeEach(() => {
    // Create mock DatabaseManager
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(),
      getConnection: jest.fn(),
      releaseConnection: jest.fn(),
      close: jest.fn(),
      testConnection: jest.fn(),
    } as any;

    orderService = new OrderService(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrdersByCustomer', () => {
    const customerId = 123;
    const mockOrders: Order[] = [
      {
        id: 1,
        clientId: 123,
        orderNumber: 'ORD-001',
        orderDate: new Date('2024-01-15'),
        totalValue: 150.0,
        discountCoupon: null,
        businessUnit: 'ecommerce',
      },
      {
        id: 2,
        clientId: 123,
        orderNumber: 'ORD-002',
        orderDate: new Date('2024-01-10'),
        totalValue: 200.0,
        discountCoupon: 'SAVE10',
        businessUnit: 'ecommerce',
      },
    ];

    const mockItems: OrderItem[] = [
      {
        id: 1,
        orderId: 1,
        productId: 10,
        productName: 'Product A',
        quantity: 2,
        unitPrice: 75.0,
        totalPrice: 150.0,
      },
    ];

    it('should fetch orders for a customer without date filters', async () => {
      mockDb.query
        .mockResolvedValueOnce(mockOrders)
        .mockResolvedValueOnce(mockItems)
        .mockResolvedValueOnce(mockItems);

      const result = await orderService.getOrdersByCustomer(customerId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('items');
      expect(mockDb.query).toHaveBeenCalledTimes(3); // 1 for orders + 2 for items
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.cliente_id = ?'),
        [customerId]
      );
    });

    it('should fetch orders for a customer with date filters', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      mockDb.query
        .mockResolvedValueOnce(mockOrders)
        .mockResolvedValueOnce(mockItems)
        .mockResolvedValueOnce(mockItems);

      const result = await orderService.getOrdersByCustomer(customerId, filters);

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.data_pedido BETWEEN ? AND ?'),
        [customerId, filters.startDate, filters.endDate]
      );
    });

    it('should return empty array when no orders found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await orderService.getOrdersByCustomer(customerId);

      expect(result).toEqual([]);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      mockDb.query.mockRejectedValueOnce(error);

      await expect(orderService.getOrdersByCustomer(customerId)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('getOrdersByDateRange', () => {
    const mockOrders: Order[] = [
      {
        id: 1,
        clientId: 123,
        orderNumber: 'ORD-001',
        orderDate: new Date('2024-01-15'),
        totalValue: 150.0,
        discountCoupon: null,
        businessUnit: 'ecommerce',
      },
      {
        id: 2,
        clientId: 456,
        orderNumber: 'ORD-002',
        orderDate: new Date('2024-01-10'),
        totalValue: 200.0,
        discountCoupon: 'SAVE10',
        businessUnit: 'distributor',
      },
    ];

    it('should fetch orders by date range with all business units', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        businessUnit: 'all' as const,
      };

      mockDb.query.mockResolvedValueOnce(mockOrders);

      const result = await orderService.getOrdersByDateRange(filters);

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.data_pedido BETWEEN ? AND ?'),
        [filters.startDate, filters.endDate]
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.not.stringContaining('AND p.unidade_negocio = ?'),
        expect.any(Array)
      );
    });

    it('should fetch orders by date range with specific business unit', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        businessUnit: 'ecommerce' as const,
      };

      mockDb.query.mockResolvedValueOnce([mockOrders[0]]);

      const result = await orderService.getOrdersByDateRange(filters);

      expect(result).toHaveLength(1);
      expect(result[0].businessUnit).toBe('ecommerce');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.unidade_negocio = ?'),
        [filters.startDate, filters.endDate, 'ecommerce']
      );
    });

    it('should fetch orders by date range with customer filter', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        businessUnit: 'all' as const,
        customerId: 123,
      };

      mockDb.query.mockResolvedValueOnce([mockOrders[0]]);

      const result = await orderService.getOrdersByDateRange(filters);

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe(123);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.cliente_id = ?'),
        [filters.startDate, filters.endDate, filters.customerId]
      );
    });

    it('should return empty array when no orders in date range', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        businessUnit: 'all' as const,
      };

      mockDb.query.mockResolvedValueOnce([]);

      const result = await orderService.getOrdersByDateRange(filters);

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        businessUnit: 'all' as const,
      };

      const error = new Error('Query timeout');
      mockDb.query.mockRejectedValueOnce(error);

      await expect(orderService.getOrdersByDateRange(filters)).rejects.toThrow(
        'Query timeout'
      );
    });
  });

  describe('getOrderById', () => {
    const orderId = 1;
    const mockOrder: Order = {
      id: 1,
      clientId: 123,
      orderNumber: 'ORD-001',
      orderDate: new Date('2024-01-15'),
      totalValue: 150.0,
      discountCoupon: null,
      businessUnit: 'ecommerce',
    };

    const mockItems: OrderItem[] = [
      {
        id: 1,
        orderId: 1,
        productId: 10,
        productName: 'Product A',
        quantity: 2,
        unitPrice: 75.0,
        totalPrice: 150.0,
      },
    ];

    it('should fetch order by ID with items', async () => {
      mockDb.query
        .mockResolvedValueOnce([mockOrder])
        .mockResolvedValueOnce(mockItems);

      const result = await orderService.getOrderById(orderId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(orderId);
      expect(result?.items).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledTimes(2); // 1 for order + 1 for items
    });

    it('should return null when order not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await orderService.getOrderById(orderId);

      expect(result).toBeNull();
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const error = new Error('Connection lost');
      mockDb.query.mockRejectedValueOnce(error);

      await expect(orderService.getOrderById(orderId)).rejects.toThrow(
        'Connection lost'
      );
    });
  });

  describe('getOrdersWithCoupon', () => {
    const mockOrdersWithCoupons: Order[] = [
      {
        id: 2,
        clientId: 123,
        orderNumber: 'ORD-002',
        orderDate: new Date('2024-01-10'),
        totalValue: 200.0,
        discountCoupon: 'SAVE10',
        businessUnit: 'ecommerce',
      },
      {
        id: 3,
        clientId: 456,
        orderNumber: 'ORD-003',
        orderDate: new Date('2024-01-12'),
        totalValue: 300.0,
        discountCoupon: 'WELCOME20',
        businessUnit: 'distributor',
      },
    ];

    it('should fetch orders with coupons for all business units', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        businessUnit: 'all' as const,
      };

      mockDb.query.mockResolvedValueOnce(mockOrdersWithCoupons);

      const result = await orderService.getOrdersWithCoupon(filters);

      expect(result).toHaveLength(2);
      expect(result.every(order => order.discountCoupon)).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.cupom_desconto IS NOT NULL'),
        [filters.startDate, filters.endDate]
      );
    });

    it('should fetch orders with coupons for specific business unit', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        businessUnit: 'ecommerce' as const,
      };

      mockDb.query.mockResolvedValueOnce([mockOrdersWithCoupons[0]]);

      const result = await orderService.getOrdersWithCoupon(filters);

      expect(result).toHaveLength(1);
      expect(result[0].businessUnit).toBe('ecommerce');
      expect(result[0].discountCoupon).toBe('SAVE10');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.unidade_negocio = ?'),
        [filters.startDate, filters.endDate, 'ecommerce']
      );
    });

    it('should return empty array when no orders with coupons', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        businessUnit: 'all' as const,
      };

      mockDb.query.mockResolvedValueOnce([]);

      const result = await orderService.getOrdersWithCoupon(filters);

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        businessUnit: 'all' as const,
      };

      const error = new Error('Database error');
      mockDb.query.mockRejectedValueOnce(error);

      await expect(orderService.getOrdersWithCoupon(filters)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('getOrderByNumber', () => {
    const orderNumber = 'ORD-001';
    const mockOrder: Order = {
      id: 1,
      clientId: 123,
      orderNumber: 'ORD-001',
      orderDate: new Date('2024-01-15'),
      totalValue: 150.0,
      discountCoupon: null,
      businessUnit: 'ecommerce',
    };

    const mockItems: OrderItem[] = [
      {
        id: 1,
        orderId: 1,
        productId: 10,
        productName: 'Product A',
        quantity: 2,
        unitPrice: 75.0,
        totalPrice: 150.0,
      },
    ];

    it('should fetch order by order number with items', async () => {
      mockDb.query
        .mockResolvedValueOnce([mockOrder])
        .mockResolvedValueOnce(mockItems);

      const result = await orderService.getOrderByNumber(orderNumber);

      expect(result).not.toBeNull();
      expect(result?.orderNumber).toBe(orderNumber);
      expect(result?.items).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.numero_pedido = ?'),
        [orderNumber]
      );
    });

    it('should return null when order number not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await orderService.getOrderByNumber(orderNumber);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Network error');
      mockDb.query.mockRejectedValueOnce(error);

      await expect(orderService.getOrderByNumber(orderNumber)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle orders with no items', async () => {
      const mockOrder: Order = {
        id: 1,
        clientId: 123,
        orderNumber: 'ORD-001',
        orderDate: new Date('2024-01-15'),
        totalValue: 0,
        discountCoupon: null,
        businessUnit: 'ecommerce',
      };

      mockDb.query
        .mockResolvedValueOnce([mockOrder])
        .mockResolvedValueOnce([]); // No items

      const result = await orderService.getOrderById(1);

      expect(result).not.toBeNull();
      expect(result?.items).toEqual([]);
    });

    it('should handle multiple items per order', async () => {
      const mockOrder: Order = {
        id: 1,
        clientId: 123,
        orderNumber: 'ORD-001',
        orderDate: new Date('2024-01-15'),
        totalValue: 300.0,
        discountCoupon: null,
        businessUnit: 'ecommerce',
      };

      const multipleItems: OrderItem[] = [
        {
          id: 1,
          orderId: 1,
          productId: 10,
          productName: 'Product A',
          quantity: 2,
          unitPrice: 75.0,
          totalPrice: 150.0,
        },
        {
          id: 2,
          orderId: 1,
          productId: 11,
          productName: 'Product B',
          quantity: 1,
          unitPrice: 150.0,
          totalPrice: 150.0,
        },
      ];

      mockDb.query
        .mockResolvedValueOnce([mockOrder])
        .mockResolvedValueOnce(multipleItems);

      const result = await orderService.getOrderById(1);

      expect(result?.items).toHaveLength(2);
    });

    it('should use prepared statements (parameterized queries)', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        businessUnit: 'ecommerce' as const,
      };

      mockDb.query.mockResolvedValueOnce([]);

      await orderService.getOrdersByDateRange(filters);

      // Verify that query uses ? placeholders (prepared statements)
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('?'),
        expect.arrayContaining([filters.startDate, filters.endDate])
      );
    });
  });
});
