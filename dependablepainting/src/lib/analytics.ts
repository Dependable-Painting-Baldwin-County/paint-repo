import { Env, EstimateRequest } from '../types';

export interface AnalyticsEvent {
  event_name: string;
  category: string;
  label?: string;
  value?: number;
  page_url?: string;
  session_id?: string;
  custom_parameters?: Record<string, any>;
}

/**
 * Enhanced analytics service that tracks business-specific events
 * and integrates with Google Analytics 4 and Google Ads
 */
export class AnalyticsService {
  constructor(private env: Env) {}

  async trackFormSubmission(data: EstimateRequest, referer: string): Promise<void> {
    const events = [
      {
        event_name: 'generate_lead',
        category: 'conversion',
        label: 'estimate_form',
        value: 100, // Assign a monetary value to the lead
        page_url: referer,
        custom_parameters: {
          service_type: data.service,
          form_type: 'estimate'
        }
      },
      {
        event_name: 'contact_submit',
        category: 'engagement',
        label: data.service,
        value: 50,
        page_url: referer,
        custom_parameters: {
          contact_method: 'form'
        }
      }
    ];

    await Promise.all(events.map(event => this.sendToGA4(event)));
    await this.trackGoogleAdsConversion();
  }

  async trackPhoneCall(page: string, sessionId?: string): Promise<void> {
    const event = {
      event_name: 'phone_call',
      category: 'conversion',
      label: 'phone_click',
      value: 75,
      page_url: page,
      session_id: sessionId,
      custom_parameters: {
        contact_method: 'phone'
      }
    };

    await this.sendToGA4(event);
    await this.trackGoogleAdsConversion();
  }

  async trackPageEngagement(page: string, timeOnPage: number, scrollDepth: number, sessionId?: string): Promise<void> {
    const event = {
      event_name: 'page_engagement',
      category: 'engagement',
      label: 'user_behavior',
      value: Math.min(timeOnPage / 1000, 300), // Cap at 5 minutes
      page_url: page,
      session_id: sessionId,
      custom_parameters: {
        time_on_page: timeOnPage,
        scroll_depth: scrollDepth
      }
    };

    await this.sendToGA4(event);
  }

  async trackBusinessEvent(
    eventName: string,
    category: string,
    label: string,
    value?: number,
    customData?: Record<string, any>
  ): Promise<void> {
    const event = {
      event_name: eventName,
      category,
      label,
      value,
      custom_parameters: customData
    };

    await this.sendToGA4(event);
  }

  private async sendToGA4(event: AnalyticsEvent): Promise<void> {
    if (!this.env.GA_MEASUREMENT_ID || !this.env.GA_API_SECRET) {
      console.log('GA4 not configured, skipping analytics');
      return;
    }

    const payload = {
      client_id: event.session_id || crypto.randomUUID(),
      events: [{
        name: event.event_name,
        params: {
          event_category: event.category,
          event_label: event.label,
          value: event.value,
          page_location: event.page_url,
          ...event.custom_parameters
        }
      }]
    };

    try {
      await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${this.env.GA_MEASUREMENT_ID}&api_secret=${this.env.GA_API_SECRET}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('GA4 tracking failed:', error);
    }
  }

  private async trackGoogleAdsConversion(): Promise<void> {
    if (!this.env.GOOGLE_ADS_CONVERSION_ID) {
      console.log('Google Ads not configured, skipping conversion tracking');
      return;
    }

    try {
      // This would typically be done client-side with gtag,
      // but we can also send server-side conversion events
      const conversionData = {
        conversion_id: this.env.GOOGLE_ADS_CONVERSION_ID,
        conversion_label: 'painting_lead',
        conversion_value: 100,
        currency: 'USD'
      };

      // Note: Actual Google Ads conversion tracking would require
      // additional setup and potentially different endpoints
      console.log('Google Ads conversion tracked:', conversionData);
    } catch (error) {
      console.error('Google Ads tracking failed:', error);
    }
  }
}