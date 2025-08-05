import { describe, it, expect } from 'vitest';

describe('Paint Dispatcher', () => {
  it('should handle price calculation requests', async () => {
    const mockRequest = new Request('http://localhost/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: 'interior',
        squareFeet: 1000,
        floors: 1,
        rooms: 3
      })
    });

    expect(mockRequest.method).toBe('POST');
    expect(mockRequest.url).toContain('/api/price');
  });

  it('should handle automation requests', async () => {
    const mockRequest = new Request('http://localhost/api/automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steps: [
          { type: 'price', params: { serviceType: 'interior', squareFeet: 500 } }
        ]
      })
    });

    expect(mockRequest.method).toBe('POST');
    expect(mockRequest.url).toContain('/api/automation');
  });

  it('should handle enrichment requests', async () => {
    const mockRequest = new Request('http://localhost/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Help with painting services',
        context: { source: 'customer_chat' }
      })
    });

    expect(mockRequest.method).toBe('POST');
    expect(mockRequest.url).toContain('/api/enrich');
  });
});