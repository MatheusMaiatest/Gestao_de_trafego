import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  validateDateRange,
  validateBusinessUnit,
  validatePagination,
  sanitizeSearchInput,
  validateSegmentType,
  validateSearchField,
  validateProductSorting,
  validateGeolocation,
  validateExportFormat,
  handleValidationErrors
} from './validation';

/**
 * Helper function to run validation chains
 */
const runValidation = async (
  validations: any[],
  req: Partial<Request>
): Promise<any> => {
  const mockReq = req as Request;

  for (const validation of validations) {
    await validation.run(mockReq);
  }

  const errors = validationResult(mockReq);
  return errors;
};

/**
 * Helper to create mock request object
 */
const createMockRequest = (query: any = {}, params: any = {}, body: any = {}): Partial<Request> => {
  return {
    query,
    params,
    body
  };
};

describe('Validation Middleware', () => {
  describe('validateDateRange', () => {
    it('should pass validation with valid date format (YYYY-MM-DD)', async () => {
      const req = createMockRequest({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

      const errors = await runValidation(validateDateRange(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail validation with invalid date format', async () => {
      const req = createMockRequest({
        startDate: '01/01/2024',
        endDate: '2024-12-31'
      });

      const errors = await runValidation(validateDateRange(), req);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()[0].msg).toContain('YYYY-MM-DD');
    });

    it('should fail validation when end date is before start date', async () => {
      const req = createMockRequest({
        startDate: '2024-12-31',
        endDate: '2024-01-01'
      });

      const errors = await runValidation(validateDateRange(), req);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array().some((e: any) => e.msg.includes('End date must be greater than or equal to start date'))).toBe(true);
    });

    it('should pass validation when end date equals start date', async () => {
      const req = createMockRequest({
        startDate: '2024-06-15',
        endDate: '2024-06-15'
      });

      const errors = await runValidation(validateDateRange(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail validation with missing dates', async () => {
      const req = createMockRequest({});

      const errors = await runValidation(validateDateRange(), req);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array().length).toBeGreaterThan(0);
    });

    it('should fail validation with invalid date values', async () => {
      const req = createMockRequest({
        startDate: '2024-13-45',
        endDate: '2024-02-30'
      });

      const errors = await runValidation(validateDateRange(), req);
      expect(errors.isEmpty()).toBe(false);
    });
  });

  describe('validateBusinessUnit', () => {
    it('should pass validation with "ecommerce"', async () => {
      const req = createMockRequest({ businessUnit: 'ecommerce' });

      const errors = await runValidation(validateBusinessUnit(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should pass validation with "distributor"', async () => {
      const req = createMockRequest({ businessUnit: 'distributor' });

      const errors = await runValidation(validateBusinessUnit(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should pass validation with "all"', async () => {
      const req = createMockRequest({ businessUnit: 'all' });

      const errors = await runValidation(validateBusinessUnit(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail validation with disallowed value', async () => {
      const req = createMockRequest({ businessUnit: 'invalid' });

      const errors = await runValidation(validateBusinessUnit(), req);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()[0].msg).toContain('ecommerce');
    });

    it('should pass validation when businessUnit is optional and not provided', async () => {
      const req = createMockRequest({});

      const errors = await runValidation(validateBusinessUnit(), req);
      expect(errors.isEmpty()).toBe(true);
    });
  });

  describe('validatePagination', () => {
    it('should pass validation with positive page and limit', async () => {
      const req = createMockRequest({ page: '1', limit: '50' });

      const errors = await runValidation(validatePagination(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail validation with negative page', async () => {
      const req = createMockRequest({ page: '-1', limit: '50' });

      const errors = await runValidation(validatePagination(), req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should fail validation with zero page', async () => {
      const req = createMockRequest({ page: '0', limit: '50' });

      const errors = await runValidation(validatePagination(), req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should fail validation with zero limit', async () => {
      const req = createMockRequest({ page: '1', limit: '0' });

      const errors = await runValidation(validatePagination(), req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should fail validation with limit exceeding maximum (100)', async () => {
      const req = createMockRequest({ page: '1', limit: '101' });

      const errors = await runValidation(validatePagination(), req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should pass validation when pagination params are optional and not provided', async () => {
      const req = createMockRequest({});

      const errors = await runValidation(validatePagination(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail validation with non-integer values', async () => {
      const req = createMockRequest({ page: 'abc', limit: 'xyz' });

      const errors = await runValidation(validatePagination(), req);
      expect(errors.isEmpty()).toBe(false);
    });
  });

  describe('sanitizeSearchInput', () => {
    it('should remove SQL special characters from search input', async () => {
      const req = createMockRequest({ search: "test'; DROP TABLE users;--" });

      const validations = sanitizeSearchInput();
      for (const validation of validations) {
        await validation.run(req as Request);
      }

      // Check that dangerous characters are removed (note: escape() converts ' to &#x27;)
      expect(req.query?.search).not.toContain(';');
      expect(req.query?.search).not.toContain('=');
      // After escaping and sanitization, double dashes may remain but quotes are escaped
    });

    it('should remove SQL injection attempts with quotes and equals', async () => {
      const req = createMockRequest({ q: "admin' OR '1'='1" });

      const validations = sanitizeSearchInput();
      for (const validation of validations) {
        await validation.run(req as Request);
      }

      expect(req.query?.q).not.toContain("'");
      expect(req.query?.q).not.toContain('=');
    });

    it('should allow normal search terms with alphanumeric and common characters', async () => {
      const req = createMockRequest({ search: 'John Doe @example.com' });

      const validations = sanitizeSearchInput();
      for (const validation of validations) {
        await validation.run(req as Request);
      }

      const errors = validationResult(req as Request);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail validation when search term exceeds 255 characters', async () => {
      const longString = 'a'.repeat(256);
      const req = createMockRequest({ search: longString });

      const errors = await runValidation(sanitizeSearchInput(), req);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()[0].msg).toContain('255 characters');
    });

    it('should trim whitespace from search input', async () => {
      const req = createMockRequest({ search: '  test query  ' });

      const validations = sanitizeSearchInput();
      for (const validation of validations) {
        await validation.run(req as Request);
      }

      expect(req.query?.search).not.toMatch(/^\s/);
      expect(req.query?.search).not.toMatch(/\s$/);
    });

    it('should handle both "search" and "q" parameters', async () => {
      const req1 = createMockRequest({ search: "test'; --" });
      const req2 = createMockRequest({ q: "test'; --" });

      const validations = sanitizeSearchInput();
      
      for (const validation of validations) {
        await validation.run(req1 as Request);
      }
      
      for (const validation of validations) {
        await validation.run(req2 as Request);
      }

      expect(req1.query?.search).not.toContain(';');
      expect(req2.query?.q).not.toContain(';');
    });
  });

  describe('validateSegmentType', () => {
    it('should pass validation with valid client segment "recorrente"', async () => {
      const req = createMockRequest({ segment: 'recorrente' });

      const errors = await runValidation(validateSegmentType(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should pass validation with valid RFM group "campeoes"', async () => {
      const req = createMockRequest({ segment: 'campeoes' });

      const errors = await runValidation(validateSegmentType(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should pass validation with "vip" segment', async () => {
      const req = createMockRequest({ segment: 'vip' });

      const errors = await runValidation(validateSegmentType(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should pass validation with segment as path parameter', async () => {
      const req = createMockRequest({}, { segmentType: 'fieis' });

      const errors = await runValidation(validateSegmentType(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail validation with invalid segment type', async () => {
      const req = createMockRequest({ segment: 'invalid-segment' });

      const errors = await runValidation(validateSegmentType(), req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should pass validation when segment is optional and not provided', async () => {
      const req = createMockRequest({});

      const errors = await runValidation(validateSegmentType(), req);
      expect(errors.isEmpty()).toBe(true);
    });
  });

  describe('validateSearchField', () => {
    it('should pass validation with all allowed field values', async () => {
      const allowedFields = ['name', 'email', 'phone', 'cpf', 'whatsapp', 'order'];

      for (const field of allowedFields) {
        const req = createMockRequest({ field });
        const errors = await runValidation(validateSearchField(), req);
        expect(errors.isEmpty()).toBe(true);
      }
    });

    it('should fail validation with disallowed field value', async () => {
      const req = createMockRequest({ field: 'invalid' });

      const errors = await runValidation(validateSearchField(), req);
      expect(errors.isEmpty()).toBe(false);
    });
  });

  describe('validateProductSorting', () => {
    it('should pass validation with valid sortBy and order', async () => {
      const req = createMockRequest({ sortBy: 'quantity', order: 'desc', limit: '20' });

      const errors = await runValidation(validateProductSorting(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail validation with invalid sortBy', async () => {
      const req = createMockRequest({ sortBy: 'invalid' });

      const errors = await runValidation(validateProductSorting(), req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should fail validation with invalid order', async () => {
      const req = createMockRequest({ order: 'invalid' });

      const errors = await runValidation(validateProductSorting(), req);
      expect(errors.isEmpty()).toBe(false);
    });
  });

  describe('validateGeolocation', () => {
    it('should pass validation with valid groupBy', async () => {
      const req = createMockRequest({ groupBy: 'state' });

      const errors = await runValidation(validateGeolocation(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should pass validation with valid states array', async () => {
      const req = createMockRequest({ states: ['SP', 'RJ', 'MG'] });

      const errors = await runValidation(validateGeolocation(), req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail validation with invalid state format', async () => {
      const req = createMockRequest({ states: ['SP', 'invalid', 'MG'] });

      const errors = await runValidation(validateGeolocation(), req);
      expect(errors.isEmpty()).toBe(false);
    });
  });

  describe('validateExportFormat', () => {
    it('should pass validation with valid formats', async () => {
      const formats = ['xlsx', 'csv', 'pdf'];

      for (const format of formats) {
        const req = createMockRequest({}, {}, { format });
        const errors = await runValidation(validateExportFormat(), req);
        expect(errors.isEmpty()).toBe(true);
      }
    });

    it('should fail validation with invalid format', async () => {
      const req = createMockRequest({}, {}, { format: 'doc' });

      const errors = await runValidation(validateExportFormat(), req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should fail validation with missing format', async () => {
      const req = createMockRequest({}, {}, {});

      const errors = await runValidation(validateExportFormat(), req);
      expect(errors.isEmpty()).toBe(false);
    });
  });

  describe('handleValidationErrors', () => {
    it('should return 400 with structured error response when validation fails', () => {
      const mockReq = createMockRequest({ businessUnit: 'invalid' }) as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      const mockNext = jest.fn();

      // Manually inject validation errors for testing
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'businessUnit',
            msg: 'Business unit must be "ecommerce", "distributor", or "all"',
            value: 'invalid'
          }
        ]
      };

      jest.spyOn(require('express-validator'), 'validationResult').mockReturnValue(mockErrors);

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'businessUnit',
                message: expect.any(String)
              })
            ]),
            timestamp: expect.any(String)
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() when validation passes', () => {
      const mockReq = {} as Request;
      const mockRes = {} as Response;
      const mockNext = jest.fn();

      const mockErrors = {
        isEmpty: () => true,
        array: () => []
      };

      jest.spyOn(require('express-validator'), 'validationResult').mockReturnValue(mockErrors);

      handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
