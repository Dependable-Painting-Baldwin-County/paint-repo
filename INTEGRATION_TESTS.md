# Worker Integration Test Plan

This document outlines the testing strategy for the three Cloudflare Workers.

## Architecture Overview

1. **customer-worker-1** - Public API gateway
   - Handles `/api/chat`, `/api/contact`, `/api/upload`
   - Forwards complex requests to paint-dispatcher
   - Manages customer-facing interactions

2. **dependablepainting** - Static marketing site
   - Serves HTML/CSS/JS assets only
   - No API endpoints or business logic
   - Client-side analytics tracking

3. **paint-dispatcher** - Backend business logic
   - Handles `/api/price`, `/api/queue`, `/api/enrich`, `/api/automation`
   - Internal-only, not publicly accessible
   - Contains sensitive business logic

## Communication Flow

```
User Request → customer-worker-1 → [Forward to paint-dispatcher if needed] → Response
Static Assets → dependablepainting → Response (with analytics)
```

## Key Integration Points

1. **Service Binding**: customer-worker-1 → paint-dispatcher
2. **Chat Flow**: `/api/chat` → `/api/enrich` (with AI processing)
3. **Asset Serving**: Static content vs API routing

## Test Coverage

- [x] Basic syntax validation
- [x] Service binding configuration
- [x] API endpoint routing
- [ ] End-to-end chat flow
- [ ] Contact form submission
- [ ] Image upload workflow
- [ ] Price calculation accuracy
- [ ] Analytics tracking