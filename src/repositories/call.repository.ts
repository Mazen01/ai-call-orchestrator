import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { CallEntity } from '../entities/Call.entity';
import { CallStatus, CallMetrics, CallListQuery } from '../types/call.types';

export class CallRepository {
  private repository: Repository<CallEntity>;

  constructor() {
    this.repository = AppDataSource.getRepository(CallEntity);
  }

  async create(callData: Partial<CallEntity>): Promise<CallEntity> {
    const call = this.repository.create(callData);
    return await this.repository.save(call);
  }

  async findById(id: string): Promise<CallEntity | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async updateById(id: string, updates: Partial<CallEntity>): Promise<CallEntity | null> {
    await this.repository.update(id, updates);
    return await this.findById(id);
  }

  async findByStatus(status: CallStatus, limit?: number): Promise<CallEntity[]> {
    const query = this.repository.createQueryBuilder('call')
      .where('call.status = :status', { status })
      .orderBy('call.createdAt', 'ASC');

    if (limit) {
      query.limit(limit);
    }

    return await query.getMany();
  }

  async findWithPagination(query: CallListQuery): Promise<{ calls: CallEntity[], total: number }> {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repository.createQueryBuilder('call');

    if (status) {
      queryBuilder.where('call.status = :status', { status });
    }

    queryBuilder
      .orderBy('call.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [calls, total] = await queryBuilder.getManyAndCount();

    return { calls, total };
  }

  // Simpler atomic operation to fetch and lock a pending call
  async fetchAndLockPendingCall(): Promise<CallEntity | null> {
    try {
      // Find the oldest pending call
      const pendingCall = await this.repository
        .createQueryBuilder('call')
        .where('call.status = :status', { status: CallStatus.PENDING })
        .orderBy('call.createdAt', 'ASC')
        .getOne();

      if (!pendingCall) {
        return null;
      }

      // Try to update it to IN_PROGRESS
      const updateResult = await this.repository
        .createQueryBuilder()
        .update(CallEntity)
        .set({
          status: CallStatus.IN_PROGRESS,
          startedAt: new Date()
        })
        .where('id = :id AND status = :status', { 
          id: pendingCall.id, 
          status: CallStatus.PENDING 
        })
        .execute();

      // If no rows were affected, another worker got it first
      if (updateResult.affected === 0) {
        return null;
      }

      // Return the updated call
      return await this.repository.findOne({
        where: { id: pendingCall.id }
      });

    } catch (error) {
      console.error('Error in fetchAndLockPendingCall:', error);
      return null;
    }
  }

  async countByStatus(): Promise<CallMetrics> {
    const counts = await this.repository
      .createQueryBuilder('call')
      .select('call.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('call.status')
      .getRawMany();

    const metrics: CallMetrics = {
      [CallStatus.PENDING]: 0,
      [CallStatus.IN_PROGRESS]: 0,
      [CallStatus.COMPLETED]: 0,
      [CallStatus.FAILED]: 0,
      [CallStatus.EXPIRED]: 0,
      total: 0
    };

    counts.forEach(({ status, count }) => {
      metrics[status as CallStatus] = parseInt(count);
      metrics.total += parseInt(count);
    });

    return metrics;
  }

  async countInProgress(): Promise<number> {
    return await this.repository.count({
      where: { status: CallStatus.IN_PROGRESS }
    });
  }

  async findByExternalCallId(externalCallId: string): Promise<CallEntity | null> {
    return await this.repository.findOne({
      where: { externalCallId }
    });
  }

  async findActiveCallByPhoneNumber(phoneNumber: string): Promise<CallEntity | null> {
    return await this.repository
      .createQueryBuilder('call')
      .where('call.status IN (:...statuses)', { 
        statuses: [CallStatus.PENDING, CallStatus.IN_PROGRESS] 
      })
      .andWhere("call.payload->>'to' = :phoneNumber", { phoneNumber })
      .getOne();
  }

  // Clean up expired calls (optional feature)
  async markExpiredCalls(maxAge: Date): Promise<number> {
    const result = await this.repository.update(
      {
        status: CallStatus.PENDING,
        createdAt: { $lt: maxAge } as any
      },
      {
        status: CallStatus.EXPIRED,
        endedAt: new Date()
      }
    );

    return result.affected || 0;
  }
}