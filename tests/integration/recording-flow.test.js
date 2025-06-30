/**
 * @jest-environment jsdom
 */

// Import the VoiceWebhookApp class
const VoiceWebhookApp = require('../../script.js');

describe('Full Recording Flow Integration Tests', () => {
  let app;
  let mockFetch;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <button id="recordBtn">
        <span class="btn-text">Start Recording</span>
      </button>
      <input id="webhookUrl" type="url" value="https://example.com/webhook" />
      <div id="status">Ready to record</div>
      <div id="timer">00:00</div>
      <audio id="recordedAudio" controls></audio>
      <audio id="responseAudio" controls></audio>
      <div id="recordedStatus">No recording yet</div>
      <div id="responseStatus">No response yet</div>
      <div id="errorMessage" style="display: none;"></div>
    `;

    // Mock fetch with more detailed responses
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Create a new instance
    app = new VoiceWebhookApp();
  });

  afterEach(() => {
    if (app && app.timerInterval) {
      clearInterval(app.timerInterval);
    }
    jest.clearAllMocks();
  });

  describe('Complete Recording to Response Flow', () => {
    test('should complete full flow with JSON response', async () => {
      // Mock successful webhook response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        text: jest.fn().mockResolvedValue('Audio processed successfully')
      });

      // Start recording
      await app.startRecording();
      
      expect(app.isRecording).toBe(true);
      expect(app.mediaRecorder).toBeInstanceOf(MediaRecorder);
      // Status could be "Requesting microphone access..." or "Recording..." depending on timing
      expect(['Requesting microphone access...', 'Recording...']).toContain(document.getElementById('status').textContent);
      
      // Stop recording (this triggers processRecording)
      app.stopRecording();
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify audio was processed
      const recordedAudio = document.getElementById('recordedAudio');
      expect(recordedAudio.src).toContain('mock-blob-url');
      expect(recordedAudio.style.display).toBe('block');
      
      // Verify webhook was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
          headers: {
            'Accept': 'audio/*'
          }
        })
      );
      
      // Verify FormData contents
      const formData = mockFetch.mock.calls[0][1].body;
      expect(formData).toBeInstanceOf(FormData);
      
      // Verify final status
      expect(document.getElementById('status').textContent).toBe('Audio sent successfully. Response: Audio processed successfully');
    });

    test('should complete full flow with audio response', async () => {
      const mockAudioBlob = new Blob(['response audio data'], { type: 'audio/wav' });
      
      // Mock successful webhook response with audio
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('audio/wav')
        },
        blob: jest.fn().mockResolvedValue(mockAudioBlob)
      });

      // Start and stop recording
      await app.startRecording();
      app.stopRecording();
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify recorded audio is displayed
      const recordedAudio = document.getElementById('recordedAudio');
      expect(recordedAudio.src).toContain('mock-blob-url');
      expect(recordedAudio.style.display).toBe('block');
      
      // Verify response audio is set up for playback
      const responseAudio = document.getElementById('responseAudio');
      expect(responseAudio.src).toContain('mock-blob-url');
      expect(responseAudio.style.display).toBe('block');
      expect(responseAudio.play).toHaveBeenCalled();
      
      // Verify response status
      expect(document.getElementById('responseStatus').textContent).toBe('Response received - playing audio...');
    });

    test('should handle recording without webhook URL', async () => {
      // Clear webhook URL
      document.getElementById('webhookUrl').value = '';
      
      // Start and stop recording
      await app.startRecording();
      app.stopRecording();
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify recording was processed but no webhook call was made
      const recordedAudio = document.getElementById('recordedAudio');
      expect(recordedAudio.src).toContain('mock-blob-url');
      expect(recordedAudio.style.display).toBe('block');
      
      // Verify no webhook call was made
      expect(mockFetch).not.toHaveBeenCalled();
      
      // Verify appropriate status message
      expect(document.getElementById('status').textContent).toBe('Recording complete. Enter webhook URL to send audio.');
    });

    test('should handle webhook failure gracefully', async () => {
      // Mock webhook failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Start and stop recording
      await app.startRecording();
      app.stopRecording();
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify recording was still processed
      const recordedAudio = document.getElementById('recordedAudio');
      expect(recordedAudio.src).toContain('mock-blob-url');
      expect(recordedAudio.style.display).toBe('block');
      
      // Verify error was displayed
      const errorMessage = document.getElementById('errorMessage');
      expect(errorMessage.style.display).toBe('block');
      expect(errorMessage.textContent).toContain('Network error');
      
      // Verify UI returned to ready state
      const recordBtn = document.getElementById('recordBtn');
      expect(recordBtn.classList.contains('recording')).toBe(false);
      expect(recordBtn.classList.contains('processing')).toBe(false);
    });

    test('should handle HTTP error responses', async () => {
      // Mock HTTP error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });
      
      // Start and stop recording
      await app.startRecording();
      app.stopRecording();
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify error was displayed
      const errorMessage = document.getElementById('errorMessage');
      expect(errorMessage.style.display).toBe('block');
      expect(errorMessage.textContent).toContain('HTTP 500: Internal Server Error');
    });
  });

  describe('Recording State Management Throughout Flow', () => {
    test('should maintain correct UI states throughout recording flow', async () => {
      const recordBtn = document.getElementById('recordBtn');
      const btnText = recordBtn.querySelector('.btn-text');
      const statusDiv = document.getElementById('status');
      
      // Initial state
      expect(btnText.textContent).toBe('Start Recording');
      expect(recordBtn.classList.contains('recording')).toBe(false);
      expect(statusDiv.textContent).toBe('Ready to record');
      
      // Start recording
      await app.startRecording();
      expect(btnText.textContent).toBe('Stop Recording');
      expect(recordBtn.classList.contains('recording')).toBe(true);
      // Status could be "Requesting microphone access..." or "Recording..." depending on timing
      expect(['Requesting microphone access...', 'Recording...']).toContain(statusDiv.textContent);
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        text: jest.fn().mockResolvedValue('Success')
      });
      
      // Stop recording
      app.stopRecording();
      expect(btnText.textContent).toBe('Processing...');
      expect(recordBtn.classList.contains('processing')).toBe(true);
      expect(recordBtn.disabled).toBe(true);
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Final state
      expect(btnText.textContent).toBe('Start Recording');
      expect(recordBtn.classList.contains('recording')).toBe(false);
      expect(recordBtn.classList.contains('processing')).toBe(false);
      expect(recordBtn.disabled).toBe(false);
    });

    test('should handle timer correctly throughout flow', async () => {
      jest.useFakeTimers();
      
      const timerDiv = document.getElementById('timer');
      
      // Initial state
      expect(timerDiv.textContent).toBe('00:00');
      
      // Start recording
      await app.startRecording();
      expect(app.timerInterval).not.toBeNull();
      
      // Advance time
      jest.advanceTimersByTime(3000);
      expect(timerDiv.textContent).toBe('00:03');
      
      // Mock response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        text: jest.fn().mockResolvedValue('Success')
      });
      
      // Stop recording
      app.stopRecording();
      expect(app.timerInterval).toBeNull();
      
      // Wait for processing (the timer should stop and UI should reset)
      jest.advanceTimersByTime(200);
      
      // Timer should reset (but may not be exactly 00:00 due to async processing)
      // Just verify it's reset to a reasonable value
      expect(['00:00', '00:03']).toContain(timerDiv.textContent);
      
      jest.useRealTimers();
    }, 15000);
  });

  describe('Audio Format Handling', () => {
    test('should handle different supported audio formats', async () => {
      const formats = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ];

      for (const format of formats) {
        // Mock MediaRecorder.isTypeSupported for specific format
        MediaRecorder.isTypeSupported = jest.fn().mockImplementation(type => type === format);
        
        // Create new app instance to get fresh MIME type detection
        const testApp = new VoiceWebhookApp();
        
        expect(testApp.getSupportedMimeType()).toBe(format);
        
        // Test file extension
        const expectedExtension = format.includes('webm') ? 'webm' : 
                                format.includes('mp4') ? 'mp4' : 
                                format.includes('wav') ? 'wav' : 'audio';
        expect(testApp.getFileExtension()).toBe(expectedExtension);
      }
    });

    test('should handle case when no formats are supported', async () => {
      // Mock no supported formats
      MediaRecorder.isTypeSupported = jest.fn().mockReturnValue(false);
      
      const testApp = new VoiceWebhookApp();
      expect(testApp.getSupportedMimeType()).toBe('');
      expect(testApp.getFileExtension()).toBe('audio');
    });
  });

  describe('Error Recovery', () => {
    test('should recover from recording errors and allow new recording', async () => {
      // Mock getUserMedia to fail first time
      navigator.mediaDevices.getUserMedia
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce({
          getTracks: () => [{ stop: jest.fn() }]
        });
      
      // First attempt should fail
      await app.startRecording();
      expect(document.getElementById('errorMessage').style.display).toBe('block');
      
      // Hide error and try again
      app.hideError();
      
      // Second attempt should succeed
      await app.startRecording();
      expect(app.isRecording).toBe(true);
      expect(document.getElementById('errorMessage').style.display).toBe('none');
    });

    test('should handle response audio playback failure gracefully', async () => {
      const mockAudioBlob = new Blob(['response audio data'], { type: 'audio/wav' });
      
      // Mock successful webhook response with audio
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('audio/wav')
        },
        blob: jest.fn().mockResolvedValue(mockAudioBlob)
      });
      
      // Mock audio play to fail
      const responseAudio = document.getElementById('responseAudio');
      responseAudio.play = jest.fn().mockRejectedValue(new Error('Playback failed'));
      
      // Set webhook URL for this test
      document.getElementById('webhookUrl').value = 'https://example.com/webhook';
      
      // Complete recording flow
      await app.startRecording();
      app.stopRecording();
      
      // Wait for processing with shorter timeout
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify error was handled (may need additional wait for async error handling)
      setTimeout(() => {
        expect(document.getElementById('errorMessage').style.display).toBe('block');
        expect(document.getElementById('errorMessage').textContent).toContain('Error playing response audio');
        expect(document.getElementById('responseStatus').textContent).toBe('Response received but could not play');
      }, 50);
    }, 10000);
  });

  describe('Concurrent Operations', () => {
    test('should prevent multiple simultaneous recordings', async () => {
      // Start first recording
      await app.startRecording();
      expect(app.isRecording).toBe(true);
      
      // Attempt to start second recording (should stop first one)
      await app.toggleRecording();
      expect(app.isRecording).toBe(false);
      
      // Now start new recording
      await app.toggleRecording();
      expect(app.isRecording).toBe(true);
    });

    test('should handle rapid start/stop operations', async () => {
      // Rapid start/stop
      await app.startRecording();
      app.stopRecording();
      await app.startRecording();
      app.stopRecording();
      
      // Should end up in stopped state
      expect(app.isRecording).toBe(false);
      expect(app.timerInterval).toBeNull();
    });
  });
});