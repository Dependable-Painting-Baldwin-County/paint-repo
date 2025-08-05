# Dependable Painting - Worker Architecture

This repository contains three Cloudflare Workers that work together to provide a complete painting business solution.

## Architecture Overview

### 🌐 customer-worker-1 (Public API Gateway)
**Purpose**: Front-desk for customer interactions and lead capture

**Handles**:
- `/api/chat` - AI-powered customer chat and FAQ
- `/api/contact` - Lead form submission with email automation
- `/api/upload` - Image upload for project estimates
- Routes complex requests to paint-dispatcher

**Features**:
- Lead capture with KV storage
- Email automation with Resend
- Image storage in R2
- Analytics tracking
- Auto-reply to customers

### 🎨 dependablepainting (Static Marketing Site)
**Purpose**: Fast, SEO-optimized marketing website

**Handles**:
- Static HTML, CSS, JavaScript, images
- Client-side analytics injection
- Phone/email click tracking
- Form engagement analytics

**What it doesn't do**:
- No business logic or API endpoints
- No customer data processing
- No AI or complex calculations

### 🔧 paint-dispatcher (Backend Business Logic)
**Purpose**: Secure command center for business operations

**Handles**:
- `/api/price` - Price calculations and estimates
- `/api/queue` - Background job processing
- `/api/enrich` - AI-powered data enrichment
- `/api/automation` - Multi-step business workflows
- `/api/contact` - Internal contact processing

**Features**:
- OpenAI integration for smart responses
- Complex pricing algorithms
- Task queue management
- CRM synchronization
- Internal analytics

## Communication Flow

```
User → customer-worker-1 → paint-dispatcher → Response
Static Assets → dependablepainting → Response (with analytics)
```

## Setup & Development

### Prerequisites
- Node.js 18+
- Cloudflare account with Workers enabled
- Wrangler CLI installed

### Installation
```bash
# Install dependencies for each worker
cd customer-worker-1 && npm install
cd ../paint-dispatcher && npm install
```

### Testing
```bash
# Run validation script
./validate.sh

# Run individual worker tests
cd customer-worker-1 && npm test
cd ../paint-dispatcher && npm test
```

### Deployment
```bash
# Deploy each worker
cd customer-worker-1 && npm run deploy
cd ../dependablepainting && wrangler deploy
cd ../paint-dispatcher && npm run deploy
```

## Configuration

### Required Environment Variables

**customer-worker-1**:
- `RESEND_API_KEY` - For email automation
- `DESTINATION_EMAIL` - Company email address

**paint-dispatcher**:
- `OPENAI_API_KEY` - For AI chat responses
- `RESEND_API_KEY` - For internal notifications

### Required Bindings

**KV Namespaces**:
- `PAINTER_KVBINDING` - Customer data storage

**R2 Buckets**:
- `paint-bucket` - Image and file storage

**Analytics Engine**:
- `ANALYTICS_ENGINE` - Usage tracking

**Queues**:
- `TASK_QUEUE` - Background job processing

## Security Notes

- paint-dispatcher is internal-only, not publicly accessible
- Sensitive API keys are only in paint-dispatcher
- customer-worker-1 validates and sanitizes all inputs
- dependablepainting has no access to sensitive data

## Monitoring

- Analytics Engine captures usage data
- Error logging via console.error
- Performance metrics via Cloudflare dashboard
- Custom event tracking for business KPIs

## Architecture Benefits

✅ **Separation of Concerns**: Each worker has a single, clear responsibility  
✅ **Security**: Sensitive logic isolated in paint-dispatcher  
✅ **Performance**: Static assets served separately for optimal SEO  
✅ **Scalability**: Independent worker scaling and deployment  
✅ **Maintainability**: Clear boundaries make code easier to understand  
✅ **Reliability**: Isolated failures don't cascade across the system  

## Support

For issues or questions about this architecture, check the [Integration Tests](INTEGRATION_TESTS.md) document or run the validation script.