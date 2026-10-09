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

        // Custom Inworld voice (empty when not configured on the server)
        this.inworldVoiceName = this.voiceSelect.dataset.inworldVoice;
        this.inworldValue = '__inworld__';
        this.audio = null;
        // Walter-only controls (not rendered when Inworld isn't configured)
        this.inworldOptions = document.getElementById('inworld-options');
        this.inworldTips = document.getElementById('inworld-tips');
        this.deliverySelect = document.getElementById('delivery-select');
        this.instructionInput = document.getElementById('instruction-input');
        this.instructionReset = document.getElementById('instruction-reset');

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

        this.voiceSelect.addEventListener('change', () => this.updateVoiceControls());

        if (this.instructionReset) {
            this.instructionReset.addEventListener('click', (e) => {
                e.preventDefault();
                this.instructionInput.value = this.instructionInput.dataset.default;
            });
        }

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
        
        const previousVoice = this.voiceSelect.value;
        const options = filteredVoices
            .map(voice => `<option value="${voice.name}">${voice.name}</option>`);

        // The custom Inworld voice is listed first so it's the default
        if (this.inworldVoiceName) {
            options.unshift(`<option value="${this.inworldValue}">${this.inworldVoiceName} (Inworld)</option>`);
        }

        this.voiceSelect.innerHTML = options.join('');

        // Keep the user's choice when the list is rebuilt
        if ([...this.voiceSelect.options].some(option => option.value === previousVoice)) {
            this.voiceSelect.value = previousVoice;
        }
        this.updateVoiceControls();
    }

    updateVoiceControls() {
        const isInworld = this.voiceSelect.value === this.inworldValue;

        // Inworld has no pitch setting and only supports rates up to 1.5x
        this.pitchRange.disabled = isInworld;
        this.pitchValue.textContent = isInworld
            ? `Not available for ${this.inworldVoiceName}`
            : `${this.pitchRange.value}x`;
        this.rateRange.max = isInworld ? '1.5' : '2';
        this.rateValue.textContent = `${this.rateRange.value}x`;

        // Delivery, direction, and tag tips only apply to the Inworld voice
        this.inworldOptions?.classList.toggle('d-none', !isInworld);
        this.inworldTips?.classList.toggle('d-none', !isInworld);
    }

    speak() {
        if (this.speaking) {
            if (this.paused) {
                if (this.audio) {
                    this.audio.play();
                } else {
                    this.synthesis.resume();
                }
                this.paused = false;
            }
            return;
        }

        const text = this.textInput.value.trim();
        if (!text) {
            alert('Please enter some text to speak');
            return;
        }

        if (this.voiceSelect.value === this.inworldValue) {
            this.speakInworld(text);
            return;
        }

        const selectedVoice = this.voices.find(voice => voice.name === this.voiceSelect.value);
        this.speakBrowser(text, selectedVoice);
    }

    // Remove Inworld markup ([tags], <break/>, <lang>, *emphasis*) so browser voices don't read it aloud
    stripMarkup(text) {
        return text
            .replace(/\[[^\[\]]*\]/g, ' ')
            .replace(/<[^<>]+>/g, ' ')
            .replace(/\*/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    speakBrowser(text, voice) {
        const utterance = new SpeechSynthesisUtterance(this.stripMarkup(text));

        // Set voice
        if (voice) utterance.voice = voice;
        
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

    async speakInworld(text) {
        this.speaking = true;
        this.playBtn.classList.add('disabled');

        try {
            const response = await fetch('/synthesize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    rate: parseFloat(this.rateRange.value),
                    delivery_mode: this.deliverySelect.value,
                    instruction: this.instructionInput.value,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to generate speech');
            }

            // Stop was pressed while the request was in flight
            if (!this.speaking) return;

            // The server streams the audio, so playback starts while the rest is still generating
            const { audioUrl } = await response.json();
            this.audio = new Audio(audioUrl);
            this.audio.volume = parseFloat(this.volumeRange.value);
            this.audio.onended = () => this.stop();
            this.audio.onerror = () => this.fallbackToBrowserVoice(text);
            // Playback failures are handled by onerror
            this.audio.play().catch(() => {});
        } catch (error) {
            console.error('Error generating speech:', error);
            this.showAlert(error.message, 'danger');
            this.stop();
        }
    }

    fallbackToBrowserVoice(text) {
        // Ignore errors from audio that was already stopped
        if (!this.audio) return;

        this.stop();
        this.showAlert('Your Inworld voice is unavailable right now (you may be out of free credits), so a built-in voice is reading instead.', 'warning');
        const voice = this.voices.find(voice => voice.lang === this.languageSelect.value);
        this.speakBrowser(text, voice);
    }

    pause() {
        if (this.speaking) {
            if (this.audio) {
                this.audio.pause();
            } else {
                this.synthesis.pause();
            }
            this.paused = true;
        }
    }

    stop() {
        if (this.audio) {
            // Clearing the source also cancels the download so Inworld stops generating
            this.audio.onerror = null;
            this.audio.pause();
            this.audio.removeAttribute('src');
            this.audio.load();
            this.audio = null;
        }
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
