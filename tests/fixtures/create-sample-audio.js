// Utility to create sample audio files for testing
const fs = require('fs');
const path = require('path');

// Create a simple WAV file header for testing
function createWAVHeader(dataLength) {
  const buffer = Buffer.alloc(44);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20);  // audio format (PCM)
  buffer.writeUInt16LE(1, 22);  // num channels
  buffer.writeUInt32LE(44100, 24); // sample rate
  buffer.writeUInt32LE(88200, 28); // byte rate
  buffer.writeUInt16LE(2, 32);  // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  
  return buffer;
}

// Create sample audio files
function createSampleAudioFiles() {
  const fixturesDir = __dirname;
  
  // Create a small WAV file (1 second of silence at 44.1kHz, 16-bit, mono)
  const sampleRate = 44100;
  const duration = 1; // 1 second
  const dataLength = sampleRate * duration * 2; // 2 bytes per sample
  
  const header = createWAVHeader(dataLength);
  const audioData = Buffer.alloc(dataLength, 0); // silence
  
  const wavFile = Buffer.concat([header, audioData]);
  fs.writeFileSync(path.join(fixturesDir, 'sample-audio.wav'), wavFile);
  
  // Create a WebM file placeholder (just a minimal WebM container)
  const webmData = Buffer.from([
    0x1A, 0x45, 0xDF, 0xA3, // EBML header
    0x9F, 0x42, 0x86, 0x81, 0x01, // DocType: webm
    0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6D // webm
  ]);
  fs.writeFileSync(path.join(fixturesDir, 'sample-audio.webm'), webmData);
  
  // Create a text file for testing non-audio uploads
  fs.writeFileSync(path.join(fixturesDir, 'not-audio.txt'), 'This is not an audio file');
  
  console.log('Sample audio files created in:', fixturesDir);
}

// Export for use in tests
module.exports = {
  createWAVHeader,
  createSampleAudioFiles
};

// Run if called directly
if (require.main === module) {
  createSampleAudioFiles();
}