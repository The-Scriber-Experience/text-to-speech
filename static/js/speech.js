class SpeechApp {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.voices = [];
        this.speaking = false;
        this.paused = false;

        // Get DOM elements
        this.textInput = document.getElementById('text-input');
        this.languageSelect = document.getElementById('language-select');
        this.voiceSelect = document.getElementById('voice-select');
        this.voiceFilter = document.getElementById('voice-filter');
        this.rateRange = document.getElementById('rate-range');
        this.volumeRange = document.getElementById('volume-range');
        this.pitchRange = document.getElementById('pitch-range');
        this.rateValue = document.getElementById('rate-value');
        this.volumeValue = document.getElementById('volume-value');
        this.pitchValue = document.getElementById('pitch-value');
        this.playBtn = document.getElementById('play-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.saveBtn = document.getElementById('save-btn');
        this.fileInput = document.getElementById('file-input');

        this.init();
    }

    init() {
        // Initialize voices
        this.loadVoices();
        this.synthesis.addEventListener('voiceschanged', () => this.loadVoices());

        // Initialize range values
        this.rateRange.addEventListener('input', () => {
            const value = this.rateRange.value;
            this.rateValue.textContent = `${value}x`;
        });

        this.volumeRange.addEventListener('input', () => {
            const value = this.volumeRange.value;
            this.volumeValue.textContent = `${Math.round(value * 100)}%`;
        });

        this.pitchRange.addEventListener('input', () => {
            const value = this.pitchRange.value;
            this.pitchValue.textContent = `${value}x`;
        });

        // Add voice filter change handler
        this.voiceFilter.addEventListener('change', () => {
            this.updateVoiceList();
        });

        // Add event listeners
        this.playBtn.addEventListener('click', () => this.speak());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.saveBtn.addEventListener('click', () => this.saveText());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    loadVoices() {
        this.voices = this.synthesis.getVoices();
        
        // Get unique languages
        const languages = [...new Set(this.voices.map(voice => voice.lang))];
        
        // Populate language select
        this.languageSelect.innerHTML = languages
            .map(lang => `<option value="${lang}">${lang}</option>`)
            .join('');
            
        // Update voices when language changes
        this.languageSelect.addEventListener('change', () => {
            this.updateVoiceList();
        });
        
        // Trigger initial voice load
        this.languageSelect.dispatchEvent(new Event('change'));
    }

    updateVoiceList() {
        const selectedLang = this.languageSelect.value;
        const filterType = this.voiceFilter.value;
        
        let filteredVoices = this.voices.filter(voice => voice.lang === selectedLang);
        
        // Apply voice type filter
        if (filterType !== 'all') {
            // Simple gender detection based on voice name
            filteredVoices = filteredVoices.filter(voice => {
                const name = voice.name.toLowerCase();
                if (filterType === 'male') {
                    return name.includes('male') || name.includes('david') || name.includes('james');
                } else {
                    return name.includes('female') || name.includes('zira') || name.includes('sarah');
                }
            });
        }
        
        this.voiceSelect.innerHTML = filteredVoices
            .map(voice => `<option value="${voice.name}">${voice.name}</option>`)
            .join('');
    }

    speak() {
        if (this.speaking) {
            if (this.paused) {
                this.synthesis.resume();
                this.paused = false;
            }
            return;
        }

        const text = this.textInput.value.trim();
        if (!text) {
            alert('Please enter some text to speak');
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set voice
        const selectedVoice = this.voices.find(voice => voice.name === this.voiceSelect.value);
        if (selectedVoice) utterance.voice = selectedVoice;
        
        // Set other properties
        utterance.rate = parseFloat(this.rateRange.value);
        utterance.volume = parseFloat(this.volumeRange.value);
        utterance.pitch = parseFloat(this.pitchRange.value);
        
        // Add events
        utterance.onstart = () => {
            this.speaking = true;
            this.playBtn.classList.add('disabled');
        };
        
        utterance.onend = () => {
            this.speaking = false;
            this.paused = false;
            this.playBtn.classList.remove('disabled');
        };

        this.synthesis.speak(utterance);
    }

    pause() {
        if (this.speaking) {
            this.synthesis.pause();
            this.paused = true;
        }
    }

    stop() {
        this.synthesis.cancel();
        this.speaking = false;
        this.paused = false;
        this.playBtn.classList.remove('disabled');
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.txt')) {
            alert('Please upload a .txt file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.textInput.value = e.target.result;
        };
        reader.onerror = (e) => {
            console.error('Error reading file:', e);
            alert('Error reading file');
        };
        reader.readAsText(file);
    }

    async saveText() {
        const text = this.textInput.value.trim();
        if (!text) {
            this.showAlert('Please enter some text to save', 'danger');
            return;
        }

        try {
            const response = await fetch('/save-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text }),
            });

            const data = await response.json();
            
            if (response.ok) {
                this.showAlert('Text saved successfully!', 'success');
            } else {
                throw new Error(data.error || 'Failed to save text');
            }
        } catch (error) {
            console.error('Error saving text:', error);
            this.showAlert(error.message, 'danger');
        }
    }

    showAlert(message, type) {
        // Remove any existing alerts
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        // Create new alert
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        // Insert alert inside the card body, after the button group
        const cardBody = document.querySelector('.card-body');
        const buttonGroup = document.querySelector('.d-flex.justify-content-center');
        cardBody.insertBefore(alertDiv, buttonGroup.nextSibling);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 150);
        }, 5000);
    }
}

// Check browser support
document.addEventListener('DOMContentLoaded', () => {
    if ('speechSynthesis' in window) {
        new SpeechApp();
    } else {
        alert('Sorry, your browser does not support text-to-speech functionality.');
        document.querySelectorAll('button').forEach(btn => btn.disabled = true);
    }
});
