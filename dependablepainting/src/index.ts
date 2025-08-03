import { handleChat } from './routes/chat';
import { handleEstimate } from './routes/estimate';
import { handleImageUpload } from './routes/upload';
import { handleAnalytics } from './routes/analytics';
import { serveStaticAsset } from './lib/static';
import { AnalyticsService } from './lib/analytics';
import { Env } from './types';

export default {
  /**
   * The main Cloudflare Worker fetch handler. This function dispatches requests
   * to either the chat API, estimate API, image upload, analytics tracking,
   * or falls back to serving static assets.
   *
   * - POST /api/chat      → handleChat
   * - POST /api/estimate  → handleEstimate
   * - POST /api/upload    → handleImageUpload
   * - POST /api/analytics → handleAnalytics
   * - everything else     → serveStaticAsset
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Handle API routes
    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/chat' && request.method === 'POST') {
        return handleChat(request, env, ctx);
      }

      if (pathname === '/api/estimate' && request.method === 'POST') {
        return handleEstimate(request, env, ctx);
      }

      if (pathname === '/api/upload' && request.method === 'POST') {
        return handleImageUpload(request, env, ctx);
      }

      if (pathname === '/api/analytics' && request.method === 'POST') {
        return handleAnalytics(request, env, ctx);
      }

      // API route not found
      return new Response('API endpoint not found', { status: 404 });
    }

    // Serve static assets with analytics enhancement
    const response = await serveStaticAsset(request, env);
    
    // Add analytics tracking headers for HTML pages
    if (response.headers.get('content-type')?.includes('text/html')) {
      const analyticsScript = `
        <script>
          // Enhanced analytics for Dependable Painting
          window.dpAnalytics = {
            sessionId: '${crypto.randomUUID()}',
            
            track: function(event, data = {}) {
              fetch('/api/analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: event,
                  page: window.location.href,
                  sessionId: this.sessionId,
                  timestamp: Date.now(),
                  ...data
                })
              }).catch(console.error);
            },
            
            trackPhoneClick: function() {
              this.track('phone_click', { category: 'conversion', value: 50 });
            },
            
            trackEmailClick: function() {
              this.track('email_click', { category: 'engagement', value: 15 });
            },
            
            trackFormStart: function(formType = 'estimate') {
              this.track('form_started', { category: 'engagement', customData: { formType } });
            },
            
            trackFormAbandon: function(point) {
              this.track('form_abandoned', { category: 'engagement', customData: { abandonmentPoint: point } });
            },
            
            trackChatStart: function() {
              this.track('chat_started', { category: 'engagement', value: 5 });
            },
            
            trackPageEngagement: function() {
              const startTime = Date.now();
              let maxScroll = 0;
              
              const trackScroll = () => {
                const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
                maxScroll = Math.max(maxScroll, scrollPercent);
              };
              
              window.addEventListener('scroll', trackScroll);
              
              window.addEventListener('beforeunload', () => {
                const timeOnPage = Date.now() - startTime;
                this.track('page_engagement', {
                  category: 'engagement',
                  customData: { timeOnPage, scrollDepth: maxScroll }
                });
              });
            }
          };
          
          // Auto-track page engagement
          dpAnalytics.trackPageEngagement();
          
          // Track phone number clicks
          document.addEventListener('click', function(e) {
            if (e.target.href && e.target.href.startsWith('tel:')) {
              dpAnalytics.trackPhoneClick();
            }
            if (e.target.href && e.target.href.startsWith('mailto:')) {
              dpAnalytics.trackEmailClick();
            }
          });
        </script>
      `;
      
      // Insert analytics script before closing body tag
      const body = await response.text();
      const enhancedBody = body.replace('</body>', analyticsScript + '</body>');
      
      return new Response(enhancedBody, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText
      });
    }

    return response;
  }
};

// Export the Durable Object and Queue Consumer
export { ChatSession } from './chatsession';
export { default as queue } from './queue';