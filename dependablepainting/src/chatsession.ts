import { ChatMessage, OpenAIResponse, Env } from './types';
import { AnalyticsService } from './lib/analytics';

/**
 * A Durable Object representing an individual chat session. Each instance
 * maintains its own conversation history in storage and orchestrates calls
 * to the AI Gateway on behalf of the client. Messages are forwarded along
 * with their context and the resulting reply is persisted and returned.
 */
export class ChatSession {
  constructor(readonly state: DurableObjectState, readonly env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const { message, page, imageUrl } = await request.json() as ChatMessage;
    const history: any[] = await this.state.storage.get('history') || [];

    // Enhanced system prompt with business context
    const systemPrompt = `You are Paint Guru, the AI assistant for Dependable Painting LLC, a premium painting contractor serving Baldwin and Mobile County, Alabama.

    BUSINESS INFO:
    - Owner: Licensed and insured painting contractor
    - Service Areas: Baldwin County (Fairhope, Daphne, Spanish Fort, Bay Minette) and Mobile County, Alabama
    - Services: Interior painting, exterior painting, cabinet painting, commercial painting, wood siding
    - Phone: (251) 525-4405
    - Email: just-paint-it@dependablepainting.work
    - Website: https://dependablepainting.work
    - Hours: Monday-Friday 7AM-7PM, Saturday 8AM-5PM
    - Warranty: 2-year warranty on all interior work, 5-year warranty on exterior work
    - Free estimates: Same-day estimates available

    PERSONALITY: Professional, knowledgeable, friendly, and focused on helping customers. You can recommend paint colors, explain surface preparation, discuss materials, and guide customers through the painting process.

    LEAD QUALIFICATION: Identify high-value leads (commercial projects, whole house painting, premium services) and encourage them to call immediately or fill out the contact form.

    If someone asks about scheduling, estimates, or specific projects, always encourage them to call (251) 525-4405 or visit the contact form for a free estimate.

    IMAGE ANALYSIS: If an image is provided, analyze the surfaces, recommend paint types, identify preparation needs, and suggest color schemes. Be specific about what you observe.`;

    const payload = {
      model: 'gpt-4o', // Upgraded to GPT-4o for better performance and image support
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        ...history,
        { 
          role: 'user', 
          content: imageUrl 
            ? [
                { type: 'text', text: `${message} (from ${page || 'website'})` },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            : `${message} (from ${page || 'website'})` 
        }
      ]
    };

    const aiResponse = await fetch(this.env.AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const json = await aiResponse.json() as OpenAIResponse;
    const reply = json.choices[0].message.content;

    // Check if this is a high-value lead and trigger notification
    const isHighValueLead = this.detectHighValueLead(message, reply);
    if (isHighValueLead) {
      // Trigger notification queue for high-value leads
      await this.env.NOTIFY_QUEUE.send(JSON.stringify({
        type: 'high_value_chat_lead',
        message,
        reply,
        page: page || 'unknown',
        timestamp: Date.now()
      }));
    }

    // Track analytics for chat interaction
    const analyticsService = new AnalyticsService(this.env);
    const sessionId = this.state.id.toString();
    
    // Use waitUntil to track analytics without blocking response
    // Note: this.state.waitUntil is available in Durable Objects
    this.state.waitUntil(
      analyticsService.trackChatInteraction(
        message,
        reply,
        page || 'unknown',
        sessionId
      )
    );

    const updatedHistory = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply }
    ];
    await this.state.storage.put('history', updatedHistory);

    return Response.json({ 
      reply, 
      sessionId: sessionId,
      isHighValue: isHighValueLead 
    });
  }

  private detectHighValueLead(message: string, reply: string): boolean {
    const highValueKeywords = [
      'commercial', 'business', 'office', 'restaurant', 'store',
      'whole house', 'entire house', 'multiple rooms',
      'exterior', 'siding', 'trim',
      'estimate', 'quote', 'price', 'cost',
      'when can you start', 'schedule', 'appointment',
      'budget', 'timeline', 'project'
    ];

    const messageText = message.toLowerCase();
    return highValueKeywords.some(keyword => messageText.includes(keyword));
  }
}