import { Env } from '../types';

export interface NotificationPayload {
  type: 'estimate_request' | 'high_value_chat_lead' | 'call_conversion';
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  message?: string;
  reply?: string;
  page?: string;
  timestamp: number;
  leadValue?: 'high' | 'medium' | 'low';
}

/**
 * Enhanced notification service that sends SMS and email alerts
 * for high-value leads and estimate requests
 */
export class NotificationService {
  constructor(private env: Env) {}

  async sendSMS(message: string, to?: string): Promise<boolean> {
    if (!this.env.TWILIO_ACCOUNT_SID || !this.env.TWILIO_AUTH_TOKEN || !this.env.TWILIO_PHONE_NUMBER) {
      console.log('Twilio not configured, skipping SMS');
      return false;
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = btoa(`${this.env.TWILIO_ACCOUNT_SID}:${this.env.TWILIO_AUTH_TOKEN}`);

    try {
      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: this.env.TWILIO_PHONE_NUMBER,
          To: to || this.env.EMAIL_TO, // Use EMAIL_TO as fallback phone number
          Body: message,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('SMS failed:', error);
      return false;
    }
  }

  async sendEmail(subject: string, body: string, to?: string): Promise<boolean> {
    if (!this.env.SENDGRID_API_KEY) {
      console.log('SendGrid not configured, skipping email');
      return false;
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: to || this.env.EMAIL_TO }],
            subject: subject,
          }],
          from: { email: this.env.EMAIL_FROM },
          content: [{
            type: 'text/html',
            value: body,
          }],
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Email failed:', error);
      return false;
    }
  }

  async processNotification(payload: NotificationPayload): Promise<void> {
    const isHighPriority = payload.type === 'high_value_chat_lead' || 
                          payload.leadValue === 'high' || 
                          this.isCommercialLead(payload);

    if (payload.type === 'estimate_request') {
      await this.handleEstimateNotification(payload, isHighPriority);
    } else if (payload.type === 'high_value_chat_lead') {
      await this.handleChatLeadNotification(payload);
    } else if (payload.type === 'call_conversion') {
      await this.handleCallConversion(payload);
    }
  }

  private async handleEstimateNotification(payload: NotificationPayload, isHighPriority: boolean): Promise<void> {
    const urgencyText = isHighPriority ? '🚨 HIGH VALUE LEAD 🚨' : '📋 New Lead';
    
    const smsMessage = `${urgencyText}\n\nName: ${payload.name}\nPhone: ${payload.phone}\nService: ${payload.service}\n\nCall ASAP! https://dependablepainting.work`;
    
    const emailSubject = `${urgencyText} - Painting Estimate Request`;
    const emailBody = `
      <h2>${urgencyText}</h2>
      <p><strong>New estimate request from your website!</strong></p>
      
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Name:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${payload.name}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${payload.email}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Phone:</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><a href="tel:${payload.phone}">${payload.phone}</a></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Service:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${payload.service}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Message:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${payload.message}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Submitted:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date(payload.timestamp).toLocaleString()}</td></tr>
      </table>
      
      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>Call ${payload.phone} within 15 minutes for best conversion</li>
        <li>Mention you received their request from dependablepainting.work</li>
        <li>Schedule estimate ASAP - same day if possible</li>
      </ul>
    `;

    if (isHighPriority) {
      await this.sendSMS(smsMessage);
    }
    await this.sendEmail(emailSubject, emailBody);
  }

  private async handleChatLeadNotification(payload: NotificationPayload): Promise<void> {
    const smsMessage = `🚨 HOT CHAT LEAD!\n\nSomeone is actively chatting about: ${payload.message?.substring(0, 100)}...\n\nCheck chat now: https://dependablepainting.work`;
    
    const emailSubject = '🚨 High-Value Chat Lead Detected';
    const emailBody = `
      <h2>🚨 High-Value Chat Lead Detected</h2>
      <p><strong>Someone is actively engaged in a high-value conversation on your website!</strong></p>
      
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Page:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${payload.page}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>User Message:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${payload.message}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>AI Response:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${payload.reply}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Time:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date(payload.timestamp).toLocaleString()}</td></tr>
      </table>
      
      <p><strong>Recommended Actions:</strong></p>
      <ul>
        <li>Monitor the chat conversation for contact information</li>
        <li>Be ready to follow up immediately if they provide contact details</li>
        <li>Consider proactive outreach if they show strong buying signals</li>
      </ul>
    `;

    await this.sendSMS(smsMessage);
    await this.sendEmail(emailSubject, emailBody);
  }

  private async handleCallConversion(payload: NotificationPayload): Promise<void> {
    const emailSubject = '📞 Phone Call Conversion Tracked';
    const emailBody = `
      <h2>📞 Phone Call Conversion</h2>
      <p>A phone call conversion was tracked from your website.</p>
      
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Page:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${payload.page}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Time:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date(payload.timestamp).toLocaleString()}</td></tr>
      </table>
    `;

    await this.sendEmail(emailSubject, emailBody);
  }

  private isCommercialLead(payload: NotificationPayload): boolean {
    const commercialKeywords = ['commercial', 'business', 'office', 'restaurant', 'store', 'warehouse', 'retail'];
    const serviceText = (payload.service || '').toLowerCase();
    const messageText = (payload.message || '').toLowerCase();
    
    return commercialKeywords.some(keyword => 
      serviceText.includes(keyword) || messageText.includes(keyword)
    );
  }
}