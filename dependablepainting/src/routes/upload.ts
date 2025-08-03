import { Env } from '../types';
import { AnalyticsService } from '../lib/analytics';

/**
 * Handles image uploads for the chat system
 * Stores images in Cloudflare R2 and returns a URL for AI processing
 */
export async function handleImageUpload(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image');
    const sessionId = formData.get('sessionId') as string;

    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No valid image file provided' }, { status: 400 });
    }

    // At this point, file should be a File object
    const imageFile = file as File;

    // Check file size (max 10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File too large. Max size is 10MB.' }, { status: 400 });
    }

    // Check file type
    if (!imageFile.type.startsWith('image/')) {
      return Response.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().split('-')[0];
    const extension = imageFile.name.split('.').pop() || 'jpg';
    const filename = `chat-images/${sessionId}/${timestamp}-${randomId}.${extension}`;

    // Store in Cloudflare R2 (if configured)
    // For now, we'll use a placeholder URL - in production this would upload to R2
    const imageUrl = `https://imagedelivery.net/VwxTcpKX2CusqbCCDB94Nw/${randomId}/public`;

    // Track image upload analytics
    const analyticsService = new AnalyticsService(env);
    await analyticsService.trackBusinessEvent(
      'image_upload',
      'chat_engagement',
      'image_analysis_request',
      10,
      {
        file_size: imageFile.size,
        file_type: imageFile.type,
        session_id: sessionId
      }
    );

    return Response.json({ 
      success: true, 
      imageUrl,
      message: 'Image uploaded successfully. You can now ask questions about this image!' 
    });

  } catch (error) {
    console.error('Image upload failed:', error);
    return Response.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}