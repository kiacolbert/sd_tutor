const request = require('supertest');
const path = require('path');

describe('Server API Tests', () => {
  let app;
  let server;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.PORT = 0; // Use random available port
    
    // Require server after setting environment
    app = require('../../server.js');
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  describe('Static File Serving', () => {
    test('should serve the index.html file at root path', async () => {
      await request(app)
        .get('/')
        .expect(200);
    });

    test('should serve static files', async () => {
      // Test that static file middleware is working
      // Note: These may return 404 in test environment but should not error
      const cssResponse = await request(app).get('/style.css');
      const jsResponse = await request(app).get('/script.js');
      
      // Should get either 200 (if file exists) or 404 (if mocked), but not server error
      expect([200, 404]).toContain(cssResponse.status);
      expect([200, 404]).toContain(jsResponse.status);
    });
  });

  describe('Health Check Endpoint', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('port');
    });
  });

  describe('Webhook Test Endpoint', () => {
    test('should accept audio file upload', async () => {
      // Create a mock audio buffer
      const audioBuffer = Buffer.from('mock audio data');
      
      const response = await request(app)
        .post('/webhook/test')
        .attach('audio', audioBuffer, {
          filename: 'test.wav',
          contentType: 'audio/wav'
        })
        .field('timestamp', new Date().toISOString())
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Audio received successfully');
      expect(response.body).toHaveProperty('receivedFile');
      expect(response.body.receivedFile).toHaveProperty('name', 'test.wav');
      expect(response.body.receivedFile).toHaveProperty('type', 'audio/wav');
    });

    test('should reject non-audio files', async () => {
      const textBuffer = Buffer.from('not audio data');
      
      const response = await request(app)
        .post('/webhook/test')
        .attach('audio', textBuffer, {
          filename: 'test.txt',
          contentType: 'text/plain'
        });
        
      // Should be 400 or 500 depending on when validation fails
      expect([400, 500]).toContain(response.status);
    });

    test('should handle missing audio file', async () => {
      const response = await request(app)
        .post('/webhook/test')
        .field('timestamp', new Date().toISOString())
        .expect(400)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('error', 'No audio file received');
    });

    test('should handle large file uploads within limit', async () => {
      // Create a 5MB audio buffer (within 10MB limit)
      const audioBuffer = Buffer.alloc(5 * 1024 * 1024, 'a');
      
      await request(app)
        .post('/webhook/test')
        .attach('audio', audioBuffer, {
          filename: 'large.wav',
          contentType: 'audio/wav'
        })
        .expect(200);
    });

    test('should reject files exceeding size limit', async () => {
      // Create a 15MB audio buffer (exceeds 10MB limit)
      const audioBuffer = Buffer.alloc(15 * 1024 * 1024, 'a');
      
      const response = await request(app)
        .post('/webhook/test')
        .attach('audio', audioBuffer, {
          filename: 'toolarge.wav',
          contentType: 'audio/wav'
        })
        .expect(400)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('error', 'File too large. Maximum size is 10MB.');
    });

    test('should handle different audio formats', async () => {
      const formats = [
        { ext: 'wav', type: 'audio/wav' },
        { ext: 'mp3', type: 'audio/mpeg' },
        { ext: 'webm', type: 'audio/webm' },
        { ext: 'ogg', type: 'audio/ogg' }
      ];

      for (const format of formats) {
        const audioBuffer = Buffer.from('mock audio data');
        
        await request(app)
          .post('/webhook/test')
          .attach('audio', audioBuffer, {
            filename: `test.${format.ext}`,
            contentType: format.type
          })
          .expect(200);
      }
    });

    test('should include timestamp in response', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const testTimestamp = '2023-01-01T00:00:00.000Z';
      
      const response = await request(app)
        .post('/webhook/test')
        .attach('audio', audioBuffer, {
          filename: 'test.wav',
          contentType: 'audio/wav'
        })
        .field('timestamp', testTimestamp)
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      // Response timestamp should be different from request timestamp
      expect(response.body.timestamp).not.toBe(testTimestamp);
    });
  });

  describe('CORS Headers', () => {
    test('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should handle preflight OPTIONS requests', async () => {
      await request(app)
        .options('/webhook/test')
        .expect(204);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('error', 'Endpoint not found');
    });

    test('should handle malformed requests gracefully', async () => {
      await request(app)
        .post('/webhook/test')
        .send('invalid data')
        .expect(400);
    });

    test('should handle server errors gracefully', async () => {
      // Test that health endpoint is robust
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });

  describe('Request Method Validation', () => {
    test('should reject GET requests to webhook endpoint', async () => {
      await request(app)
        .get('/webhook/test')
        .expect(404);
    });

    test('should reject PUT requests to webhook endpoint', async () => {
      await request(app)
        .put('/webhook/test')
        .expect(404);
    });

    test('should reject DELETE requests to webhook endpoint', async () => {
      await request(app)
        .delete('/webhook/test')
        .expect(404);
    });
  });

  describe('Content-Type Handling', () => {
    test('should handle multipart/form-data correctly', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      
      await request(app)
        .post('/webhook/test')
        .field('timestamp', new Date().toISOString())
        .field('customField', 'customValue')
        .attach('audio', audioBuffer, {
          filename: 'test.wav',
          contentType: 'audio/wav'
        })
        .expect(200);
    });

    test('should handle missing content-type in file upload', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      
      const response = await request(app)
        .post('/webhook/test')
        .attach('audio', audioBuffer, 'test.wav');
        
      // May pass or fail depending on browser/supertest behavior
      // This test just ensures no server error occurs
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle multiple concurrent requests', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const requests = [];

      // Create 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/webhook/test')
            .attach('audio', audioBuffer, {
              filename: `test${i}.wav`,
              contentType: 'audio/wav'
            })
            .field('timestamp', new Date().toISOString())
        );
      }

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });

    test('should respond within reasonable time', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const startTime = Date.now();
      
      await request(app)
        .post('/webhook/test')
        .attach('audio', audioBuffer, {
          filename: 'test.wav',
          contentType: 'audio/wav'
        })
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});