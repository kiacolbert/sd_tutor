const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static('.'));

// Configure multer for handling audio uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'), false);
        }
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Test webhook endpoint for development
app.post('/webhook/test', upload.single('audio'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file received' });
        }

        console.log('Received audio file:', {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            timestamp: req.body.timestamp
        });

        // In a real implementation, you would:
        // 1. Process the audio (speech-to-text, AI processing, etc.)
        // 2. Generate a response
        // 3. Convert response to audio (text-to-speech)
        // 4. Return the audio response

        // For this demo, we'll return a simple audio response
        // You can replace this with actual audio processing logic
        
        // Send back a simple JSON response for now
        res.json({
            success: true,
            message: 'Audio received successfully',
            receivedFile: {
                name: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype
            },
            timestamp: new Date().toISOString()
        });

        // Uncomment below to return an audio file instead
        // const audioResponsePath = path.join(__dirname, 'sample-response.wav');
        // if (fs.existsSync(audioResponsePath)) {
        //     res.set({
        //         'Content-Type': 'audio/wav',
        //         'Content-Disposition': 'attachment; filename="response.wav"'
        //     });
        //     return res.sendFile(audioResponsePath);
        // }

    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({ error: 'Error processing audio file' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🎤 Voice Webhook Server running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`🔗 Test webhook: http://localhost:${PORT}/webhook/test`);
        console.log(`\n📝 To test the app:`);
        console.log(`   1. Open http://localhost:${PORT} in your browser`);
        console.log(`   2. Enter webhook URL: http://localhost:${PORT}/webhook/test`);
        console.log(`   3. Click "Start Recording" and allow microphone access`);
        console.log(`   4. Record your audio and see the response\n`);
    });
}

// Export app for testing
module.exports = app;