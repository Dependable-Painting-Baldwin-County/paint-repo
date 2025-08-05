/**
 * Dependable Painting - Static Marketing Site
 * 
 * This worker serves static marketing content with basic analytics tracking.
 * It does NOT handle business logic, customer data, or API endpoints.
 * All API requests should be handled by customer-worker-1.
 */

interface Env {
  ASSETS: any; // Cloudflare Assets binding
  GA_MEASUREMENT_ID?: string;
  GA_API_SECRET?: string;
  GOOGLE_ADS_CONVERSION_ID?: string;
  BIGQUERY_PROJECT_ID?: string;
  GA_STREAM_ID?: string;
  GA_ACCOUNT_ID?: string;
}

export default {
  /**
   * Static site handler - serves marketing pages with analytics enhancement
   */
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const { pathname } = new URL(request.url);

    // All API requests should go to customer-worker-1, not here
    if (pathname.indexOf('/api/') === 0) {
      return new Response('API endpoints not available on marketing site. Please use the main application.', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Serve static assets
    const response = await env.ASSETS.fetch(request);
    
    // Add analytics tracking for HTML pages only
    if (response.headers.get('content-type')?.includes('text/html')) {
      return await enhanceWithAnalytics(response, env);
    }

    return response;
  }
};

/**
 * Enhance HTML pages with client-side analytics tracking
 */
async function enhanceWithAnalytics(response: Response, env: Env): Promise<Response> {
  // Generate a unique session ID
  const sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  const analyticsScript = `
    <script>
      // Dependable Painting Analytics Tracker
      window.dpAnalytics = {
        sessionId: '${sessionId}',
        gaId: '${env.GA_MEASUREMENT_ID || ''}',
        
        // Track basic engagement events
        track: function(event, data) {
          data = data || {};
          // Send to Google Analytics if configured
          if (this.gaId && window.gtag) {
            gtag('event', event, {
              page_location: window.location.href,
              session_id: this.sessionId,
              custom_parameter_1: data.category || '',
              custom_parameter_2: data.value || 0,
              custom_parameter_3: data.event_label || ''
            });
          }
          
          console.log('Analytics Event:', event, data);
        },
        
        // Track phone number clicks (conversion event)
        trackPhoneClick: function() {
          this.track('phone_click', { 
            category: 'conversion', 
            value: 50,
            event_label: 'phone_number_click'
          });
        },
        
        // Track email clicks  
        trackEmailClick: function() {
          this.track('email_click', { 
            category: 'engagement', 
            value: 15,
            event_label: 'email_link_click'
          });
        },
        
        // Track form engagement
        trackFormStart: function(formType) {
          formType = formType || 'contact';
          this.track('form_start', { 
            category: 'engagement', 
            event_label: formType + '_form'
          });
        },
        
        // Track page engagement depth
        trackPageEngagement: function() {
          var startTime = Date.now();
          var maxScroll = 0;
          
          var trackScroll = function() {
            var scrollPercent = Math.round((window.pageYOffset / (document.body.scrollHeight - window.innerHeight)) * 100);
            maxScroll = Math.max(maxScroll, scrollPercent);
          };
          
          window.addEventListener('scroll', trackScroll);
          
          // Track engagement on page unload
          window.addEventListener('beforeunload', function() {
            var timeOnPage = Date.now() - startTime;
            window.dpAnalytics.track('page_engagement', {
              category: 'engagement',
              time_on_page: Math.round(timeOnPage / 1000),
              scroll_depth: maxScroll
            });
          });
        }
      };
      
      // Auto-initialize page engagement tracking
      dpAnalytics.trackPageEngagement();
      
      // Auto-track phone and email clicks
      document.addEventListener('click', function(e) {
        if (e.target.href) {
          if (e.target.href.indexOf('tel:') === 0) {
            dpAnalytics.trackPhoneClick();
          } else if (e.target.href.indexOf('mailto:') === 0) {
            dpAnalytics.trackEmailClick();
          }
        }
      });
      
      // Track form focus events
      document.addEventListener('focusin', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          var form = e.target.closest ? e.target.closest('form') : null;
          if (form && !form.dataset.trackingStarted) {
            form.dataset.trackingStarted = 'true';
            dpAnalytics.trackFormStart(form.dataset.formType || 'contact');
          }
        }
      });
    </script>
  `;
  
  // Add Google Analytics if configured
  let gaScript = '';
  if (env.GA_MEASUREMENT_ID) {
    gaScript = `
      <script async src="https://www.googletagmanager.com/gtag/js?id=${env.GA_MEASUREMENT_ID}"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${env.GA_MEASUREMENT_ID}');
      </script>
    `;
  }
  
  // Insert scripts before closing head and body tags
  const body = await response.text();
  const enhancedBody = body
    .replace('</head>', gaScript + '</head>')
    .replace('</body>', analyticsScript + '</body>');
  
  return new Response(enhancedBody, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText
  });
}