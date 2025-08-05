export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            const path = url.pathname;
            // Only accept JSON or form data on POST routes
            if (request.method === 'POST') {
                switch (path) {
                    case '/api/price':
                        return handlePrice(request, env);
                    case '/api/queue':
                        return handleQueue(request, env, ctx);
                    case '/api/enrich':
                        return handleEnrich(request, env);
                    case '/api/automation':
                        return handleAutomation(request, env, ctx);
                    case '/api/contact':
                        return handleContactForm(request, env);
                    default:
                        break;
                }
            }
            // For all other routes, return 404
            return new Response(JSON.stringify({ error: 'Not Found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (err) {
            console.error('Unhandled error:', err);
            return new Response(JSON.stringify({ error: 'Server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },
};
async function handlePrice(request, env) {
    try {
        const body = await request.json();
        const {
            serviceType = 'interior',
            squareFeet = 0,
            floors = 1,
            rooms = 1,
            extras = [],
        } = body;
        // Basic rates per square foot in USD. These numbers are illustrative.
        const baseRates = {
            interior: 1.5,
            exterior: 2.0,
            commercial: 2.5,
            cabinet: 3.0,
            sheetrock: 1.8,
            epoxy: 4.0,
        };
        const rate = baseRates[serviceType] ?? baseRates.interior;
        // Compute base price. For exteriors multiply by floors to account for scaffolding.
        let basePrice = squareFeet * rate;
        if (serviceType === 'exterior' && floors > 1) {
            basePrice *= 1 + (floors - 1) * 0.1; // 10% extra per additional floor
        }
        if (serviceType === 'interior' && rooms > 1) {
            basePrice *= 1 + (rooms - 1) * 0.05; // 5% extra per additional room
        }
        // Extras pricing
        const extrasPricing = {};
        let extrasTotal = 0;
        for (const extra of Array.isArray(extras) ? extras : []) {
            switch (extra) {
                case 'trim':
                    extrasPricing[extra] = 0.2 * squareFeet;
                    break;
                case 'ceiling':
                    extrasPricing[extra] = 0.15 * squareFeet;
                    break;
                case 'primer':
                    extrasPricing[extra] = 0.1 * squareFeet;
                    break;
                default:
                    extrasPricing[extra] = 0.05 * squareFeet;
            }
            extrasTotal += extrasPricing[extra];
        }
        const total = basePrice + extrasTotal;
        const result = {
            serviceType,
            squareFeet,
            floors,
            rooms,
            basePrice: Number(basePrice.toFixed(2)),
            extras: extrasPricing,
            total: Number(total.toFixed(2)),
        };
        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Price calculation error:', err);
        return new Response(JSON.stringify({ error: 'Invalid input' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
async function handleQueue(request, env, ctx) {
    try {
        const { taskName, payload } = await request.json();
        if (!taskName) {
            return new Response(JSON.stringify({ error: 'taskName is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // If TASK_QUEUE binding exists, enqueue the message
        if (env.TASK_QUEUE && typeof env.TASK_QUEUE.send === 'function') {
            const message = { taskName, payload: payload ?? {} };
            await env.TASK_QUEUE.send(JSON.stringify(message));
        }
        return new Response(JSON.stringify({ queued: true }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Queue error:', err);
        return new Response(JSON.stringify({ error: 'Invalid input' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
async function handleEnrich(request, env) {
    try {
        const { prompt, context = {} } = await request.json();
        if (!prompt || typeof prompt !== 'string') {
            return new Response(JSON.stringify({ error: 'prompt is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Compose the system and user messages for the chat model
        const systemMessage = {
            role: 'system',
            content:
                'You are an assistant for Dependable Painting that helps with customer communications and lead enrichment. Use the provided context to tailor your responses. Keep answers concise and professional.',
        };
        const userMessage = {
            role: 'user',
            content: `${prompt}\n\nContext: ${JSON.stringify(context)}`,
        };
        // If we have an OpenAI API key, call the chat completion API
        let resultMessage = 'No enrichment provider configured.';
        if (env.OPENAI_API_KEY) {
            const payload = {
                model: 'gpt-4-turbo',
                messages: [systemMessage, userMessage],
                max_tokens: 256,
                temperature: 0.7,
            };
            const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify(payload),
            });
            if (aiResp.ok) {
                const data = await aiResp.json();
                resultMessage = data.choices?.[0]?.message?.content?.trim() ?? '';
            } else {
                console.error('OpenAI API error:', await aiResp.text());
                resultMessage = 'Failed to contact enrichment service.';
            }
        }
        return new Response(JSON.stringify({ message: resultMessage }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Enrichment error:', err);
        return new Response(JSON.stringify({ error: 'Invalid input' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
async function handleAutomation(request, env, ctx) {
    try {
        const { steps } = await request.json();
        if (!Array.isArray(steps) || steps.length === 0) {
            return new Response(JSON.stringify({ error: 'steps must be a non‑empty array' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const results = [];
        for (const step of steps) {
            const { type, params } = step;
            let res;
            switch (type) {
                case 'price':
                    res = await (await handlePrice(new Request(request.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(params || {}),
                    }), env)).json();
                    results.push({ type, result: res });
                    break;
                case 'queue':
                    await handleQueue(new Request(request.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(params || {}),
                    }), env, ctx);
                    results.push({ type, result: { queued: true } });
                    break;
                case 'enrich':
                    res = await (await handleEnrich(new Request(request.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(params || {}),
                    }), env)).json();
                    results.push({ type, result: res });
                    break;
                default:
                    results.push({ type, error: `Unknown step type: ${type}` });
            }
        }
        return new Response(JSON.stringify({ results }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Automation error:', err);
        return new Response(JSON.stringify({ error: 'Invalid input' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

// ... 

// ... 

async function handleContactForm(request, env) {
  try {
    const { name, email, phone, message, imageUrl } = await request.json();
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Name, email, and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const emailPayload = {
      from: env.SOURCE_EMAIL || 'contact@dependablepainting.work',
      to: [env.DESTINATION_EMAIL || 'just-paint-it@dependablepainting.work'],
      subject: `Contact Form Submission from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || ''}\nMessage: ${message}\nImage URL: ${imageUrl || ''}`
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY || ''}`
      },
      body: JSON.stringify(emailPayload)
    });

    if (!response.ok) {
      console.error('Resend API error:', await response.text());
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Contact form error:', err);
    return new Response(JSON.stringify({ error: 'Invalid input' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}