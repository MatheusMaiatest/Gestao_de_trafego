import { ProductService } from './ProductService';
import { DatabaseManager } from '../database/DatabaseManager';

// Mock the DatabaseManager
jest.mock('../database/DatabaseManager');

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ProductService', () => {
  let productService: ProductService;
  let mockDb: jest.Mocked<DatabaseManager>;

  beforeEach(() => {
    // Create mock database instance
    mockDb = new DatabaseManager() as jest.Mocked<DatabaseManager>;
    productService = new ProductService(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTopSellingProducts', () => {
    it('should fetch top selling products ordered by quantity', async () => {
      // Arrange
      const mockResults = [
        {
          id: 1,
          code: 'PROD001',
          name: 'Product 1',
          total_quantity_sold: '100',
          total_revenue: '5000.00',
          order_count: '25',
          average_unit_price: '50.00',
        },
        {
          id: 2,
          code: 'PROD002',
          name: 'Product 2',
          total_quantity_sold: '80',
          total_revenue: '4000.00',
          order_count: '20',
          average_unit_price: '50.00',
        },
      ];

      mockDb.query.mockResolvedValue(mockResults);

      // Act
      const result = await productService.getTopSellingProducts('quantity', 20);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        code: 'PROD001',
        name: 'Product 1',
        totalQuantitySold: 100,
        totalRevenue: 5000,
        orderCount: 25,
        averageUnitPrice: 50,
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY total_quantity_sold DESC'),
        expect.arrayContaining([20])
      );
    });

    it('should fetch top selling products ordered by revenue', async () => {
      // Arrange
      const mockResults = [
        {
          id: 1,
          code: 'PROD001',
          name: 'Product 1',
          total_quantity_sold: '50',
          total_revenue: '10000.00',
          order_count: '15',
          average_unit_price: '200.00',
        },
      ];

      mockDb.query.mockResolvedValue(mockResults);

      // Act
      const result = await productService.getTopSellingProducts('revenue', 10);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].totalRevenue).toBe(10000);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY total_revenue DESC'),
        expect.arrayContaining([10])
      );
    });

    it('should filter by business unit', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([]);

      // Act
      await productService.getTopSellingProducts('quantity', 20, 'ecommerce');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.unidade_negocio = ?'),
        expect.arrayContaining(['ecommerce', 20])
      );
    });

    it('should filter by date range', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([]);

      // Act
      await productService.getTopSellingProducts(
        'quantity',
        20,
        'all',
        '2024-01-01',
        '2024-01-31'
      );

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('p.data_pedido BETWEEN ? AND ?'),
        expect.arrayContaining(['2024-01-01', '2024-01-31', 20])
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const error = new Error('Database connection error');
      mockDb.query.mockRejectedValue(error);

      // Act & Assert
      await expect(
        productService.getTopSellingProducts('quantity', 20)
      ).rejects.toThrow('Database connection error');
    });
  });

  describe('getProductCoOccurrence', () => {
    it('should fetch product pairs with co-occurrence count', async () => {
      // Arrange
      const mockPairs = [
        {
          produto1_id: 1,
          produto1_nome: 'Product 1',
          produto2_id: 2,
          produto2_nome: 'Product 2',
          co_ocorrencias: '15',
        },
      ];

      const mockTotalOrders = [{ total: 100 }];

      mockDb.query
        .mockResolvedValueOnce(mockPairs)
        .mockResolvedValueOnce(mockTotalOrders);

      // Act
      const result = await productService.getProductCoOccurrence(2);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        product1Id: 1,
        product1Name: 'Product 1',
        product2Id: 2,
        product2Name: 'Product 2',
        coOccurrenceCount: 15,
        coOccurrencePercentage: 15,
      });
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should filter by minimum frequency', async () => {
      // Arrange
      mockDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 100 }]);

      // Act
      await productService.getProductCoOccurrence(5);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('HAVING co_ocorrencias >= ?'),
        expect.arrayContaining([5, 20])
      );
    });

    it('should filter by business unit and date range', async () => {
      // Arrange
      mockDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 50 }]);

      // Act
      await productService.getProductCoOccurrence(
        2,
        'distribuidor',
        '2024-01-01',
        '2024-01-31',
        10
      );

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ped.unidade_negocio = ?'),
        expect.arrayContaining(['distribuidor', '2024-01-01', '2024-01-31', 2, 10])
      );
    });

    it('should handle empty results', async () => {
      // Arrange
      mockDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 100 }]);

      // Act
      const result = await productService.getProductCoOccurrence(2);

      // Assert
      expect(result).toEqual([]);
    });

    it('should avoid division by zero when no orders', async () => {
      // Arrange
      const mockPairs = [
        {
          produto1_id: 1,
          produto1_nome: 'Product 1',
          produto2_id: 2,
          produto2_nome: 'Product 2',
          co_ocorrencias: '5',
        },
      ];

      mockDb.query
        .mockResolvedValueOnce(mockPairs)
        .mockResolvedValueOnce([{ total: 0 }]);

      // Act
      const result = await productService.getProductCoOccurrence(2);

      // Assert
      expect(result[0].coOccurrencePercentage).toBe(500); // 5 / 1 * 100
    });
  });

  describe('getProductsBySegment', () => {
    it('should fetch products for VIP segment', async () => {
      // Arrange
      const mockProducts = [
        {
          id: 1,
          code: 'PROD001',
          name: 'VIP Product',
          total_quantity_sold: '50',
          total_revenue: '5000.00',
          order_count: '10',
          average_unit_price: '100.00',
        },
      ];

      mockDb.query.mockResolvedValue(mockProducts);

      // Act
      const result = await productService.getProductsBySegment('vip');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('VIP Product');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY SUM(p.valor_total) DESC'),
        expect.any(Array)
      );
    });

    it('should fetch products for recorrente segment', async () => {
      // Arrange
      const mockProducts = [
        {
          id: 2,
          code: 'PROD002',
          name: 'Recurrent Product',
          total_quantity_sold: '30',
          total_revenue: '3000.00',
          order_count: '5',
          average_unit_price: '100.00',
        },
      ];

      mockDb.query.mockResolvedValue(mockProducts);

      // Act
      const result = await productService.getProductsBySegment('recorrente');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Recurrent Product');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('HAVING COUNT(p.id) >= 3'),
        expect.any(Array)
      );
    });

    it('should filter by business unit and date range', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([]);

      // Act
      await productService.getProductsBySegment(
        'vip',
        'ecommerce',
        '2024-01-01',
        '2024-01-31',
        15
      );

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('p.unidade_negocio = ?'),
        expect.arrayContaining(['2024-01-01', '2024-01-31', 'ecommerce', '2024-01-01', '2024-01-31', 15])
      );
    });

    it('should return empty array for unsupported segment types', async () => {
      // Act
      const result = await productService.getProductsBySegment('inativo' as any);

      // Assert
      expect(result).toEqual([]);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('getProductCustomers', () => {
    it('should fetch customers who purchased a product', async () => {
      // Arrange
      const mockCustomers = [
        {
          id: 1,
          name: 'Customer 1',
          email: 'customer1@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          total_quantity_purchased: '10',
          total_spent_on_product: '1000.00',
          last_purchase_date: new Date('2024-01-15'),
        },
        {
          id: 2,
          name: 'Customer 2',
          email: null,
          phone: '11888888888',
          whatsapp: null,
          city: 'Rio de Janeiro',
          state: 'RJ',
          total_quantity_purchased: '5',
          total_spent_on_product: '500.00',
          last_purchase_date: new Date('2024-01-10'),
        },
      ];

      mockDb.query.mockResolvedValue(mockCustomers);

      // Act
      const result = await productService.getProductCustomers(1);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        name: 'Customer 1',
        email: 'customer1@example.com',
        phone: '11999999999',
        whatsapp: '11999999999',
        city: 'São Paulo',
        state: 'SP',
        totalQuantityPurchased: 10,
        totalSpentOnProduct: 1000,
        lastPurchaseDate: expect.any(Date),
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ip.produto_id = ?'),
        [1]
      );
    });

    it('should filter by date range', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([]);

      // Act
      await productService.getProductCustomers(1, '2024-01-01', '2024-01-31');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('p.data_pedido BETWEEN ? AND ?'),
        [1, '2024-01-01', '2024-01-31']
      );
    });

    it('should order by total quantity purchased', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([]);

      // Act
      await productService.getProductCustomers(1);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY total_quantity_purchased DESC'),
        [1]
      );
    });
  });

  describe('getOrdersByProductPair', () => {
    it('should fetch orders containing both products', async () => {
      // Arrange
      const mockOrders = [
        {
          order_id: 1,
          order_number: 'ORD001',
          order_date: new Date('2024-01-15'),
          customer_name: 'Customer 1',
          total_value: '1500.00',
        },
        {
          order_id: 2,
          order_number: 'ORD002',
          order_date: new Date('2024-01-10'),
          customer_name: 'Customer 2',
          total_value: '2000.00',
        },
      ];

      mockDb.query.mockResolvedValue(mockOrders);

      // Act
      const result = await productService.getOrdersByProductPair(1, 2);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        orderId: 1,
        orderNumber: 'ORD001',
        orderDate: expect.any(Date),
        customerName: 'Customer 1',
        totalValue: 1500,
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ip1.produto_id = ?'),
        [1, 2]
      );
    });

    it('should filter by date range', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([]);

      // Act
      await productService.getOrdersByProductPair(
        1,
        2,
        '2024-01-01',
        '2024-01-31'
      );

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.data_pedido BETWEEN ? AND ?'),
        [1, 2, '2024-01-01', '2024-01-31']
      );
    });

    it('should order by date descending', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([]);

      // Act
      await productService.getOrdersByProductPair(1, 2);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY p.data_pedido DESC'),
        [1, 2]
      );
    });

    it('should handle empty results', async () => {
      // Arrange
      mockDb.query.mockResolvedValue([]);

      // Act
      const result = await productService.getOrdersByProductPair(1, 2);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
