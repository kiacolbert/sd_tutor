# Voice Audio Webhook App

A simple web application that records voice audio from the user's microphone, sends it to a webhook endpoint, and plays back any audio response received.

## Features

- 🎤 **Voice Recording**: Record audio directly from your microphone
- 📡 **Webhook Integration**: Send recorded audio to any webhook endpoint
- 🔊 **Auto-play Response**: Automatically play audio responses from the webhook
- 🎨 **Modern UI**: Clean, responsive design with visual feedback
- ⚡ **Real-time Status**: Live recording timer and status updates
- 🛡️ **Error Handling**: Comprehensive error handling and user feedback

## Quick Start

### Option 1: Use with Any Webhook

1. Open `index.html` in your browser
2. Enter your webhook URL in the input field
3. Click "Start Recording" and allow microphone access
4. Record your audio and see the response

### Option 2: Run with Local Server

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open http://localhost:3000 in your browser

4. Use the test webhook URL: `http://localhost:3000/webhook/test`

### Option 3: Simple Static Server

```bash
npm run serve
```

Then open http://localhost:3000

## How It Works

1. **Recording**: Uses the Web Audio API and MediaRecorder to capture audio
2. **Webhook Communication**: Sends audio as FormData to your specified endpoint
3. **Response Handling**: Receives and auto-plays any audio response
4. **Format Support**: Supports WebM, MP4, and WAV audio formats

## Webhook Requirements

Your webhook endpoint should:

- Accept `POST` requests
- Handle `multipart/form-data` with an `audio` field
- Optionally return audio data with appropriate `Content-Type` header
- Handle CORS if serving from a different domain

### Example Webhook Response

**JSON Response:**
```json
{
  "success": true,
  "message": "Audio processed successfully"
}
```

**Audio Response:**
```http
Content-Type: audio/wav
Content-Disposition: attachment; filename="response.wav"

[audio data]
```

## Browser Requirements

- Modern browser with Web Audio API support
- HTTPS connection (required for microphone access in production)
- Microphone permissions

## Supported Audio Formats

The app automatically selects the best supported format:
1. `audio/webm;codecs=opus` (preferred)
2. `audio/webm`
3. `audio/mp4`
4. `audio/wav`

## Development

### Testing Locally

The included Node.js server provides a test webhook endpoint at `/webhook/test` that:
- Receives and logs audio file details
- Returns a JSON response with file information
- Can be modified to return actual audio responses

### Customization

- **UI Styling**: Modify `style.css` for custom appearance
- **Recording Settings**: Adjust audio constraints in `script.js`
- **Webhook Format**: Customize the FormData payload in `sendToWebhook()`

## Security Considerations

- Requires HTTPS for microphone access in production
- Implements file size limits (10MB default)
- Validates audio file types
- Includes CORS configuration for cross-origin requests

## Troubleshooting

**Microphone not working:**
- Ensure HTTPS connection
- Check browser permissions
- Verify microphone is not in use by other applications

**Webhook errors:**
- Check webhook URL is correct and accessible
- Verify CORS settings on your webhook endpoint
- Check network connectivity

**No audio playback:**
- Verify webhook returns audio with correct Content-Type
- Check browser audio playback permissions
- Ensure audio format is supported

## License

MIT License - feel free to use and modify as needed.