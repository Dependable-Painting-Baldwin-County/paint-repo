# Advanced AI Chatbot & Analytics for Dependable Painting

This repository contains an advanced AI-powered website implementation for Dependable Painting, featuring sophisticated chatbot capabilities, comprehensive analytics tracking, and automated lead management.

## 🚀 Features Implemented

### Advanced AI Chatbot
- **GPT-4o Integration**: Upgraded from GPT-3.5 to GPT-4o for enhanced performance
- **Persistent Memory**: Chat sessions persist across page navigation using Durable Objects
- **Image Analysis**: Upload photos for AI-powered surface analysis and paint recommendations
- **Business Context**: Comprehensive system prompt with company details, services, and lead qualification
- **High-Value Lead Detection**: Automatic identification and notification of premium leads
- **Session Management**: Unique session IDs for tracking user interactions

### Analytics & Conversion Tracking
- **Google Analytics 4**: Complete GA4 integration with custom events
- **Google Ads Conversion Tracking**: Automated conversion tracking for ads optimization
- **Call Tracking**: Phone number click tracking with conversion values
- **Form Analytics**: Complete form interaction tracking (start, abandon, submit)
- **Engagement Metrics**: Page engagement, scroll depth, time on page tracking
- **Custom Business Events**: Tailored analytics for painting business metrics

### Notification System
- **SMS Notifications**: Twilio integration for instant lead alerts
- **Email Notifications**: SendGrid integration for detailed lead information
- **High-Value Lead Alerts**: Priority notifications for commercial/high-value leads
- **Queue Processing**: Reliable notification delivery via Cloudflare Queues
- **Lead Scoring**: Automatic lead qualification and value assignment

### Technical Infrastructure
- **Cloudflare Workers**: Serverless backend with edge computing
- **Durable Objects**: Persistent chat session state management
- **D1 Database**: Lead storage and management
- **Queue System**: Reliable background job processing
- **TypeScript**: Full type safety throughout the codebase
- **Enhanced Security**: Proper error handling and input validation

## 📁 Project Structure

```
src/
├── index.ts              # Main Worker entry point with routing
├── types.ts              # TypeScript type definitions
├── chatsession.ts        # Durable Object for chat sessions
├── queue.ts              # Queue consumer for notifications
├── routes/
│   ├── chat.ts           # Chat API endpoint
│   ├── estimate.ts       # Estimate form handler
│   ├── upload.ts         # Image upload endpoint
│   └── analytics.ts      # Analytics tracking endpoint
└── lib/
    ├── analytics.ts      # Analytics service (GA4, Google Ads)
    ├── notifications.ts  # Notification service (SMS, Email)
    └── static.ts         # Static asset serving
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Cloudflare account with Workers enabled
- Wrangler CLI installed globally

### Environment Variables
Set these as secrets in your Cloudflare Worker:

```bash
# Required
OPENAI_API_KEY=sk-...
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_ID/YOUR_GATEWAY_ID/openai/v1/chat/completions

# Optional but recommended
SENDGRID_API_KEY=SG....
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Analytics (configure in wrangler.toml)
GA_MEASUREMENT_ID=G-XXXXXXXXXX
GA_API_SECRET=your-ga4-api-secret
GOOGLE_ADS_CONVERSION_ID=123456789
```

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Configure Cloudflare resources:**
   - Update `wrangler.toml` with your account IDs
   - Create D1 database: `wrangler d1 create dependable_leads`
   - Create queue: `wrangler queues create lead_notifications`

4. **Deploy to Cloudflare:**
   ```bash
   wrangler deploy
   ```

## 🎯 API Endpoints

### Chat API
```
POST /api/chat
Content-Type: application/json
X-Session-ID: [optional session ID]

{
  "message": "What paint colors do you recommend?",
  "page": "https://example.com/current-page",
  "imageUrl": "[optional image URL]"
}
```

### Image Upload
```
POST /api/upload
Content-Type: multipart/form-data

FormData:
- image: [image file]
- sessionId: [chat session ID]
```

### Analytics Tracking
```
POST /api/analytics
Content-Type: application/json

{
  "event": "phone_click",
  "category": "conversion",
  "page": "https://example.com/current-page",
  "sessionId": "[session ID]",
  "customData": {}
}
```

### Estimate Submission
```
POST /api/estimate
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "(555) 123-4567",
  "service": "Interior Painting",
  "message": "Need quote for living room"
}
```

## 🎨 Frontend Integration

The system automatically injects analytics tracking into HTML pages. For the advanced chat widget, use the included `chat-demo.html` file as a reference.

### Basic Chat Integration
```javascript
// Initialize chat widget
const chatWidget = new AdvancedChatWidget();

// Track custom events
window.dpAnalytics.track('custom_event', {
  category: 'engagement',
  value: 10
});
```

## 📊 Analytics Events

The system tracks the following conversion and engagement events:

- **phone_click**: Phone number clicks (Value: 50)
- **form_submit**: Estimate form submissions (Value: 25-150)
- **chat_interaction**: Chat messages (Value: 5-25)
- **high_value_chat_detected**: Premium lead qualification (Value: 25)
- **page_engagement**: User engagement metrics
- **image_upload**: Photo analysis requests (Value: 10)

## 🔔 Notification Types

### High-Value Lead Notifications
- Commercial project inquiries
- Whole house painting requests
- Urgent timeline requirements
- High-budget projects

### Standard Notifications
- All estimate form submissions
- General chat inquiries
- Contact form submissions

## 🧪 Testing

Use the included `chat-demo.html` file to test:

1. Open the chat demo page
2. Send various messages to test lead qualification
3. Upload images to test photo analysis
4. Monitor browser console for analytics events
5. Check notification queue for triggered alerts

## 🛡️ Security Features

- Input validation on all endpoints
- File type and size restrictions for uploads
- Rate limiting ready (configure in Cloudflare dashboard)
- Secure environment variable handling
- Error handling without information leakage

## 📈 Performance Optimizations

- Edge computing with Cloudflare Workers
- Persistent chat sessions with Durable Objects
- Asynchronous analytics tracking
- Efficient static asset serving
- Queue-based notification processing

## 🎛️ Configuration Options

### Lead Qualification Triggers
Customize in `src/chatsession.ts`:
- Commercial keywords
- Service type indicators
- Urgency markers
- Budget discussions

### Analytics Events
Modify in `src/lib/analytics.ts`:
- Event values
- Custom dimensions
- Conversion actions

### Notification Templates
Update in `src/lib/notifications.ts`:
- SMS message formats
- Email templates
- Priority thresholds

## 📞 Support

For technical support or customization requests, contact the development team or refer to the Cloudflare Workers documentation.

## 🔗 Related Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Google Analytics 4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4)
- [Twilio API Documentation](https://www.twilio.com/docs)
- [SendGrid API Documentation](https://docs.sendgrid.com/)