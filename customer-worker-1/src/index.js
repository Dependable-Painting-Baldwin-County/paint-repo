/**
 * Advanced Cloudflare Worker for Dependable Painting
 *
 * This worker acts as an entrypoint for the customer‑facing application.  It
 * performs the following tasks:
 *  - Routes API requests beginning with `/api/` to the `PAINT_DISPATCHER_SERVICE`
 *    binding unless they match one of the special endpoints implemented here.
 *  - Implements `/api/chat` to provide an AI‑powered assistant that can
 *    discuss painting services, materials, surface preparation and provide
 *    ball‑park estimates.  It uses the OpenAI Chat Completion API via the
 *    `OPENAI_API_KEY` environment variable.
 *  - Implements `/api/contact` to accept form submissions, optionally handle
 *    an uploaded image, persist the submission to a KV namespace (`PAINTER_KVBINDING`)
 *    and send notification and confirmation emails via an external email API
 *    (e.g. Resend).  Email API keys must be stored as secrets.
 *  - Implements `/api/upload` to accept image uploads and store them in an R2
 *    bucket (`paint-bucket`).  Returns the URL of the stored image.
 *  - Serves all other requests from the static asset binding (`ASSETS`).
 *
 * Environment bindings required in wrangler.jsonc:
 *  "services": [ { "binding": "PAINT_DISPATCHER_SERVICE", "service": "paint-dispatcher" } ],
 *  "kv_namespaces": [ { "binding": "PAINTER_KVBINDING", "id": "<kv-namespace-id>" } ],
 *  "r2_buckets": [ { "binding": "paint-bucket", "bucket_name": "paint-images" } ],
 *  "vars": { "EMAIL_ENDPOINT": "https://api.resend.com/emails" },
 *  secrets for OPENAI_API_KEY and RESEND_API_KEY (Resend or other provider).
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // AI chat endpoint
    if (pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }
    // Contact form endpoint
    if (pathname === '/api/contact' && request.method === 'POST') {
      return handleContact(request, env);
    }
    // Image upload endpoint
    if (pathname === '/api/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    }
    // Forward any other API routes to the dispatcher service
    if (pathname.startsWith('/api/')) {
      return env.PAINT_DISPATCHER_SERVICE.fetch(request);
    }
    // Serve static assets from the public directory
    return env.ASSETS.fetch(request);
  },
};

/**
 * Handle AI chat by forwarding the user prompt and optional conversation history
 * to OpenAI's Chat Completion API.  The system prompt instructs the model to
 * behave like a painting services expert.  Requires the OPENAI_API_KEY secret.
 */
async function handleChat(request, env) {
  try {
    const { prompt, history = [] } = await request.json();
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid prompt' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const messages = [
      {
        role: 'system',
        content: 'You are a knowledgeable assistant for Dependable Painting, a painting service based in Baldwin County. Explain interior, exterior, commercial, cabinet, sheetrock repair and epoxy coating services, discuss materials and surface preparation, offer rough pricing guidance and recommend contacting Alex from Dependable Painting for precise estimates. Keep responses concise and helpful.',
      },
      ...history,
      { role: 'user', content: prompt },
    ];
    const payload = {
      model: 'gpt-4-turbo',
      messages,
      max_tokens: 512,
      temperature: 0.7,
    };
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!openaiResp.ok) {
      console.error('OpenAI error', await openaiResp.text());
      return new Response(JSON.stringify({ error: 'Failed to contact AI service' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const data = await openaiResp.json();
    const message = data.choices?.[0]?.message?.content ?? '';
    return new Response(JSON.stringify({ message }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * Handle contact form submissions.  Uses the Fetch API to parse `formData` for
 * multipart forms.  Persists the data to a KV namespace and sends an email
 * via an external provider (Resend in this example) if configured.
 */
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
    // Prepare email payload for Resend.
    const toEmail = env.DESTINATION_EMAIL || 'owner@example.com';
    const emailPayload = {
      from: toEmail,
      to: [toEmail],
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
        from: toEmail,
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
    // Write lead event to analytics engine if defined
    if (env.ANALYTICS_ENGINE) {
      const leadInfo = {
        id,
        timestamp: record.timestamp,
        name,
        email,
        phone,
        message,
        imageUrl: imageUrl || null,
      };
      try {
        await env.ANALYTICS_ENGINE.writeBlobs([JSON.stringify(leadInfo)]);
      } catch (analyticsErr) {
        console.error('Analytics write error', analyticsErr);
      }
    }
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * Handle uploading images to an R2 bucket.  Returns the publicly accessible URL
 * of the stored file.  Expects a multipart/form-data request with a single
 * field named `image`.
 */
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
    return new Response(JSON.stringify({ url }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
