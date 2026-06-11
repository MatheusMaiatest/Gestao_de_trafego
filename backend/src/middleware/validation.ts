import { body, query, param, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Validation middleware for date range parameters
 * Requirements: 3.4, 20.1
 */
export const validateDateRange = (): ValidationChain[] => {
  return [
    query('startDate')
      .notEmpty()
      .withMessage('Start date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Start date must be in YYYY-MM-DD format')
      .isISO8601()
      .withMessage('Start date must be a valid date'),
    
    query('endDate')
      .notEmpty()
      .withMessage('End date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('End date must be in YYYY-MM-DD format')
      .isISO8601()
      .withMessage('End date must be a valid date')
      .custom((endDate, { req }) => {
        const startDate = req.query?.startDate as string;
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          if (end < start) {
            throw new Error('End date must be greater than or equal to start date');
          }
        }
        return true;
      })
  ];
};

/**
 * Validation middleware for business unit parameter
 * Requirements: 20.4
 */
export const validateBusinessUnit = (): ValidationChain[] => {
  return [
    query('businessUnit')
      .optional()
      .isIn(['ecommerce', 'distributor', 'all'])
      .withMessage('Business unit must be "ecommerce", "distributor", or "all"')
  ];
};

/**
 * Validation middleware for pagination parameters
 * Requirements: 20.4
 */
export const validatePagination = (): ValidationChain[] => {
  return [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be a positive integer between 1 and 100')
      .toInt()
  ];
};

/**
 * Sanitization middleware for search input
 * Removes SQL special characters to prevent SQL injection
 * Requirements: 20.2, 20.5
 */
export const sanitizeSearchInput = (): ValidationChain[] => {
  return [
    query('search')
      .optional()
      .trim()
      .escape()
      .customSanitizer((value: string) => {
        // Remove SQL special characters that could be used for injection
        // Keep alphanumeric, spaces, @, ., -, and common punctuation
        return value.replace(/[';\"\\`|=<>()]/g, '');
      })
      .isLength({ max: 255 })
      .withMessage('Search term must not exceed 255 characters'),
    
    query('q')
      .optional()
      .trim()
      .escape()
      .customSanitizer((value: string) => {
        // Same sanitization for 'q' parameter used in search endpoints
        return value.replace(/[';\"\\`|=<>()]/g, '');
      })
      .isLength({ max: 255 })
      .withMessage('Search query must not exceed 255 characters')
  ];
};

/**
 * Validation middleware for segment type parameter
 * Requirements: 20.4
 */
export const validateSegmentType = (): ValidationChain[] => {
  const validSegments = [
    'recorrente',
    'inativo',
    'em-risco',
    'novo',
    'vip',
    'campeoes',
    'fieis',
    'potenciais-fieis',
    'promissores',
    'em-risco',
    'hibernando',
    'perdidos'
  ];

  return [
    param('segmentType')
      .optional()
      .isIn(validSegments)
      .withMessage(`Segment type must be one of: ${validSegments.join(', ')}`),
    
    query('segment')
      .optional()
      .isIn(validSegments)
      .withMessage(`Segment must be one of: ${validSegments.join(', ')}`)
  ];
};

/**
 * Validation middleware for search field parameter
 * Requirements: 20.4
 */
export const validateSearchField = (): ValidationChain[] => {
  return [
    query('field')
      .optional()
      .isIn(['name', 'email', 'phone', 'cpf', 'whatsapp', 'order'])
      .withMessage('Field must be one of: name, email, phone, cpf, whatsapp, order')
  ];
};

/**
 * Validation middleware for product sorting parameters
 * Requirements: 20.4
 */
export const validateProductSorting = (): ValidationChain[] => {
  return [
    query('sortBy')
      .optional()
      .isIn(['quantity', 'revenue'])
      .withMessage('Sort by must be "quantity" or "revenue"'),
    
    query('order')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Order must be "asc" or "desc"'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be a positive integer between 1 and 100')
      .toInt()
  ];
};

/**
 * Validation middleware for geolocation parameters
 * Requirements: 20.4
 */
export const validateGeolocation = (): ValidationChain[] => {
  return [
    query('groupBy')
      .optional()
      .isIn(['state', 'city'])
      .withMessage('Group by must be "state" or "city"'),
    
    query('states')
      .optional()
      .isArray()
      .withMessage('States must be an array')
      .custom((states: string[]) => {
        // Validate each state is a 2-letter code
        const stateRegex = /^[A-Z]{2}$/;
        const allValid = states.every(state => stateRegex.test(state));
        if (!allValid) {
          throw new Error('Each state must be a 2-letter uppercase code');
        }
        return true;
      })
  ];
};

/**
 * Validation middleware for export format
 * Requirements: 20.4
 */
export const validateExportFormat = (): ValidationChain[] => {
  return [
    body('format')
      .notEmpty()
      .withMessage('Format is required')
      .isIn(['xlsx', 'csv', 'pdf'])
      .withMessage('Format must be "xlsx", "csv", or "pdf"')
  ];
};

/**
 * Validation middleware for customer ID parameter
 * Requirements: 20.4
 */
export const validateCustomerId = (): ValidationChain[] => {
  return [
    param('id')
      .notEmpty()
      .withMessage('Customer ID is required')
      .isInt({ min: 1 })
      .withMessage('Customer ID must be a positive integer')
      .toInt()
  ];
};

/**
 * Validation middleware for product ID parameter
 * Requirements: 20.4
 */
export const validateProductId = (): ValidationChain[] => {
  return [
    param('id')
      .notEmpty()
      .withMessage('Product ID is required')
      .isInt({ min: 1 })
      .withMessage('Product ID must be a positive integer')
      .toInt()
  ];
};

/**
 * Error handler middleware for validation errors
 * Returns structured error responses
 * Requirements: 20.5
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined
    }));

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: formattedErrors,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  next();
};

/**
 * Combined validation middleware for common API endpoint patterns
 */
export const validateCommonFilters = (): ValidationChain[] => {
  return [
    ...validateDateRange(),
    ...validateBusinessUnit(),
    ...validatePagination()
  ];
};

/**
 * Validation middleware for RFM parameters
 * Requirements: 20.4
 */
export const validateRFMParameters = (): ValidationChain[] => {
  return [
    ...validateDateRange(),
    ...validateBusinessUnit()
  ];
};

/**
 * Validation middleware for customer search
 * Requirements: 20.2, 20.4
 */
export const validateCustomerSearch = (): ValidationChain[] => {
  return [
    ...sanitizeSearchInput(),
    ...validateSearchField(),
    ...validatePagination()
  ];
};
