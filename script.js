class VoiceWebhookApp {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.timerInterval = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.checkBrowserSupport();
    }
    
    initializeElements() {
        console.log('🔍 DEBUG: Initializing DOM elements...');
        
        this.recordBtn = document.getElementById('recordBtn');
        this.btnText = this.recordBtn.querySelector('.btn-text');
        this.webhookUrl = document.getElementById('webhookUrl');
        this.statusDiv = document.getElementById('status');
        this.timerDiv = document.getElementById('timer');
        this.recordedAudio = document.getElementById('recordedAudio');
        this.responseAudio = document.getElementById('responseAudio');
        this.recordedStatus = document.getElementById('recordedStatus');
        this.responseStatus = document.getElementById('responseStatus');
        this.errorMessage = document.getElementById('errorMessage');
        
        console.log('🔍 DEBUG: DOM elements initialized:', {
            recordBtn: !!this.recordBtn,
            btnText: !!this.btnText,
            webhookUrl: !!this.webhookUrl,
            statusDiv: !!this.statusDiv,
            timerDiv: !!this.timerDiv,
            recordedAudio: !!this.recordedAudio,
            responseAudio: !!this.responseAudio,
            recordedStatus: !!this.recordedStatus,
            responseStatus: !!this.responseStatus,
            errorMessage: !!this.errorMessage
        });
    }
    
    attachEventListeners() {
        console.log('🔍 DEBUG: Attaching event listeners...');
        this.recordBtn.addEventListener('click', () => {
            console.log('🔍 DEBUG: Record button clicked');
            this.toggleRecording();
        });
        console.log('🔍 DEBUG: Event listeners attached');
    }
    
    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Your browser does not support audio recording. Please use a modern browser.');
            this.recordBtn.disabled = true;
            return false;
        }
        
        if (!window.MediaRecorder) {
            this.showError('MediaRecorder is not supported in your browser.');
            this.recordBtn.disabled = true;
            return false;
        }
        
        return true;
    }
    
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        try {
            this.hideError();
            this.updateStatus('Requesting microphone access...');
            
            console.log('🔍 DEBUG: Starting recording...');
            console.log('🔍 DEBUG: Requesting microphone access with constraints:', {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            });
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });
            
            console.log('🔍 DEBUG: Microphone access granted');
            console.log('🔍 DEBUG: Stream tracks:', stream.getTracks().map(track => ({
                kind: track.kind,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState
            })));
            
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: this.getSupportedMimeType()
            });
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log('🔍 DEBUG: Audio chunk received:', event.data.size, 'bytes');
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                console.log('🔍 DEBUG: Recording stopped, processing...');
                console.log('🔍 DEBUG: Total audio chunks:', this.audioChunks.length);
                console.log('🔍 DEBUG: Total audio data size:', this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0), 'bytes');
                this.processRecording();
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            this.updateUI('recording');
            this.startTimer();
            
        } catch (error) {
            console.error('Error starting recording:', error);
            if (error.name === 'NotAllowedError') {
                this.showError('Microphone access denied. Please allow microphone access and try again.');
            } else {
                this.showError('Error starting recording: ' + error.message);
            }
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.stopTimer();
            this.updateUI('processing');
        }
    }
    
    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/wav'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        
        return '';
    }
    
    async processRecording() {
        try {
            console.log('🔍 DEBUG: Processing recording...');
            const audioBlob = new Blob(this.audioChunks, { type: this.getSupportedMimeType() });
            console.log('🔍 DEBUG: Created audio blob:', audioBlob.size, 'bytes, type:', audioBlob.type);
            
            // Display recorded audio
            const audioUrl = URL.createObjectURL(audioBlob);
            this.recordedAudio.src = audioUrl;
            this.recordedAudio.style.display = 'block';
            this.recordedStatus.textContent = `Recorded ${this.formatDuration(this.getRecordingDuration())}`;
            
            // Send to webhook if URL is provided
            const webhookUrlValue = this.webhookUrl.value.trim();
            console.log('🔍 DEBUG: Webhook URL value:', webhookUrlValue);
            
            if (webhookUrlValue) {
                console.log('🔍 DEBUG: Webhook URL provided, sending audio...');
                await this.sendToWebhook(audioBlob);
            } else {
                console.log('🔍 DEBUG: No webhook URL provided');
                this.updateStatus('Recording complete. Enter webhook URL to send audio.');
                this.updateUI('ready');
            }
            
        } catch (error) {
            console.error('Error processing recording:', error);
            this.showError('Error processing recording: ' + error.message);
            this.updateUI('ready');
        }
    }
    
    async sendToWebhook(audioBlob) {
        try {
            this.updateStatus('Sending audio to webhook...');
            
            const formData = new FormData();
            formData.append('voice_message', audioBlob, 'recording.' + this.getFileExtension());
            formData.append('timestamp', new Date().toISOString());
            
            // Debug logging
            console.log('🔍 DEBUG: Sending audio to webhook');
            console.log('🔍 DEBUG: Webhook URL:', this.webhookUrl.value.trim());
            console.log('🔍 DEBUG: Audio blob size:', audioBlob.size, 'bytes');
            console.log('🔍 DEBUG: Audio blob type:', audioBlob.type);
            console.log('🔍 DEBUG: FormData entries:');
            for (let [key, value] of formData.entries()) {
                console.log('  -', key, ':', value instanceof Blob ? `Blob(${value.size} bytes, ${value.type})` : value);
            }
            
            const response = await fetch(this.webhookUrl.value.trim(), {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'audio/*, application/json, text/plain'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Debug logging for response
            console.log('🔍 DEBUG: Response received');
            console.log('🔍 DEBUG: Response status:', response.status);
            console.log('🔍 DEBUG: Response headers:');
            for (let [key, value] of response.headers.entries()) {
                console.log('  -', key, ':', value);
            }
            
            const contentType = response.headers.get('content-type');
            console.log('🔍 DEBUG: Content-Type:', contentType);
            
            if (contentType && contentType.startsWith('audio/')) {
                console.log('🔍 DEBUG: Processing audio response');
                const responseBlob = await response.blob();
                console.log('🔍 DEBUG: Response blob size:', responseBlob.size, 'bytes');
                console.log('🔍 DEBUG: Response blob type:', responseBlob.type);
                await this.playResponseAudio(responseBlob);
            } else {
                console.log('🔍 DEBUG: Processing text response');
                const responseText = await response.text();
                console.log('🔍 DEBUG: Response text:', responseText);
                this.updateStatus('Audio sent successfully. Response: ' + responseText);
            }
            
            this.updateUI('ready');
            
        } catch (error) {
            console.error('Error sending to webhook:', error);
            this.showError('Error sending to webhook: ' + error.message);
            this.updateUI('ready');
        }
    }
    
    async playResponseAudio(audioBlob) {
        try {
            console.log('🔍 DEBUG: Playing response audio');
            console.log('🔍 DEBUG: Audio blob size:', audioBlob.size, 'bytes');
            console.log('🔍 DEBUG: Audio blob type:', audioBlob.type);
            
            const audioUrl = URL.createObjectURL(audioBlob);
            console.log('🔍 DEBUG: Created audio URL:', audioUrl);
            
            this.responseAudio.src = audioUrl;
            this.responseAudio.style.display = 'block';
            this.responseStatus.textContent = 'Response received - playing audio...';
            
            // Add event listeners for audio loading
            this.responseAudio.onloadeddata = () => {
                console.log('🔍 DEBUG: Audio data loaded successfully');
            };
            
            this.responseAudio.onloadstart = () => {
                console.log('🔍 DEBUG: Audio loading started');
            };
            
            this.responseAudio.oncanplay = () => {
                console.log('🔍 DEBUG: Audio can start playing');
            };
            
            console.log('🔍 DEBUG: Attempting to play audio...');
            // Auto-play the response
            try {
                await this.responseAudio.play();
                console.log('🔍 DEBUG: Audio playback started successfully');
                this.updateStatus('Response audio playing');
            } catch (playError) {
                console.log('🔍 DEBUG: Autoplay failed, user interaction required:', playError.message);
                this.updateStatus('Response received - click play button to hear audio');
                this.responseStatus.textContent = 'Response received - click to play';
            }
            
            this.responseAudio.onended = () => {
                console.log('🔍 DEBUG: Audio playback ended');
                this.updateStatus('Ready to record');
                this.responseStatus.textContent = 'Response played';
            };
            
            this.responseAudio.onerror = (error) => {
                console.error('🔍 DEBUG: Audio playback error:', error);
                this.showError('Error playing response audio');
                this.responseStatus.textContent = 'Response received but could not play';
            };
            
        } catch (error) {
            console.error('🔍 DEBUG: Error playing response audio:', error);
            this.showError('Error playing response audio: ' + error.message);
            this.responseStatus.textContent = 'Response received but could not play';
        }
    }
    
    getFileExtension() {
        const mimeType = this.getSupportedMimeType();
        if (mimeType.includes('webm')) return 'webm';
        if (mimeType.includes('mp4')) return 'mp4';
        if (mimeType.includes('wav')) return 'wav';
        return 'audio';
    }
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            const duration = this.getRecordingDuration();
            this.timerDiv.textContent = this.formatDuration(duration);
        }, 100);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    getRecordingDuration() {
        return this.recordingStartTime ? Date.now() - this.recordingStartTime : 0;
    }
    
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    updateUI(state) {
        this.recordBtn.classList.remove('recording', 'processing');
        
        switch (state) {
            case 'recording':
                this.recordBtn.classList.add('recording');
                this.btnText.textContent = 'Stop Recording';
                break;
            case 'processing':
                this.recordBtn.classList.add('processing');
                this.btnText.textContent = 'Processing...';
                this.recordBtn.disabled = true;
                break;
            case 'ready':
                this.btnText.textContent = 'Start Recording';
                this.recordBtn.disabled = false;
                this.timerDiv.textContent = '00:00';
                break;
        }
    }
    
    updateStatus(message) {
        this.statusDiv.textContent = message;
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
    }
    
    hideError() {
        this.errorMessage.style.display = 'none';
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceWebhookApp;
}

// Initialize the app when the page loads (only in browser)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🔍 DEBUG: DOM loaded, initializing VoiceWebhookApp...');
        try {
            new VoiceWebhookApp();
            console.log('🔍 DEBUG: VoiceWebhookApp initialized successfully');
        } catch (error) {
            console.error('🔍 DEBUG: Error initializing VoiceWebhookApp:', error);
        }
    });
}