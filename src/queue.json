import { NotificationService, NotificationPayload } from './lib/notifications';
import { AnalyticsService } from './lib/analytics';
import { Env } from './types';

/**
 * Queue consumer that processes notification messages from the NOTIFY_QUEUE
 * Handles SMS/email notifications and analytics tracking
 */
export default {
  async queue(batch: MessageBatch<NotificationPayload>, env: Env, ctx: ExecutionContext): Promise<void> {
    const notificationService = new NotificationService(env);
    const analyticsService = new AnalyticsService(env);

    for (const message of batch.messages) {
      try {
        const payload = message.body;
        
        // Process notification
        await notificationService.processNotification(payload);
        
        // Track analytics based on notification type
        if (payload.type === 'estimate_request') {
          await analyticsService.trackFormSubmission(
            payload, 
            payload.page || 'unknown',
            undefined // We don't have session ID in queue
          );
        } else if (payload.type === 'high_value_chat_lead') {
          await analyticsService.trackBusinessEvent(
            'high_value_chat_detected',
            'lead_qualification',
            'chat_engagement',
            25,
            {
              page: payload.page,
              message_preview: payload.message?.substring(0, 100)
            }
          );
        } else if (payload.type === 'call_conversion') {
          await analyticsService.trackPhoneCall(payload.page || 'unknown');
        }

        // Acknowledge successful processing
        message.ack();
      } catch (error) {
        console.error('Failed to process notification:', error);
        // Message will be retried automatically
        message.retry();
      }
    }
  }
};

// Type definition for queue message batch
interface MessageBatch<T = any> {
  queue: string;
  messages: Array<{
    id: string;
    timestamp: Date;
    body: T;
    ack(): void;
    retry(): void;
  }>;
}