export interface CallPayload {
    to: string; // e.g. "+966501234567"
    scriptId: string; // identifier of call script / flow
    metadata?: Record<string, any>;
  }
  
  export enum CallStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    EXPIRED = 'EXPIRED'
  }
  
  export interface Call {
    id: string; // UUID
    payload: CallPayload;
    status: CallStatus;
    attempts: number;
    lastError?: string;
    createdAt: Date;
    startedAt?: Date;
    endedAt?: Date;
  }
  
  export interface CreateCallRequest {
    to: string;
    scriptId: string;
    metadata?: Record<string, any>;
  }
  
  export interface UpdateCallRequest {
    payload?: Partial<CallPayload>;
  }
  
  export interface CallListQuery {
    status?: CallStatus;
    page?: number;
    limit?: number;
  }
  
  export interface CallMetrics {
    [CallStatus.PENDING]: number;
    [CallStatus.IN_PROGRESS]: number;
    [CallStatus.COMPLETED]: number;
    [CallStatus.FAILED]: number;
    [CallStatus.EXPIRED]: number;
    total: number;
  }
  
  // External AI Call API types
  export interface AICallRequest {
    to: string;
    scriptId: string;
    webhookUrl: string;
  }
  
  export interface AICallResponse {
    callId: string;
    status: string;
  }
  
  export interface WebhookCallbackPayload {
    callId: string;
    status: 'COMPLETED' | 'FAILED' | 'BUSY' | 'NO_ANSWER';
    durationSec?: number;
    completedAt: string;
  }