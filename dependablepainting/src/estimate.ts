import { EstimateRequest, Env } from '../types';
import { AnalyticsService } from '../lib/analytics';

/**
 * Handles incoming estimate submissions. This endpoint will persist the lead
 * information into a D1 database and enqueue a notification job. After
 * processing the input it will redirect the client to a thank-you page.
 */
export async function handleEstimate(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const data = await request.json() as EstimateRequest;
  const { name, email, phone, service, message } = data;

  // Insert the new lead into the D1 database
  await env.DB.prepare(
    `
    INSERT INTO Leads (name, email, phone, service, message, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `
  ).bind(name, email, phone, service, message, Date.now()).run();

  // Enqueue a message containing the lead to the notification queue
  await env.NOTIFY_QUEUE.send(JSON.stringify({
    type: 'estimate_request',
    ...data,
    timestamp: Date.now()
  }));

  // Track analytics for form submission
  const analyticsService = new AnalyticsService(env);
  const referer = request.headers.get('referer') || 'unknown';
  
  ctx.waitUntil(
    analyticsService.trackFormSubmission(data, referer)
  );

  // Return a 303 redirect to the thank-you page
  return Response.redirect('/thank-you.html', 303);
}