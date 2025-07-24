import axios, { AxiosResponse } from 'axios';
import { AICallRequest, AICallResponse } from '../types/call.types';
import { logger } from '../utils/logger';

export class AICallService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly webhookBaseUrl: string;

  constructor() {
    this.apiUrl = process.env.AI_CALL_API_URL || 'https://provider.com/api/v1/calls';
    this.apiKey = process.env.AI_CALL_API_KEY || '';
    this.webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'https://our-service.com';
  }

  async initiateCall(to: string, scriptId: string, callId: string): Promise<AICallResponse> {
    const webhookUrl = `${this.webhookBaseUrl}/callbacks/call-status`;
    
    const payload: AICallRequest = {
      to,
      scriptId,
      webhookUrl
    };

    logger.info(`Initiating AI call for ${to} with script ${scriptId}`, {
      callId,
      payload
    });

    try {
      const response: AxiosResponse<AICallResponse> = await axios.post(
        this.apiUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 30000 // 30 seconds timeout
        }
      );

      if (response.status === 202) {
        logger.info(`AI call initiated successfully`, {
          callId,
          externalCallId: response.data.callId
        });
        return response.data;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error: any) {
      logger.error(`Failed to initiate AI call`, {
        callId,
        error: error.message,
        response: error.response?.data
      });

      // Determine if this is a retryable error
      if (this.isRetryableError(error)) {
        throw new RetryableError(error.message);
      } else {
        throw new NonRetryableError(error.message);
      }
    }
  }

  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // 5xx server errors are retryable
    if (error.response?.status >= 500) {
      return true;
    }

    // 429 rate limit is retryable
    if (error.response?.status === 429) {
      return true;
    }

    // 4xx client errors (except 429) are not retryable
    return false;
  }
}

export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}