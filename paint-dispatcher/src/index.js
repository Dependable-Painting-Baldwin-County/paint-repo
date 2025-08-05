/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

/**
 * Central Orchestrator Worker
 *
 * This worker acts as the backend orchestrator for Dependable Painting. It
 * exposes a handful of API routes that are consumed by the customer‑facing
 * worker (customer‑worker‑1). The routes include:
 *
 *  - `/api/price` (POST): perform basic price estimations for various
 *    painting services. Accepts a JSON payload describing the job and
 *    returns a simple price breakdown. No secrets are exposed; pricing
 *    formulas live here to prevent tampering on the client side.
 *
 *  - `/api/queue` (POST): enqueue a task into a background queue. This is
 *    useful for long running workflows such as sending follow‑up emails or
 *    generating proposals. If a Cloudflare Queue binding named
 *    `TASK_QUEUE` is configured in `wrangler.jsonc`, tasks will be enqueued
 *    automatically. Otherwise the call will no‑op and immediately return.
 *
 *  - `/api/enrich` (POST): enrich customer or lead data by calling an
 *    external AI service. Uses the OpenAI Chat Completion API when the
 *    `OPENAI_API_KEY` secret is available. This keeps the API key hidden
 *    from the client while still allowing AI assistance.
 *
 *  - `/api/automation` (POST): orchestrate a multi‑step workflow by
 *    combining price estimation, queueing and data enrichment. Clients can
 *    define a sequence of steps in the request body, and the worker will
 *    execute them in order, returning an aggregated result.
 *
 * Any other request is answered with a simple 404 response. This worker
 * should be bound to the `PAINT_DISPATCHER_SERVICE` in the customer worker's
 * `wrangler.jsonc` so that `/api/*` requests not handled by the
 * customer‑facing worker are forwarded here.
 */

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

/**
 * Calculate an estimate based on simple heuristics. Pricing logic is kept on
 * the server to prevent tampering. The formula used here is illustrative and
 * can be adjusted to better reflect real world costs. It accepts a JSON
 * payload in the following shape:
 *
 *  {
 *    "serviceType": "interior" | "exterior" | "commercial" | "cabinet" | "sheetrock" | "epoxy",
 *    "squareFeet": number,              // approximate area in square feet
 *    "floors": number,                  // number of floors (for exterior jobs)
 *    "rooms": number,                   // number of rooms (for interior jobs)
 *    "extras": string[]                 // optional extras like 'trim', 'ceiling', etc.
 *  }
 *
 * Returns an object with a base price, extras breakdown and total.
 */
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

/**
 * Enqueue a task for background processing. The payload should be a JSON
 * object describing the task. When configured, the TASK_QUEUE binding will
 * deliver the message to a Cloudflare Queue. If the binding is missing, the
 * task is ignored but the response still indicates success. This allows
 * integration with the customer worker without causing errors if queues are
 * unavailable in development.
 *
 * Example request body:
 *  {
 *    "taskName": "sendFollowUpEmail",
 *    "payload": { "leadId": "123" }
 *  }
 */
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

/**
 * Enrich customer data using an AI model. This function takes a request with
 * a JSON body containing a `prompt` string and optional `context` object.
 * It calls the OpenAI Chat Completion API behind the scenes if the
 * `OPENAI_API_KEY` is available. This keeps the API key private while still
 * allowing the frontend to leverage AI assistance.
 *
 * Example request body:
 *  {
 *    "prompt": "Generate a polite thank you note for the following customer.",
 *    "context": { "name": "Jane Doe", "service": "interior painting" }
 *  }
 */
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

/**
 * Orchestrate multiple operations in sequence. The request body should
 * include an array of steps to execute. Each step is an object with a
 * `type` property indicating which handler to call (`price`, `queue`,
 * `enrich`) and a `params` object containing the arguments for that
 * handler. Steps are executed sequentially and the aggregated results
 * returned as an array.
 *
 * Example request body:
 *  {
 *    "steps": [
 *      { "type": "price", "params": { "serviceType": "interior", "squareFeet": 500 } },
 *      { "type": "enrich", "params": { "prompt": "Draft a follow‑up note", "context": { "name": "John" } } },
 *      { "type": "queue", "params": { "taskName": "sendFollowUpEmail", "payload": { "email": "john@example.com" } } }
 *    ]
 *  }
 */
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
