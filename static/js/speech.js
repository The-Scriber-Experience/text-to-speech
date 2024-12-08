class SpeechApp {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.speaking = false;
        this.paused = false;

        // DOM Elements
        this.textInput = document.getElementById('text-input');
        this.languageSelect = document.getElementById('language-select');
        this.voiceSelect = document.getElementById('voice-select');
        this.rateRange = document.getElementById('rate-range');
        this.volumeRange = document.getElementById('volume-range');
        this.rateValue = document.getElementById('rate-value');
        this.volumeValue = document.getElementById('volume-value');
        this.playBtn = document.getElementById('play-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.stopBtn = document.getElementById('stop-btn');

        this.init();
    }

    init() {
        // Initialize voices
        this.loadVoices();
        this.synth.addEventListener('voiceschanged', () => this.loadVoices());

        // Event listeners
        this.rateRange.addEventListener('input', () => {
            this.rateValue.textContent = `${this.rateRange.value}x`;
        });

        this.volumeRange.addEventListener('input', () => {
            this.volumeValue.textContent = `${Math.round(this.volumeRange.value * 100)}%`;
        });

        this.languageSelect.addEventListener('change', () => this.updateVoices());

        this.playBtn.addEventListener('click', () => this.speak());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.stopBtn.addEventListener('click', () => this.stop());
    }

    loadVoices() {
        this.voices = this.synth.getVoices();
        
        // Get unique languages
        const languages = [...new Set(this.voices.map(voice => voice.lang))];
        
        // Populate language select
        this.languageSelect.innerHTML = languages
            .map(lang => `<option value="${lang}">${new Intl.DisplayNames(['en'], {type: 'language'}).of(lang.split('-')[0])}</option>`)
            .join('');

        this.updateVoices();
    }

    updateVoices() {
        const selectedLang = this.languageSelect.value;
        const filteredVoices = this.voices.filter(voice => voice.lang === selectedLang);

        this.voiceSelect.innerHTML = filteredVoices
            .map(voice => `<option value="${voice.name}">${voice.name}</option>`)
            .join('');
    }

    speak() {
        if (this.speaking && !this.paused) return;

        if (this.paused) {
            this.synth.resume();
            this.paused = false;
            return;
        }

        const text = this.textInput.value.trim();
        if (!text) return;

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set speech properties
        utterance.voice = this.voices.find(voice => voice.name === this.voiceSelect.value);
        utterance.rate = parseFloat(this.rateRange.value);
        utterance.volume = parseFloat(this.volumeRange.value);

        utterance.onstart = () => {
            this.speaking = true;
            this.playBtn.classList.add('disabled');
        };

        utterance.onend = () => {
            this.speaking = false;
            this.paused = false;
            this.playBtn.classList.remove('disabled');
        };

        this.synth.speak(utterance);
    }

    pause() {
        if (this.speaking) {
            if (this.paused) {
                this.synth.resume();
                this.paused = false;
            } else {
                this.synth.pause();
                this.paused = true;
            }
        }
    }

    stop() {
        this.synth.cancel();
        this.speaking = false;
        this.paused = false;
        this.playBtn.classList.remove('disabled');
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
