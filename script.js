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
    }
    
    attachEventListeners() {
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
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
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });
            
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: this.getSupportedMimeType()
            });
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
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
            const audioBlob = new Blob(this.audioChunks, { type: this.getSupportedMimeType() });
            
            // Display recorded audio
            const audioUrl = URL.createObjectURL(audioBlob);
            this.recordedAudio.src = audioUrl;
            this.recordedAudio.style.display = 'block';
            this.recordedStatus.textContent = `Recorded ${this.formatDuration(this.getRecordingDuration())}`;
            
            // Send to webhook if URL is provided
            const webhookUrlValue = this.webhookUrl.value.trim();
            if (webhookUrlValue) {
                await this.sendToWebhook(audioBlob);
            } else {
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
            formData.append('audio', audioBlob, 'recording.' + this.getFileExtension());
            formData.append('timestamp', new Date().toISOString());
            
            const response = await fetch(this.webhookUrl.value.trim(), {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'audio/*'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('audio/')) {
                const responseBlob = await response.blob();
                await this.playResponseAudio(responseBlob);
            } else {
                const responseText = await response.text();
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
            const audioUrl = URL.createObjectURL(audioBlob);
            this.responseAudio.src = audioUrl;
            this.responseAudio.style.display = 'block';
            this.responseStatus.textContent = 'Response received - playing audio...';
            
            // Auto-play the response
            await this.responseAudio.play();
            this.updateStatus('Response audio playing');
            
            this.responseAudio.onended = () => {
                this.updateStatus('Ready to record');
                this.responseStatus.textContent = 'Response played';
            };
            
        } catch (error) {
            console.error('Error playing response audio:', error);
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
        new VoiceWebhookApp();
    });
}