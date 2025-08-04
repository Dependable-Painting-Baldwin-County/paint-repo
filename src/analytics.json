import { Env } from '../types';
import { AnalyticsService } from '../lib/analytics';
import { NotificationService } from '../lib/notifications';

export interface AnalyticsTrackingRequest {
  event: string;
  category?: string;
  label?: string;
  value?: number;
  page?: string;
  sessionId?: string;
  customData?: Record<string, any>;
}

/**
 * Handles analytics tracking requests from the frontend
 * Processes various conversion and engagement events
 */
export async function handleAnalytics(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const data = await request.json() as AnalyticsTrackingRequest;
    const analyticsService = new AnalyticsService(env);
    const notificationService = new NotificationService(env);

    // Handle different types of analytics events
    switch (data.event) {
      case 'phone_click':
        await analyticsService.trackPhoneCall(data.page || '', data.sessionId);
        // Send notification for phone call conversion
        await env.NOTIFY_QUEUE.send(JSON.stringify({
          type: 'call_conversion',
          page: data.page,
          timestamp: Date.now()
        }));
        break;

      case 'page_engagement':
        await analyticsService.trackPageEngagement(
          data.page || '',
          data.customData?.timeOnPage || 0,
          data.customData?.scrollDepth || 0,
          data.sessionId
        );
        break;

      case 'chat_started':
        await analyticsService.trackBusinessEvent(
          'chat_started',
          'engagement',
          'user_interaction',
          5,
          {
            page: data.page,
            session_id: data.sessionId,
            ...data.customData
          }
        );
        break;

      case 'form_started':
        await analyticsService.trackBusinessEvent(
          'form_started',
          'engagement',
          'form_interaction',
          10,
          {
            page: data.page,
            session_id: data.sessionId,
            form_type: data.customData?.formType || 'estimate'
          }
        );
        break;

      case 'form_abandoned':
        await analyticsService.trackBusinessEvent(
          'form_abandoned',
          'engagement',
          'form_interaction',
          -5,
          {
            page: data.page,
            session_id: data.sessionId,
            abandonment_point: data.customData?.abandonmentPoint
          }
        );
        break;

      case 'email_click':
        await analyticsService.trackBusinessEvent(
          'email_click',
          'engagement',
          'contact_interaction',
          15,
          {
            page: data.page,
            session_id: data.sessionId
          }
        );
        break;

      case 'service_page_view':
        await analyticsService.trackBusinessEvent(
          'service_page_view',
          'engagement',
          'service_interest',
          data.value || 3,
          {
            page: data.page,
            service_type: data.customData?.serviceType,
            session_id: data.sessionId
          }
        );
        break;

      case 'gallery_engagement':
        await analyticsService.trackBusinessEvent(
          'gallery_engagement',
          'engagement',
          'visual_content',
          data.value || 2,
          {
            page: data.page,
            image_count: data.customData?.imageCount,
            time_spent: data.customData?.timeSpent,
            session_id: data.sessionId
          }
        );
        break;

      default:
        // Generic event tracking
        await analyticsService.trackBusinessEvent(
          data.event,
          data.category || 'custom',
          data.label || 'user_action',
          data.value,
          {
            page: data.page,
            session_id: data.sessionId,
            ...data.customData
          }
        );
    }

    return Response.json({ success: true, message: 'Event tracked successfully' });

  } catch (error) {
    console.error('Analytics tracking failed:', error);
    return Response.json({ error: 'Failed to track event' }, { status: 500 });
  }
}