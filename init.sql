-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS ai_call_orchestrator;
-- Connect to the database
\ c ai_call_orchestrator;
-- Create enum type for call status
CREATE TYPE call_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED',
    'EXPIRED'
);
-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload JSONB NOT NULL,
    status call_status DEFAULT 'PENDING',
    attempts INTEGER DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "startedAt" TIMESTAMP WITH TIME ZONE,
    "endedAt" TIMESTAMP WITH TIME ZONE,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "externalCallId" VARCHAR(255)
);
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls("createdAt");
CREATE INDEX IF NOT EXISTS idx_calls_external_id ON calls("externalCallId");
CREATE INDEX IF NOT EXISTS idx_calls_phone ON calls USING GIN ((payload->>'to'));
-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW."updatedAt" = NOW();
RETURN NEW;
END;
$$ language 'plpgsql';
CREATE TRIGGER update_calls_updated_at BEFORE
UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();