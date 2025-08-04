import { Env } from '../types';

/**
 * Handles chat requests by delegating to a Durable Object representing a chat
 * session. A session ID is read from the `X-Session-ID` header if present,
 * otherwise a new UUID is generated. The request is forwarded to the Durable
 * Object stub for processing.
 */
export async function handleChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // If the caller passes a session ID in the header we'll reuse it; otherwise create a new one
  const sessionId = request.headers.get('X-Session-ID') || crypto.randomUUID();
  // Obtain a stub for the ChatSession DO using the session ID as the name
  const stub = env.CHAT_SESSIONS.get(env.CHAT_SESSIONS.idFromName(sessionId));
  // Forward the request to the DO for handling
  return stub.fetch(request);
}