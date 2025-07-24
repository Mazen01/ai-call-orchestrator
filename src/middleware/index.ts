import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
};

// Error handling middleware
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

// Webhook authentication middleware (optional)
export const authenticateWebhook = (req: Request, res: Response, next: NextFunction) => {
  // In production, verify webhook signature using HMAC
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    return next(); // Skip authentication if no secret configured
  }

  const signature = req.get('X-Webhook-Signature');
  if (!signature) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing webhook signature'
    });
  }

  // TODO: Implement HMAC signature verification
  // const expectedSignature = crypto
  //   .createHmac('sha256', webhookSecret)
  //   .update(JSON.stringify(req.body))
  //   .digest('hex');
  
  // if (signature !== expectedSignature) {
  //   return res.status(401).json({
  //     error: 'Unauthorized',
  //     message: 'Invalid webhook signature'
  //   });
  // }

  next();
};

// Rate limiting middleware (basic implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (maxRequests: number = 100, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    const clientData = requestCounts.get(clientIp);
    
    if (!clientData || now > clientData.resetTime) {
      requestCounts.set(clientIp, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded'
      });
    }
    
    clientData.count++;
    next();
  };
};