import { CallRepository } from '../repositories/call.repository';
import { logger } from '../utils/logger';

export class ConcurrencyManager {
  private readonly maxConcurrentCalls: number;
  private callRepository: CallRepository;

  constructor() {
    this.maxConcurrentCalls = parseInt(process.env.MAX_CONCURRENT_CALLS || '30');
    this.callRepository = new CallRepository();
  }

  async canAcquireSlot(): Promise<boolean> {
    const currentInProgress = await this.callRepository.countInProgress();
    const canAcquire = currentInProgress < this.maxConcurrentCalls;
    
    logger.debug('Checking concurrency slot availability', {
      currentInProgress,
      maxConcurrentCalls: this.maxConcurrentCalls,
      canAcquire
    });

    return canAcquire;
  }

  async acquireSlot(): Promise<void> {
    const currentInProgress = await this.callRepository.countInProgress();
    
    if (currentInProgress >= this.maxConcurrentCalls) {
      throw new Error(`Cannot acquire slot: maximum concurrent calls (${this.maxConcurrentCalls}) reached`);
    }

    logger.debug('Concurrency slot acquired', {
      currentInProgress: currentInProgress + 1,
      maxConcurrentCalls: this.maxConcurrentCalls
    });
  }

  async releaseSlot(): Promise<void> {
    // The slot is automatically released when call status changes from IN_PROGRESS
    // This method exists for consistency and potential future enhancements
    const currentInProgress = await this.callRepository.countInProgress();
    
    logger.debug('Concurrency slot released', {
      currentInProgress,
      maxConcurrentCalls: this.maxConcurrentCalls
    });
  }

  async getCurrentConcurrency(): Promise<number> {
    return await this.callRepository.countInProgress();
  }

  getMaxConcurrency(): number {
    return this.maxConcurrentCalls;
  }
}