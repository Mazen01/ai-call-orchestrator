import { Request, Response } from 'express';
import { CallService } from '../services/call.service';
import { CreateCallRequest, UpdateCallRequest, CallListQuery, WebhookCallbackPayload } from '../types/call.types';
import { logger } from '../utils/logger';
import { validateCreateCall, validateUpdateCall, validateWebhookPayload } from '../utils/validation';

export class CallController {
  private callService: CallService;

  constructor() {
    this.callService = new CallService();
  }

  // POST /calls
  createCall = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateCreateCall(req.body);
      if (error) {
        res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const request: CreateCallRequest = value;
      const call = await this.callService.createCall(request);

      logger.info('Call created successfully', { callId: call.id });
      
      res.status(201).json({
        success: true,
        data: call
      });
    } catch (error: any) {
      logger.error('Error creating call', { error: error.message });
      
      if (error.message.includes('already in progress')) {
        res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
        return;
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create call'
      });
    }
  };

  // GET /calls/:id
  getCall = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const call = await this.callService.getCall(id);

      if (!call) {
        res.status(404).json({
          error: 'Not found',
          message: 'Call not found'
        });
        return;
      }

      res.json({
        success: true,
        data: call
      });
    } catch (error: any) {
      logger.error('Error fetching call', { error: error.message, callId: req.params.id });
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch call'
      });
    }
  };

  // PATCH /calls/:id
  updateCall = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { error, value } = validateUpdateCall(req.body);
      
      if (error) {
        res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const request: UpdateCallRequest = value;
      const call = await this.callService.updateCall(id, request);

      if (!call) {
        res.status(404).json({
          error: 'Not found',
          message: 'Call not found'
        });
        return;
      }

      logger.info('Call updated successfully', { callId: id });
      
      res.json({
        success: true,
        data: call
      });
    } catch (error: any) {
      logger.error('Error updating call', { error: error.message, callId: req.params.id });
      
      if (error.message.includes('PENDING status')) {
        res.status(400).json({
          error: 'Bad request',
          message: error.message
        });
        return;
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update call'
      });
    }
  };

  // GET /calls?status=PENDING&page=1&limit=10
  listCalls = async (req: Request, res: Response): Promise<void> => {
    try {
      const query: CallListQuery = {
        status: req.query.status as any,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };

      // Validate pagination parameters
      if (query.page && query.page < 1) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Page must be greater than 0'
        });
        return;
      }

      if (query.limit && (query.limit < 1 || query.limit > 100)) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Limit must be between 1 and 100'
        });
        return;
      }

      const result = await this.callService.getCallsByStatus(query);

      res.json({
        success: true,
        data: result.calls,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error: any) {
      logger.error('Error listing calls', { error: error.message, query: req.query });
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list calls'
      });
    }
  };

  // GET /metrics
  getMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const metrics = await this.callService.getMetrics();

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error fetching metrics', { error: error.message });
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch metrics'
      });
    }
  };

  // POST /callbacks/call-status
  handleWebhookCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = validateWebhookPayload(req.body);
      if (error) {
        res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const payload: WebhookCallbackPayload = value;
      await this.callService.handleWebhookCallback(payload);

      logger.info('Webhook callback processed successfully', { 
        externalCallId: payload.callId,
        status: payload.status
      });

      res.status(200).json({
        success: true,
        message: 'Callback processed successfully'
      });
    } catch (error: any) {
      logger.error('Error processing webhook callback', { 
        error: error.message,
        payload: req.body
      });
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process callback'
      });
    }
  };
}