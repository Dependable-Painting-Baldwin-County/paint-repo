import { Env } from '../types';

export interface AnalyticsEvent {
  event_name: string;
  event_category?: string;
  event_label?: string;
  value?: number;
  custom_parameters?: Record<string, any>;
  user_id?: string;
  session_id?: string;
  page_location?: string;
  page_title?: string;
  user_properties?: Record<string, any>;
}

/**
 * Analytics service for tracking conversions, engagement, and user behavior
 * Integrates with Google Analytics 4 and Google Ads conversion tracking
 */
export class AnalyticsService {
  constructor(private env: Env) {}

  /**
   * Track a conversion event to Google Analytics 4
   */
  async trackGA4Event(event: AnalyticsEvent): Promise<boolean> {
    if (!this.env.GA_MEASUREMENT_ID) {
      console.log('GA4 not configured, skipping analytics');
      return false;
    }

    // GA4 Measurement Protocol endpoint
    const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${this.env.GA_MEASUREMENT_ID}&api_secret=${this.env.GA_API_SECRET || 'default-secret'}`;

    const payload: any = {
      client_id: event.user_id || this.generateClientId(),
      events: [{
        name: event.event_name,
        parameters: {
          event_category: event.event_category,
          event_label: event.event_label,
          value: event.value,
          page_location: event.page_location,
          page_title: event.page_title,
          session_id: event.session_id,
          engagement_time_msec: 1000,
          ...event.custom_parameters
        }
      }]
    };

    if (event.user_properties) {
      payload.user_properties = event.user_properties;
    }

    try {
      const response = await fetch(ga4Url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      console.error('GA4 tracking failed:', error);
      return false;
    }
  }

  /**
   * Track Google Ads conversion
   */
  async trackGoogleAdsConversion(conversionAction: string, value?: number): Promise<boolean> {
    if (!this.env.GOOGLE_ADS_CONVERSION_ID) {
      console.log('Google Ads not configured, skipping conversion tracking');
      return false;
    }

    try {
      // Use Google Ads Enhanced Conversions API
      const conversionPayload = {
        conversion_action: `customers/${this.env.GOOGLE_ADS_CONVERSION_ID}/conversionActions/${conversionAction}`,
        conversion_date: new Date().toISOString(),
        conversion_value: value || 0,
        currency_code: 'USD',
      };

      // This would typically require OAuth2 authentication for the Google Ads API
      // For now, we'll track it via GA4 which can forward to Google Ads
      return await this.trackGA4Event({
        event_name: 'conversion',
        event_category: 'google_ads',
        event_label: conversionAction,
        value: value,
        custom_parameters: {
          conversion_action: conversionAction,
          currency: 'USD'
        }
      });
    } catch (error) {
      console.error('Google Ads conversion tracking failed:', error);
      return false;
    }
  }

  /**
   * Track phone call conversion
   */
  async trackPhoneCall(page: string, sessionId?: string): Promise<void> {
    await Promise.all([
      this.trackGA4Event({
        event_name: 'phone_call',
        event_category: 'engagement',
        event_label: 'click_to_call',
        value: 50, // Assign value to phone calls
        page_location: page,
        session_id: sessionId,
        custom_parameters: {
          lead_type: 'phone_call',
          lead_quality: 'high'
        }
      }),
      this.trackGoogleAdsConversion('phone_call_conversion', 50)
    ]);
  }

  /**
   * Track form submission conversion
   */
  async trackFormSubmission(formData: any, page: string, sessionId?: string): Promise<void> {
    const isCommercial = this.isCommercialLead(formData);
    const leadValue = this.calculateLeadValue(formData);

    await Promise.all([
      this.trackGA4Event({
        event_name: 'form_submit',
        event_category: 'conversion',
        event_label: 'estimate_request',
        value: leadValue,
        page_location: page,
        session_id: sessionId,
        custom_parameters: {
          form_type: 'estimate_request',
          service_type: formData.service,
          lead_type: isCommercial ? 'commercial' : 'residential',
          lead_quality: leadValue > 100 ? 'high' : leadValue > 50 ? 'medium' : 'low'
        }
      }),
      this.trackGoogleAdsConversion('estimate_request_conversion', leadValue)
    ]);
  }

  /**
   * Track chat engagement and high-value interactions
   */
  async trackChatInteraction(message: string, reply: string, page: string, sessionId: string, isHighValue: boolean): Promise<void> {
    const engagementValue = isHighValue ? 25 : 5;

    await this.trackGA4Event({
      event_name: 'chat_interaction',
      event_category: 'engagement',
      event_label: isHighValue ? 'high_value_chat' : 'chat_message',
      value: engagementValue,
      page_location: page,
      session_id: sessionId,
      custom_parameters: {
        chat_type: isHighValue ? 'high_value' : 'standard',
        message_length: message.length,
        reply_length: reply.length,
        lead_quality: isHighValue ? 'high' : 'low'
      }
    });

    // Track high-value chat as conversion
    if (isHighValue) {
      await this.trackGoogleAdsConversion('chat_engagement_conversion', engagementValue);
    }
  }

  /**
   * Track page engagement metrics
   */
  async trackPageEngagement(page: string, timeOnPage: number, scrollDepth: number, sessionId?: string): Promise<void> {
    await this.trackGA4Event({
      event_name: 'page_engagement',
      event_category: 'engagement',
      event_label: 'user_engagement',
      page_location: page,
      session_id: sessionId,
      custom_parameters: {
        time_on_page: timeOnPage,
        scroll_depth: scrollDepth,
        engagement_level: this.calculateEngagementLevel(timeOnPage, scrollDepth)
      }
    });
  }

  /**
   * Track custom business events
   */
  async trackBusinessEvent(eventName: string, category: string, label: string, value?: number, customData?: Record<string, any>): Promise<void> {
    await this.trackGA4Event({
      event_name: eventName,
      event_category: category,
      event_label: label,
      value: value,
      custom_parameters: customData
    });
  }

  private generateClientId(): string {
    return crypto.randomUUID();
  }

  private isCommercialLead(formData: any): boolean {
    const commercialKeywords = ['commercial', 'business', 'office', 'restaurant', 'store', 'warehouse', 'retail'];
    const serviceText = (formData.service || '').toLowerCase();
    const messageText = (formData.message || '').toLowerCase();
    
    return commercialKeywords.some(keyword => 
      serviceText.includes(keyword) || messageText.includes(keyword)
    );
  }

  private calculateLeadValue(formData: any): number {
    let value = 25; // Base value for any lead

    // Commercial leads are worth more
    if (this.isCommercialLead(formData)) {
      value += 75;
    }

    // Higher value services
    const service = (formData.service || '').toLowerCase();
    if (service.includes('exterior') || service.includes('commercial')) {
      value += 50;
    } else if (service.includes('interior') || service.includes('cabinet')) {
      value += 25;
    }

    // Check for urgency indicators
    const message = (formData.message || '').toLowerCase();
    if (message.includes('urgent') || message.includes('asap') || message.includes('soon')) {
      value += 25;
    }

    return value;
  }

  private calculateEngagementLevel(timeOnPage: number, scrollDepth: number): string {
    if (timeOnPage > 120000 && scrollDepth > 75) return 'high';
    if (timeOnPage > 60000 && scrollDepth > 50) return 'medium';
    return 'low';
  }
}