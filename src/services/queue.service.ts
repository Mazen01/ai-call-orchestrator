import { logger } from '../utils/logger';

// Simple in-memory queue implementation
// In production, you would use Kafka, Redis, or another queue system
export class QueueService {
  private queue: Array<{ callId: string; scheduledAt: Date }> = [];
  private processing = false;

  async enqueueCall(callId: string): Promise<void> {
    this.queue.push({
      callId,
      scheduledAt: new Date()
    });

    logger.debug('Call enqueued', {
      callId,
      queueLength: this.queue.length
    });
  }

  async enqueueCallWithDelay(callId: string, delayMs: number): Promise<void> {
    const scheduledAt = new Date(Date.now() + delayMs);
    
    this.queue.push({
      callId,
      scheduledAt
    });

    logger.debug('Call enqueued with delay', {
      callId,
      delayMs,
      scheduledAt,
      queueLength: this.queue.length
    });
  }

  async dequeueCall(): Promise<string | null> {
    const now = new Date();
    
    // Find the first call that is ready to be processed
    const readyIndex = this.queue.findIndex(item => item.scheduledAt <= now);
    
    if (readyIndex === -1) {
      return null;
    }

    const item = this.queue.splice(readyIndex, 1)[0];
    
    logger.debug('Call dequeued', {
      callId: item.callId,
      queueLength: this.queue.length
    });

    return item.callId;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getReadyCallsCount(): number {
    const now = new Date();
    return this.queue.filter(item => item.scheduledAt <= now).length;
  }

  // For production, implement with Kafka
  /*
  import { Kafka, Producer, Consumer } from 'kafkajs';

  export class KafkaQueueService {
    private kafka: Kafka;
    private producer: Producer;
    private consumer: Consumer;
    private readonly topicName: string;

    constructor() {
      this.topicName = process.env.KAFKA_TOPIC || 'call_requests';
      this.kafka = new Kafka({
        clientId: 'ai-call-orchestrator',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
      });
      
      this.producer = this.kafka.producer();
      this.consumer = this.kafka.consumer({ 
        groupId: 'call-processor-group' 
      });
    }

    async initialize(): Promise<void> {
      await this.producer.connect();
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: this.topicName });
    }

    async enqueueCall(callId: string): Promise<void> {
      await this.producer.send({
        topic: this.topicName,
        messages: [{
          key: callId,
          value: JSON.stringify({ callId, timestamp: Date.now() })
        }]
      });
    }

    async enqueueCallWithDelay(callId: string, delayMs: number): Promise<void> {
      await this.producer.send({
        topic: this.topicName,
        messages: [{
          key: callId,
          value: JSON.stringify({ 
            callId, 
            timestamp: Date.now(),
            scheduledAt: Date.now() + delayMs
          })
        }]
      });
    }

    async startConsumer(messageHandler: (callId: string) => Promise<void>): Promise<void> {
      await this.consumer.run({
        eachMessage: async ({ message }) => {
          if (message.value) {
            const data = JSON.parse(message.value.toString());
            
            // Check if message should be delayed
            if (data.scheduledAt && data.scheduledAt > Date.now()) {
              // Re-enqueue with remaining delay
              const remainingDelay = data.scheduledAt - Date.now();
              await this.enqueueCallWithDelay(data.callId, remainingDelay);
              return;
            }

            await messageHandler(data.callId);
          }
        }
      });
    }

    async disconnect(): Promise<void> {
      await this.producer.disconnect();
      await this.consumer.disconnect();
    }
  }
  */
}