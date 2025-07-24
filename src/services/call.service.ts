import { CallRepository } from '../repositories/call.repository';
import { AICallService, RetryableError } from './aiCall.service';
import { ConcurrencyManager } from './concurrency.service';
import { QueueService } from './queue.service';
import { 
  Call, 
  CallStatus, 
  CreateCallRequest, 
  UpdateCallRequest, 
  CallListQuery, 
  CallMetrics,
  WebhookCallbackPayload 
} from '../types/call.types';
import { CallEntity } from '../entities/Call.entity';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class CallService {
  private callRepository: CallRepository;
  private aiCallService: AICallService;
  private concurrencyManager: ConcurrencyManager;
  private queueService: QueueService;
  private readonly maxRetryAttempts: number;

  constructor() {
    this.callRepository = new CallRepository();
    this.aiCallService = new AICallService();
    this.concurrencyManager = new ConcurrencyManager();
    this.queueService = new QueueService();
    this.maxRetryAttempts = parseInt(process.env.MAX_RETRY_ATTEMPTS || '3');
  }

  async createCall(request: CreateCallRequest): Promise<Call> {
    logger.info('Creating new call', { request });

    // Check if there's already a PENDING or IN_PROGRESS call for this phone number
    const existingCall = await this.callRepository.findActiveCallByPhoneNumber(request.to);
    
    if (existingCall) {
      throw new Error(`Call already active for phone number: ${request.to} (Status: ${existingCall.status})`);
    }

    const callEntity = await this.callRepository.create({
      payload: {
        to: request.to,
        scriptId: request.scriptId,
        metadata: request.metadata
      },
      status: CallStatus.PENDING,
      attempts: 0
    });

    logger.info('Call created successfully', { 
      callId: callEntity.id,
      payload: callEntity.payload 
    });

    return this.entityToCall(callEntity);
  }

  async getCall(id: string): Promise<Call | null> {
    const callEntity = await this.callRepository.findById(id);
    return callEntity ? this.entityToCall(callEntity) : null;
  }

  async updateCall(id: string, request: UpdateCallRequest): Promise<Call | null> {
    const existingCall = await this.callRepository.findById(id);
    
    if (!existingCall) {
      return null;
    }

    if (existingCall.status !== CallStatus.PENDING) {
      throw new Error('Can only update calls with PENDING status');
    }

    const updatedEntity = await this.callRepository.updateById(id, {
      payload: { ...existingCall.payload, ...request.payload }
    });

    return updatedEntity ? this.entityToCall(updatedEntity) : null;
  }

  async getCallsByStatus(query: CallListQuery): Promise<{ calls: Call[], total: number, page: number, limit: number }> {
    const { calls, total } = await this.callRepository.findWithPagination(query);
    
    return {
      calls: calls.map(entity => this.entityToCall(entity)),
      total,
      page: query.page || 1,
      limit: query.limit || 10
    };
  }

  async getMetrics(): Promise<CallMetrics> {
    return await this.callRepository.countByStatus();
  }

  // Worker process to handle call queue
  async processCallQueue(): Promise<void> {
    logger.info('Starting call queue processing');

    while (true) {
      try {
        // Check if we can process more calls
        const canProcess = await this.concurrencyManager.canAcquireSlot();
        if (!canProcess) {
          logger.debug('Maximum concurrent calls reached, waiting...');
          await this.sleep(5000); // Wait 5 seconds
          continue;
        }

        // Fetch and lock a pending call
        const callEntity = await this.callRepository.fetchAndLockPendingCall();
        if (!callEntity) {
          logger.debug('No pending calls found, waiting...');
          await this.sleep(2000); // Wait 2 seconds
          continue;
        }

        // Validate the call entity
        if (!callEntity.id) {
          logger.error('Invalid call entity: missing ID', { callEntity });
          continue;
        }

        // Acquire concurrency slot
        await this.concurrencyManager.acquireSlot();

        // Process the call asynchronously
        this.processCall(callEntity).catch(error => {
          logger.error('Error processing call', {
            callId: callEntity.id,
            error: error.message
          });
        });

      } catch (error: any) {
        logger.error('Error in call queue processing', { error: error.message });
        await this.sleep(5000);
      }
    }
  }

  private async processCall(callEntity: CallEntity): Promise<void> {
    try {
      logger.info('Processing call', { 
        callId: callEntity.id,
        payload: callEntity.payload 
      });

      // Validate that we have the required data
      if (!callEntity.payload || !callEntity.payload.to || !callEntity.payload.scriptId) {
        throw new Error('Invalid call entity: missing required payload data');
      }

      // Initiate the AI call
      const aiResponse = await this.aiCallService.initiateCall(
        callEntity.payload.to,
        callEntity.payload.scriptId,
        callEntity.id
      );

      // Update call with external call ID
      await this.callRepository.updateById(callEntity.id, {
        externalCallId: aiResponse.callId
      });

      logger.info('AI call initiated successfully', {
        callId: callEntity.id,
        externalCallId: aiResponse.callId
      });

    } catch (error: any) {
      logger.error('Failed to process call', {
        callId: callEntity.id,
        error: error.message,
        attempts: callEntity.attempts,
        payload: callEntity.payload
      });

      await this.handleCallFailure(callEntity, error);
    }
  }

  private async handleCallFailure(callEntity: CallEntity, error: Error): Promise<void> {
    // Ensure we have a valid call ID
    if (!callEntity || !callEntity.id) {
      logger.error('Cannot handle call failure: invalid call entity', { callEntity });
      await this.concurrencyManager.releaseSlot();
      return;
    }

    const newAttempts = (callEntity.attempts || 0) + 1;

    // Check if this is a retryable error and we haven't exceeded max attempts
    if (error instanceof RetryableError && newAttempts < this.maxRetryAttempts) {
      logger.info('Retrying call', {
        callId: callEntity.id,
        attempts: newAttempts,
        maxAttempts: this.maxRetryAttempts
      });

      // Update attempts and reset status to PENDING for retry
      await this.callRepository.updateById(callEntity.id, {
        status: CallStatus.PENDING,
        attempts: newAttempts,
        lastError: error.message,
        startedAt: undefined // Reset started time
      });

      // Re-enqueue with exponential backoff
      const backoffDelay = Math.pow(2, newAttempts) * 1000; // 2^attempts seconds
      await this.queueService.enqueueCallWithDelay(callEntity.id, backoffDelay);

    } else {
      // Mark as failed
      logger.error('Call failed permanently', {
        callId: callEntity.id,
        attempts: newAttempts,
        error: error.message
      });

      await this.callRepository.updateById(callEntity.id, {
        status: CallStatus.FAILED,
        attempts: newAttempts,
        lastError: error.message,
        endedAt: new Date()
      });
    }

    // Release concurrency slot
    await this.concurrencyManager.releaseSlot();
  }

  // Webhook handler for AI call completion
  async handleWebhookCallback(payload: WebhookCallbackPayload): Promise<void> {
    logger.info('Received webhook callback', { payload });

    const callEntity = await this.callRepository.findByExternalCallId(payload.callId);
    if (!callEntity) {
      logger.warn('Received callback for unknown call', { externalCallId: payload.callId });
      return;
    }

    const isSuccess = payload.status === 'COMPLETED';
    const finalStatus = isSuccess ? CallStatus.COMPLETED : CallStatus.FAILED;

    await this.callRepository.updateById(callEntity.id, {
      status: finalStatus,
      endedAt: new Date(payload.completedAt),
      lastError: isSuccess ? undefined : `AI call ${payload.status}`
    });

    // Release concurrency slot
    await this.concurrencyManager.releaseSlot();

    logger.info('Call status updated from webhook', {
      callId: callEntity.id,
      externalCallId: payload.callId,
      status: finalStatus
    });
  }

  private entityToCall(entity: CallEntity): Call {
    return {
      id: entity.id,
      payload: entity.payload,
      status: entity.status,
      attempts: entity.attempts,
      lastError: entity.lastError,
      createdAt: entity.createdAt,
      startedAt: entity.startedAt,
      endedAt: entity.endedAt
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}