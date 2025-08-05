# Deployment Checklist

## Pre-deployment Validation

- [ ] Run `./validate.sh` and ensure all checks pass
- [ ] Verify all environment variables are configured
- [ ] Check that service bindings match between workers
- [ ] Confirm KV namespaces and R2 buckets are created
- [ ] Test critical API endpoints locally

## Deployment Order

Deploy in this specific order to avoid service binding issues:

1. **paint-dispatcher** (backend first)
   ```bash
   cd paint-dispatcher
   npm run deploy
   ```

2. **dependablepainting** (static site)
   ```bash
   cd dependablepainting
   wrangler deploy
   ```

3. **customer-worker-1** (frontend last)
   ```bash
   cd customer-worker-1
   npm run deploy
   ```

## Post-deployment Testing

- [ ] Test `/api/chat` endpoint responds properly
- [ ] Verify `/api/contact` saves to KV and sends emails
- [ ] Check `/api/upload` saves images to R2
- [ ] Confirm `/api/price` calculations work
- [ ] Validate static site serves correctly
- [ ] Test analytics tracking is working

## Environment Variables to Set

### customer-worker-1
- `RESEND_API_KEY`
- `DESTINATION_EMAIL`

### paint-dispatcher  
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `SOURCE_EMAIL`

## Resources to Create

- KV Namespace: `PAINTER_KVBINDING`
- R2 Bucket: `paint-bucket`
- Analytics Engine Dataset: `analytics_events`
- Queue: `painter-queues`

## Monitoring

After deployment, monitor:
- Error rates in Cloudflare dashboard
- Analytics events in Analytics Engine
- Email delivery success rates
- API response times
- Storage usage (KV/R2)