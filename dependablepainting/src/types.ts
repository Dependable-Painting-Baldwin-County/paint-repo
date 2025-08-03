// Environment bindings available to the Cloudflare Worker
export interface Env {
  // Durable Object binding for chat sessions
  CHAT_SESSIONS: DurableObjectNamespace;
  
  // D1 database binding for storing leads
  DB: D1Database;
  
  // Queue binding for sending notifications
  NOTIFY_QUEUE: Queue;
  
  // Assets binding for serving static files
  ASSETS: Fetcher;
  
  // Environment variables
  OPENAI_API_KEY: string;
  AI_GATEWAY_URL: string;
  EMAIL_FROM: string;
  EMAIL_TO: string;
  SENDGRID_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  
  // Analytics
  GA_MEASUREMENT_ID?: string;
  GA_API_SECRET?: string;
  GOOGLE_ADS_CONVERSION_ID?: string;
}

// Chat message interface
export interface ChatMessage {
  message: string;
  page?: string;
  imageUrl?: string;
}

// Estimate request interface
export interface EstimateRequest {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
}

// OpenAI API response interface
export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}