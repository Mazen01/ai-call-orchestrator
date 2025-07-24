import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CallStatus, CallPayload } from '../types/call.types';

@Entity('calls')
export class CallEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('jsonb')
  payload!: CallPayload;

  @Column({
    type: 'enum',
    enum: CallStatus,
    default: CallStatus.PENDING
  })
  status!: CallStatus;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ nullable: true, type: 'text' })
  lastError?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ nullable: true, type: 'timestamp' })
  startedAt?: Date;

  @Column({ nullable: true, type: 'timestamp' })
  endedAt?: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Additional field to track external AI call ID
  @Column({ nullable: true })
  externalCallId?: string;
}