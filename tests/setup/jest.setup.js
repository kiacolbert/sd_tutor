// Global test setup and mocks

// Add Node.js globals for backend tests
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock Web Audio APIs
global.MediaRecorder = class MockMediaRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
    this.onstart = null;
    this.chunks = [];
  }

  start(timeslice) {
    this.state = 'recording';
    if (this.onstart) this.onstart();
    
    // Simulate data availability
    setTimeout(() => {
      if (this.ondataavailable) {
        const mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
        this.ondataavailable({ data: mockBlob });
      }
    }, 100);
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) this.onstop();
  }

  static isTypeSupported(type) {
    const supportedTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ];
    return supportedTypes.includes(type);
  }
};

// Mock getUserMedia
global.navigator.mediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue({
    getTracks: () => [{
      stop: jest.fn()
    }]
  })
};

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = jest.fn();

// Mock fetch
global.fetch = jest.fn();

// Mock audio element
global.HTMLAudioElement.prototype.play = jest.fn().mockResolvedValue();
global.HTMLAudioElement.prototype.pause = jest.fn();

// Mock DOM methods
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000'
  },
  writable: true
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});