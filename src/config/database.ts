import { DataSource } from 'typeorm';
import { CallEntity } from '../entities/Call.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'ai_call_orchestrator',
  synchronize: true, // This will auto-create tables!
  logging: process.env.NODE_ENV === 'development',
  entities: [CallEntity],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts'],
});