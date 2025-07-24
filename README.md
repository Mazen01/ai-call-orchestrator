# AI Call Orchestrator Service

**Ebra Backend Assessment - Complete Implementation**

A production-ready backend service for orchestrating AI-driven phone calls with concurrency management, retry logic, and webhook integration.

## ✅ Assessment Status: COMPLETE

**All PDF requirements implemented and tested:**
- ✅ REST API with all 6 required endpoints
- ✅ PostgreSQL persistence with TypeORM  
- ✅ Concurrency control (max 30 calls)
- ✅ Phone number deduplication
- ✅ Retry logic with exponential backoff
- ✅ Webhook integration for status updates
- ✅ Docker containerization
- ✅ Comprehensive testing completed

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd ai-call-orchestrator
cp .env.example .env

# Start with Docker (recommended)
docker-compose up -d

# Install dependencies and run
npm install
npm run dev

# Test the API
curl http://localhost:3000/health
```

## Features

- **Call Management**: Create, update, and track AI phone calls
- **Concurrency Control**: Maximum 30 concurrent calls with per-phone deduplication
- **Retry Logic**: Exponential backoff retry mechanism for failed calls
- **Webhook Integration**: Real-time status updates from external AI call provider
- **Metrics**: Real-time call status metrics and monitoring
- **Queue Management**: In-memory queue with optional Kafka integration
- **Database Persistence**: PostgreSQL with TypeORM
- **Docker Support**: Complete containerization with docker-compose

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **ORM**: TypeORM
- **Cache**: Redis (optional)
- **Queue**: In-memory (Kafka ready)
- **Logging**: Winston
- **Validation**: Joi
- **Containerization**: Docker & Docker Compose

## API Documentation

### Call Management

#### Create Call
```http
POST /api/v1/calls
Content-Type: application/json

{
  "to": "+966501234567",
  "scriptId": "welcomeFlow",
  "metadata": {
    "customerName": "John Doe",
    "campaign": "summer2024"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "payload": {
      "to": "+966501234567",
      "scriptId": "welcomeFlow",
      "metadata": { "customerName": "John Doe" }
    },
    "status": "PENDING",
    "attempts": 0,
    "createdAt": "2025-07-25T10:00:00Z"
  }
}
```

#### Other Endpoints
- `GET /api/v1/calls/{id}` - Get call details
- `PATCH /api/v1/calls/{id}` - Update call (PENDING only)
- `GET /api/v1/calls?status=PENDING&page=1&limit=10` - List calls
- `GET /api/v1/metrics` - Get call statistics
- `GET /health` - Health check

### Webhook Endpoint

```http
POST /api/v1/callbacks/call-status
Content-Type: application/json

{
  "callId": "external-call-id-from-provider",
  "status": "COMPLETED",
  "durationSec": 42,
  "completedAt": "2025-07-25T10:05:42Z"
}
```

## Testing Results

All endpoints tested and working:

```bash
# Health check ✅
curl http://localhost:3000/health

# Create call ✅  
curl -X POST http://localhost:3000/api/v1/calls \
  -H "Content-Type: application/json" \
  -d '{"to":"+966501234567","scriptId":"welcomeFlow","metadata":{"test":"data"}}'

# Get metrics ✅
curl http://localhost:3000/api/v1/metrics

# List calls ✅
curl "http://localhost:3000/api/v1/calls?status=PENDING"

# Test webhook ✅
curl -X POST http://localhost:3000/api/v1/callbacks/call-status \
  -H "Content-Type: application/json" \
  -d '{"callId":"test-id","status":"COMPLETED","completedAt":"2025-07-25T10:00:00Z"}'
```

## Architecture

### Core Components

1. **CallService**: Main business logic for call orchestration
2. **ConcurrencyManager**: Enforces 30 concurrent call limit
3. **QueueService**: Manages call processing queue
4. **AICallService**: Integrates with external AI call provider
5. **CallRepository**: Database operations with atomic locking

### Call Flow

1. **Create**: Client creates call via REST API
2. **Queue**: Call enqueued for processing
3. **Process**: Worker picks up call (max 30 concurrent)
4. **AI Call**: External API called with webhook URL
5. **Wait**: Service waits for webhook callback
6. **Complete**: Status updated, concurrency slot released
7. **Retry**: Failed calls retried with exponential backoff

### Concurrency Management

- Maximum 30 calls can be `IN_PROGRESS` simultaneously
- One call per phone number at any time
- Atomic database operations prevent race conditions
- Failed calls retry with exponential backoff (max 3 attempts)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `password` |
| `DB_DATABASE` | Database name | `ai_call_orchestrator` |
| `AI_CALL_API_URL` | External AI call API endpoint | Required |
| `AI_CALL_API_KEY` | API authentication key | Required |
| `WEBHOOK_BASE_URL` | Base URL for webhooks | Required |
| `MAX_CONCURRENT_CALLS` | Concurrency limit | `30` |
| `MAX_RETRY_ATTEMPTS` | Retry limit | `3` |
| `WEBHOOK_SECRET` | Webhook authentication secret | Optional |

## Development

### Running Tests
```bash
npm test
npm run test:watch
```

### Database Migrations
```bash
npm run migration:generate -- -n MigrationName
npm run migration:run
```

### Logs
Application logs are stored in:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

## Production Considerations

### Scaling
- Use Kafka for queue management in production
- Consider Redis for distributed concurrency control
- Implement proper webhook signature verification
- Add monitoring and alerting

### Security
- Enable webhook signature verification
- Use proper API authentication
- Implement rate limiting
- Enable HTTPS in production

### Monitoring
- Monitor call metrics via `/metrics` endpoint
- Set up alerts for high failure rates
- Track concurrency utilization
- Monitor webhook callback delays

## API Provider Integration

The service expects the external AI call provider to:

1. **Accept calls** via `POST /api/v1/calls` with:
   - `to`: Phone number
   - `scriptId`: Call script identifier
   - `webhookUrl`: Callback URL

2. **Return response** with:
   - `callId`: External tracking ID
   - Status `202 Accepted`

3. **Send webhooks** to provided URL with:
   - `callId`: External tracking ID
   - `status`: Final call status
   - `completedAt`: Completion timestamp
   - `durationSec`: Call duration (optional)

## License

MIT License - see LICENSE file for details.
