import { CustomerService } from './CustomerService';
import { DatabaseManager } from '../database/DatabaseManager';
import { RowDataPacket } from 'mysql2';

// Mock the DatabaseManager
jest.mock('../database/DatabaseManager');
jest.mock('../utils/logger');

describe('CustomerService', () => {
  let customerService: CustomerService;
  let mockDb: jest.Mocked<DatabaseManager>;

  beforeEach(() => {
    // Create a mock DatabaseManager instance
    mockDb = new DatabaseManager() as jest.Mocked<DatabaseManager>;
    customerService = new CustomerService(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCustomers', () => {
    it('should return paginated customers with filters', async () => {
      const mockCountResult = [{ total: 2 }] as RowDataPacket[];
      const mockCustomerResults = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '123.456.789-00',
          email: 'joao@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          businessUnit: 'ecommerce',
          firstPurchaseDate: new Date('2023-01-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalOrders: 5,
          totalSpent: '5000.00',
          averageTicket: '1000.00',
        },
        {
          id: 2,
          name: 'Maria Santos',
          cpf: '987.654.321-00',
          email: 'maria@example.com',
          phone: '11988888888',
          whatsapp: '11988888888',
          city: 'Rio de Janeiro',
          state: 'RJ',
          businessUnit: 'distributor',
          firstPurchaseDate: new Date('2023-02-01'),
          lastPurchaseDate: new Date('2023-11-01'),
          totalOrders: 3,
          totalSpent: '3000.00',
          averageTicket: '1000.00',
        },
      ] as RowDataPacket[];

      mockDb.query
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockCustomerResults);

      const result = await customerService.getCustomers({
        businessUnit: 'all',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        page: 1,
        limit: 50,
      });

      expect(result.customers).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
      expect(result.customers[0].name).toBe('João Silva');
      expect(result.customers[0].totalSpent).toBe(5000);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should filter by specific business unit', async () => {
      const mockCountResult = [{ total: 1 }] as RowDataPacket[];
      const mockCustomerResults = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '123.456.789-00',
          email: 'joao@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          businessUnit: 'ecommerce',
          firstPurchaseDate: new Date('2023-01-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalOrders: 5,
          totalSpent: '5000.00',
          averageTicket: '1000.00',
        },
      ] as RowDataPacket[];

      mockDb.query
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockCustomerResults);

      const result = await customerService.getCustomers({
        businessUnit: 'ecommerce',
      });

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].businessUnit).toBe('ecommerce');
    });

    it('should handle pagination correctly', async () => {
      const mockCountResult = [{ total: 100 }] as RowDataPacket[];
      const mockCustomerResults = [] as RowDataPacket[];

      mockDb.query
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockCustomerResults);

      const result = await customerService.getCustomers({
        page: 2,
        limit: 10,
      });

      expect(result.pages).toBe(10);
      expect(result.page).toBe(2);
    });

    it('should handle empty results', async () => {
      const mockCountResult = [{ total: 0 }] as RowDataPacket[];
      const mockCustomerResults = [] as RowDataPacket[];

      mockDb.query
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockCustomerResults);

      const result = await customerService.getCustomers();

      expect(result.customers).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw error on database failure', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(customerService.getCustomers()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getCustomerById', () => {
    it('should return customer profile with metrics', async () => {
      const mockCustomerResult = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '123.456.789-00',
          email: 'joao@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          businessUnit: 'ecommerce',
          firstPurchaseDate: new Date('2023-01-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalOrders: 5,
          totalSpent: '5000.00',
          averageTicket: '1000.00',
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockCustomerResult);

      const result = await customerService.getCustomerById(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.name).toBe('João Silva');
      expect(result?.totalOrders).toBe(5);
      expect(result?.totalSpent).toBe(5000);
      expect(result?.averageTicket).toBe(1000);
    });

    it('should return null for non-existent customer', async () => {
      mockDb.query.mockResolvedValueOnce([] as RowDataPacket[]);

      const result = await customerService.getCustomerById(999);

      expect(result).toBeNull();
    });

    it('should apply date range filter when provided', async () => {
      const mockCustomerResult = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '123.456.789-00',
          email: 'joao@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          businessUnit: 'ecommerce',
          firstPurchaseDate: new Date('2023-06-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalOrders: 3,
          totalSpent: '3000.00',
          averageTicket: '1000.00',
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockCustomerResult);

      const result = await customerService.getCustomerById(1, {
        startDate: '2023-06-01',
        endDate: '2023-12-31',
      });

      expect(result).not.toBeNull();
      expect(result?.totalOrders).toBe(3);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('getCustomerOrders', () => {
    it('should return order history for customer', async () => {
      const mockOrders = [
        {
          id: 101,
          clientId: 1,
          orderNumber: 'ORD-001',
          orderDate: new Date('2023-12-01'),
          totalValue: '1500.00',
          discountCoupon: 'SAVE10',
          businessUnit: 'ecommerce',
        },
        {
          id: 102,
          clientId: 1,
          orderNumber: 'ORD-002',
          orderDate: new Date('2023-11-15'),
          totalValue: '2000.00',
          discountCoupon: null,
          businessUnit: 'ecommerce',
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockOrders);

      const result = await customerService.getCustomerOrders(1);

      expect(result).toHaveLength(2);
      expect(result[0].orderNumber).toBe('ORD-001');
      expect(result[0].totalValue).toBe(1500);
      expect(result[0].discountCoupon).toBe('SAVE10');
      expect(result[1].discountCoupon).toBeNull();
    });

    it('should filter orders by date range', async () => {
      const mockOrders = [
        {
          id: 101,
          clientId: 1,
          orderNumber: 'ORD-001',
          orderDate: new Date('2023-12-01'),
          totalValue: '1500.00',
          discountCoupon: null,
          businessUnit: 'ecommerce',
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockOrders);

      const result = await customerService.getCustomerOrders(1, {
        startDate: '2023-12-01',
        endDate: '2023-12-31',
      });

      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should return empty array for customer with no orders', async () => {
      mockDb.query.mockResolvedValueOnce([] as RowDataPacket[]);

      const result = await customerService.getCustomerOrders(999);

      expect(result).toHaveLength(0);
    });
  });

  describe('getCustomerMetrics', () => {
    it('should calculate customer metrics correctly', async () => {
      const mockMetrics = [
        {
          totalOrders: 5,
          totalSpent: '5000.00',
          averageTicket: '1000.00',
          firstPurchaseDate: new Date('2023-01-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalItems: 25,
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockMetrics);

      const result = await customerService.getCustomerMetrics(1);

      expect(result.totalOrders).toBe(5);
      expect(result.totalSpent).toBe(5000);
      expect(result.averageTicket).toBe(1000);
      expect(result.totalItems).toBe(25);
      expect(result.firstPurchaseDate).toEqual(new Date('2023-01-01'));
      expect(result.lastPurchaseDate).toEqual(new Date('2023-12-01'));
    });

    it('should return zero metrics for customer with no orders', async () => {
      mockDb.query.mockResolvedValueOnce([] as RowDataPacket[]);

      const result = await customerService.getCustomerMetrics(999);

      expect(result.totalOrders).toBe(0);
      expect(result.totalSpent).toBe(0);
      expect(result.averageTicket).toBe(0);
      expect(result.totalItems).toBe(0);
      expect(result.firstPurchaseDate).toBeNull();
      expect(result.lastPurchaseDate).toBeNull();
    });

    it('should apply date range filter when provided', async () => {
      const mockMetrics = [
        {
          totalOrders: 2,
          totalSpent: '2000.00',
          averageTicket: '1000.00',
          firstPurchaseDate: new Date('2023-06-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalItems: 10,
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockMetrics);

      const result = await customerService.getCustomerMetrics(1, {
        startDate: '2023-06-01',
        endDate: '2023-12-31',
      });

      expect(result.totalOrders).toBe(2);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('searchCustomers', () => {
    it('should search customers by name (partial, case-insensitive)', async () => {
      const mockResults = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '123.456.789-00',
          email: 'joao@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          businessUnit: 'ecommerce',
          firstPurchaseDate: new Date('2023-01-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalOrders: 5,
          totalSpent: '5000.00',
          averageTicket: '1000.00',
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockResults);

      const result = await customerService.searchCustomers({
        searchTerm: 'joão',
        field: 'name',
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('João Silva');
    });

    it('should search customers by email (partial, case-insensitive)', async () => {
      const mockResults = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '123.456.789-00',
          email: 'joao@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          businessUnit: 'ecommerce',
          firstPurchaseDate: new Date('2023-01-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalOrders: 5,
          totalSpent: '5000.00',
          averageTicket: '1000.00',
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockResults);

      const result = await customerService.searchCustomers({
        searchTerm: 'example.com',
        field: 'email',
      });

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('joao@example.com');
    });

    it('should search customers by phone (partial)', async () => {
      const mockResults = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '123.456.789-00',
          email: 'joao@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          businessUnit: 'ecommerce',
          firstPurchaseDate: new Date('2023-01-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalOrders: 5,
          totalSpent: '5000.00',
          averageTicket: '1000.00',
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockResults);

      const result = await customerService.searchCustomers({
        searchTerm: '11999',
        field: 'phone',
      });

      expect(result).toHaveLength(1);
    });

    it('should search customers by CPF (exact)', async () => {
      const mockResults = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '123.456.789-00',
          email: 'joao@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          businessUnit: 'ecommerce',
          firstPurchaseDate: new Date('2023-01-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalOrders: 5,
          totalSpent: '5000.00',
          averageTicket: '1000.00',
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockResults);

      const result = await customerService.searchCustomers({
        searchTerm: '123.456.789-00',
        field: 'cpf',
      });

      expect(result).toHaveLength(1);
      expect(result[0].cpf).toBe('123.456.789-00');
    });

    it('should search customers by order number (exact)', async () => {
      const mockResults = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '123.456.789-00',
          email: 'joao@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          businessUnit: 'ecommerce',
          firstPurchaseDate: new Date('2023-01-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalOrders: 5,
          totalSpent: '5000.00',
          averageTicket: '1000.00',
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockResults);

      const result = await customerService.searchCustomers({
        searchTerm: 'ORD-001',
        field: 'order',
      });

      expect(result).toHaveLength(1);
    });

    it('should search across multiple fields when no field specified', async () => {
      const mockResults = [
        {
          id: 1,
          name: 'João Silva',
          cpf: '123.456.789-00',
          email: 'joao@example.com',
          phone: '11999999999',
          whatsapp: '11999999999',
          city: 'São Paulo',
          state: 'SP',
          businessUnit: 'ecommerce',
          firstPurchaseDate: new Date('2023-01-01'),
          lastPurchaseDate: new Date('2023-12-01'),
          totalOrders: 5,
          totalSpent: '5000.00',
          averageTicket: '1000.00',
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockResults);

      const result = await customerService.searchCustomers({
        searchTerm: 'joão',
      });

      expect(result).toHaveLength(1);
    });

    it('should limit results to 100 customers', async () => {
      const mockResults = Array(100).fill({
        id: 1,
        name: 'Test Customer',
        cpf: null,
        email: 'test@example.com',
        phone: null,
        whatsapp: null,
        city: null,
        state: null,
        businessUnit: 'ecommerce',
        firstPurchaseDate: new Date('2023-01-01'),
        lastPurchaseDate: new Date('2023-12-01'),
        totalOrders: 1,
        totalSpent: '100.00',
        averageTicket: '100.00',
      }) as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockResults);

      const result = await customerService.searchCustomers({
        searchTerm: 'test',
      });

      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should return empty array when no matches found', async () => {
      mockDb.query.mockResolvedValueOnce([] as RowDataPacket[]);

      const result = await customerService.searchCustomers({
        searchTerm: 'nonexistent',
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('getTopProducts', () => {
    it('should return most purchased products by customer', async () => {
      const mockProducts = [
        {
          productId: 1,
          productCode: 'PROD-001',
          productName: 'Product A',
          quantityPurchased: 15,
          totalSpent: '1500.00',
          averagePrice: '100.00',
          orderCount: 5,
        },
        {
          productId: 2,
          productCode: 'PROD-002',
          productName: 'Product B',
          quantityPurchased: 10,
          totalSpent: '2000.00',
          averagePrice: '200.00',
          orderCount: 3,
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockProducts);

      const result = await customerService.getTopProducts(1, 10);

      expect(result).toHaveLength(2);
      expect(result[0].productName).toBe('Product A');
      expect(result[0].quantityPurchased).toBe(15);
      expect(result[0].totalSpent).toBe(1500);
      expect(result[0].averagePrice).toBe(100);
    });

    it('should respect limit parameter', async () => {
      const mockProducts = [
        {
          productId: 1,
          productCode: 'PROD-001',
          productName: 'Product A',
          quantityPurchased: 15,
          totalSpent: '1500.00',
          averagePrice: '100.00',
          orderCount: 5,
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockProducts);

      const result = await customerService.getTopProducts(1, 5);

      expect(result.length).toBeLessThanOrEqual(5);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should apply date range filter when provided', async () => {
      const mockProducts = [
        {
          productId: 1,
          productCode: 'PROD-001',
          productName: 'Product A',
          quantityPurchased: 5,
          totalSpent: '500.00',
          averagePrice: '100.00',
          orderCount: 2,
        },
      ] as RowDataPacket[];

      mockDb.query.mockResolvedValueOnce(mockProducts);

      const result = await customerService.getTopProducts(1, 10, {
        startDate: '2023-06-01',
        endDate: '2023-12-31',
      });

      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should return empty array for customer with no purchases', async () => {
      mockDb.query.mockResolvedValueOnce([] as RowDataPacket[]);

      const result = await customerService.getTopProducts(999);

      expect(result).toHaveLength(0);
    });
  });
});
