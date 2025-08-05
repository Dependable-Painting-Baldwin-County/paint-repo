export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }
    if (pathname === '/api/contact' && request.method === 'POST') {
      return handleContact(request, env);
    }
    if (pathname === '/api/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    }
    if (pathname.startsWith('/api/')) {
      return env['paint-workers'].fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleChat(request, env) {
  try {
    const { message, context = {} } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // Forward chat requests to the paint-dispatcher for AI processing
    const dispatcherResponse = await env['paint-workers'].fetch(new Request(request.url.replace('/api/chat', '/api/enrich'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: message,
        context: { 
          ...context, 
          source: 'customer_chat',
          timestamp: new Date().toISOString()
        }
      })
    }));

    if (!dispatcherResponse.ok) {
      throw new Error('Dispatcher service unavailable');
    }

    const result = await dispatcherResponse.json();
    
    // Log analytics for chat interaction
    if (env.ANALYTICS_ENGINE) {
      try {
        await env.ANALYTICS_ENGINE.writeDataPoint({
          blobs: [JSON.stringify({ 
            event: "chat_interaction", 
            message: message.substring(0, 100), // Limit PII
            response: result.message?.substring(0, 100),
            timestamp: new Date().toISOString()
          })]
        });
      } catch (err) {
        console.error("Analytics write error", err);
      }
    }

    return new Response(JSON.stringify({ 
      response: result.message || 'I apologize, but I cannot provide a response right now. Please feel free to contact us directly.',
      success: true 
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    console.error('Chat error:', err);
    return new Response(JSON.stringify({ 
      error: 'Unable to process chat request. Please try again or contact us directly.',
      response: 'I apologize, but I cannot assist you right now. Please feel free to call us at your convenience or submit a contact form.'
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

async function handleContact(request, env) {
  try {
    const formData = await request.formData();
    const name = formData.get('name');
    const email = formData.get('email');
    const phone = formData.get('phone');
    const message = formData.get('message');
    const file = formData.get('image');
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    // Persist submission to KV
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const record = { timestamp: new Date().toISOString(), name, email, phone, message };
    await env.PAINTER_KVBINDING.put(id, JSON.stringify(record));
    // Optionally store the uploaded file to R2 and record the URL
    let imageUrl;
    if (file && file.size) {
      const fileName = `${id}-${file.name}`;
      await env["paint-bucket"].put(fileName, file.stream(), { httpMetadata: { contentType: file.type } });
      imageUrl = `https://${env["paint-bucket"].bucketName}.r2.cloudflarestorage.com/${fileName}`;
    }
    if (env.ANALYTICS_ENGINE) {
      try {
        await env.ANALYTICS_ENGINE.writeDataPoint({
          blobs: [JSON.stringify({ event: "contact_submission", id, ...record, imageUrl: imageUrl || null })]
        });
      } catch (err) {
        console.error("Analytics write error", err);
      }
    }
    // Prepare Resend email payload (not SendGrid)
    const emailPayload = {
      from: env.DESTINATION_EMAIL || 'just-paint-it@dependablepainting.work',
      to: [env.DESTINATION_EMAIL || 'just-paint-it@dependablepainting.work'],
      subject: 'New Contact Form Submission',
      text: `New submission from ${name}\nEmail: ${email}\nPhone: ${phone}\nMessage: ${message}\n${imageUrl ? 'Image: ' + imageUrl : ''}`,
    };
    if (env.RESEND_API_KEY && env.EMAIL_ENDPOINT) {
      await fetch(env.EMAIL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });
    }
    // Auto‑reply to the customer
    if (env.RESEND_API_KEY && env.EMAIL_ENDPOINT) {
      const replyPayload = {
        from: env.DESTINATION_EMAIL || 'just-paint-it@dependablepainting.work',
        to: [email],
        subject: 'Thanks for contacting Dependable Painting',
        text: `Hi ${name},\n\nThanks for reaching out to Dependable Painting. We have received your message and will get back to you soon.\n\nBest regards,\nAlex`,
      };
      await fetch(env.EMAIL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(replyPayload),
      });
    }
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleUpload(request, env) {
  try {
    const formData = await request.formData();
    const file = formData.get('image');
    if (!file || !file.size) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const fileName = `${id}-${file.name}`;
    await env["paint-bucket"].put(fileName, file.stream(), { httpMetadata: { contentType: file.type } });
    const url = `https://${env["paint-bucket"].bucketName}.r2.cloudflarestorage.com/${fileName}`;
    if (env.ANALYTICS_ENGINE) {
      try {
        await env.ANALYTICS_ENGINE.writeDataPoint({
          blobs: [JSON.stringify({ event: "image_upload", id, fileName, url })]
        });
      } catch (err) {
        console.error("Analytics write error", err);
      }
    }
    return new Response(JSON.stringify({ url }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}