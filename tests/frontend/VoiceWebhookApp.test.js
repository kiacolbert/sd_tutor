/**
 * @jest-environment jsdom
 */

// Import the VoiceWebhookApp class
const VoiceWebhookApp = require('../../script.js');

describe('VoiceWebhookApp', () => {
  let app;
  let mockElements;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <button id="recordBtn">
        <span class="btn-text">Start Recording</span>
      </button>
      <input id="webhookUrl" type="url" value="" />
      <div id="status">Ready to record</div>
      <div id="timer">00:00</div>
      <audio id="recordedAudio" controls></audio>
      <audio id="responseAudio" controls></audio>
      <div id="recordedStatus">No recording yet</div>
      <div id="responseStatus">No response yet</div>
      <div id="errorMessage" style="display: none;"></div>
    `;

    // Create a new instance
    app = new VoiceWebhookApp();

    // Store references to DOM elements
    mockElements = {
      recordBtn: document.getElementById('recordBtn'),
      btnText: document.querySelector('.btn-text'),
      webhookUrl: document.getElementById('webhookUrl'),
      statusDiv: document.getElementById('status'),
      timerDiv: document.getElementById('timer'),
      recordedAudio: document.getElementById('recordedAudio'),
      responseAudio: document.getElementById('responseAudio'),
      recordedStatus: document.getElementById('recordedStatus'),
      responseStatus: document.getElementById('responseStatus'),
      errorMessage: document.getElementById('errorMessage')
    };
  });

  afterEach(() => {
    if (app && app.timerInterval) {
      clearInterval(app.timerInterval);
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with correct default values', () => {
      expect(app.mediaRecorder).toBeNull();
      expect(app.audioChunks).toEqual([]);
      expect(app.isRecording).toBe(false);
      expect(app.recordingStartTime).toBeNull();
      expect(app.timerInterval).toBeNull();
    });

    test('should initialize DOM elements correctly', () => {
      expect(app.recordBtn).toBe(mockElements.recordBtn);
      expect(app.btnText).toBe(mockElements.btnText);
      expect(app.webhookUrl).toBe(mockElements.webhookUrl);
      expect(app.statusDiv).toBe(mockElements.statusDiv);
      expect(app.timerDiv).toBe(mockElements.timerDiv);
    });

    test('should attach event listeners', () => {
      const clickSpy = jest.spyOn(app, 'toggleRecording');
      mockElements.recordBtn.click();
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('Browser Support Check', () => {
    test('should return true when browser supports required APIs', () => {
      const result = app.checkBrowserSupport();
      expect(result).toBe(true);
      expect(mockElements.recordBtn.disabled).toBe(false);
    });

    test('should handle missing mediaDevices', () => {
      const originalMediaDevices = navigator.mediaDevices;
      delete navigator.mediaDevices;

      app.checkBrowserSupport();
      
      expect(mockElements.recordBtn.disabled).toBe(true);
      expect(mockElements.errorMessage.style.display).toBe('block');
      expect(mockElements.errorMessage.textContent).toContain('does not support audio recording');

      navigator.mediaDevices = originalMediaDevices;
    });

    test('should handle missing MediaRecorder', () => {
      const originalMediaRecorder = global.MediaRecorder;
      delete global.MediaRecorder;

      app.checkBrowserSupport();
      
      expect(mockElements.recordBtn.disabled).toBe(true);
      expect(mockElements.errorMessage.style.display).toBe('block');
      expect(mockElements.errorMessage.textContent).toContain('MediaRecorder is not supported');

      global.MediaRecorder = originalMediaRecorder;
    });
  });

  describe('Recording Control', () => {
    test('should start recording when toggleRecording is called', async () => {
      expect(app.isRecording).toBe(false);
      
      await app.toggleRecording();
      
      expect(app.isRecording).toBe(true);
      expect(app.mediaRecorder).toBeInstanceOf(MediaRecorder);
      expect(mockElements.btnText.textContent).toBe('Stop Recording');
      expect(mockElements.recordBtn.classList.contains('recording')).toBe(true);
    });

    test('should stop recording when toggleRecording is called while recording', async () => {
      await app.startRecording();
      expect(app.isRecording).toBe(true);
      
      app.toggleRecording();
      
      expect(app.isRecording).toBe(false);
    });

    test('should handle microphone permission denied', async () => {
      navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(
        new Error('Permission denied')
      );

      await app.startRecording();

      expect(mockElements.errorMessage.style.display).toBe('block');
      expect(mockElements.errorMessage.textContent).toContain('Error starting recording');
    });

    test('should handle NotAllowedError specifically', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(error);

      await app.startRecording();

      expect(mockElements.errorMessage.textContent).toContain('Microphone access denied');
    });
  });

  describe('Timer Functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should start timer when recording starts', async () => {
      await app.startRecording();
      
      expect(app.timerInterval).not.toBeNull();
      
      // Fast-forward time
      jest.advanceTimersByTime(5000);
      
      expect(mockElements.timerDiv.textContent).toBe('00:05');
    });

    test('should stop timer when recording stops', async () => {
      await app.startRecording();
      app.stopRecording();
      
      expect(app.timerInterval).toBeNull();
    });

    test('should format duration correctly', () => {
      expect(app.formatDuration(0)).toBe('00:00');
      expect(app.formatDuration(5000)).toBe('00:05');
      expect(app.formatDuration(65000)).toBe('01:05');
      expect(app.formatDuration(3665000)).toBe('61:05');
    });
  });

  describe('MIME Type Support', () => {
    test('should return supported MIME type', () => {
      const mimeType = app.getSupportedMimeType();
      expect(mimeType).toBe('audio/webm;codecs=opus');
    });

    test('should return file extension based on MIME type', () => {
      expect(app.getFileExtension()).toBe('webm');
    });
  });

  describe('UI State Management', () => {
    test('should update UI for recording state', () => {
      app.updateUI('recording');
      
      expect(mockElements.recordBtn.classList.contains('recording')).toBe(true);
      expect(mockElements.btnText.textContent).toBe('Stop Recording');
      expect(mockElements.recordBtn.disabled).toBe(false);
    });

    test('should update UI for processing state', () => {
      app.updateUI('processing');
      
      expect(mockElements.recordBtn.classList.contains('processing')).toBe(true);
      expect(mockElements.btnText.textContent).toBe('Processing...');
      expect(mockElements.recordBtn.disabled).toBe(true);
    });

    test('should update UI for ready state', () => {
      app.updateUI('ready');
      
      expect(mockElements.recordBtn.classList.contains('recording')).toBe(false);
      expect(mockElements.recordBtn.classList.contains('processing')).toBe(false);
      expect(mockElements.btnText.textContent).toBe('Start Recording');
      expect(mockElements.recordBtn.disabled).toBe(false);
      expect(mockElements.timerDiv.textContent).toBe('00:00');
    });

    test('should update status text', () => {
      app.updateStatus('Test status message');
      expect(mockElements.statusDiv.textContent).toBe('Test status message');
    });
  });

  describe('Error Handling', () => {
    test('should show error message', () => {
      app.showError('Test error message');
      
      expect(mockElements.errorMessage.textContent).toBe('Test error message');
      expect(mockElements.errorMessage.style.display).toBe('block');
    });

    test('should hide error message', () => {
      mockElements.errorMessage.style.display = 'block';
      app.hideError();
      
      expect(mockElements.errorMessage.style.display).toBe('none');
    });
  });

  describe('Webhook Communication', () => {
    test('should send audio to webhook with correct FormData', async () => {
      const mockBlob = new Blob(['test audio'], { type: 'audio/webm' });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        text: jest.fn().mockResolvedValue('Success')
      });

      mockElements.webhookUrl.value = 'https://example.com/webhook';
      
      await app.sendToWebhook(mockBlob);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
          headers: {
            'Accept': 'audio/*'
          }
        })
      );
    });

    test('should handle webhook HTTP errors', async () => {
      const mockBlob = new Blob(['test audio'], { type: 'audio/webm' });
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      mockElements.webhookUrl.value = 'https://example.com/webhook';
      
      await app.sendToWebhook(mockBlob);

      expect(mockElements.errorMessage.style.display).toBe('block');
      expect(mockElements.errorMessage.textContent).toContain('HTTP 500');
    });

    test('should handle network errors', async () => {
      const mockBlob = new Blob(['test audio'], { type: 'audio/webm' });
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      mockElements.webhookUrl.value = 'https://example.com/webhook';
      
      await app.sendToWebhook(mockBlob);

      expect(mockElements.errorMessage.style.display).toBe('block');
      expect(mockElements.errorMessage.textContent).toContain('Network error');
    });
  });

  describe('Audio Response Handling', () => {
    test('should play response audio automatically', async () => {
      const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
      
      await app.playResponseAudio(mockAudioBlob);

      expect(mockElements.responseAudio.src).toContain('mock-blob-url');
      expect(mockElements.responseAudio.style.display).toBe('block');
      expect(mockElements.responseStatus.textContent).toBe('Response received - playing audio...');
      expect(mockElements.responseAudio.play).toHaveBeenCalled();
    });

    test('should handle audio playback errors', async () => {
      const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
      mockElements.responseAudio.play.mockRejectedValueOnce(new Error('Playback failed'));
      
      await app.playResponseAudio(mockAudioBlob);

      expect(mockElements.errorMessage.style.display).toBe('block');
      expect(mockElements.errorMessage.textContent).toContain('Error playing response audio');
    });
  });
});