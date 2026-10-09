import base64
import hashlib
import json
import os
import re
import uuid
from datetime import datetime
from itertools import chain
import requests
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify, Response, send_file

# Load settings like INWORLD_API_KEY from a local .env file (real environment variables take priority)
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'your-secret-key-goes-here')

# Inworld TTS settings
INWORLD_STREAM_URL = 'https://api.inworld.ai/tts/v1/voice:stream'
INWORLD_API_KEY = os.environ.get('INWORLD_API_KEY')
INWORLD_VOICE_ID = os.environ.get('INWORLD_VOICE_ID', 'default-wnpgdcx-2ax-cel8fzokfa__the_trickstar')
INWORLD_VOICE_NAME = os.environ.get('INWORLD_VOICE_NAME', 'Walter Jr.')
INWORLD_MODEL_ID = os.environ.get('INWORLD_MODEL_ID', 'inworld-tts-2')
# STABLE keeps Walter Jr. sounding like himself; CREATIVE drifts toward a more generic voice
INWORLD_DELIVERY_MODE = os.environ.get('INWORLD_DELIVERY_MODE', 'STABLE')
INWORLD_DELIVERY_MODES = ('STABLE', 'BALANCED', 'CREATIVE')
# Optional performance direction sent as Inworld's `instruction` field (steering only works on inworld-tts-2).
# Empty by default: directions reshape the voice, and Walter Jr. sounds most like himself without one.
INWORLD_INSTRUCTION = os.environ.get('INWORLD_INSTRUCTION', '')
INWORLD_INSTRUCTION_MAX_CHARS = 300

# Voices shown in the dropdown. Winifred is Walter Jr.'s voice steered by a character direction,
# which turns it into a distinct female voice.
INWORLD_VOICES = {
    'walter': {
        'name': INWORLD_VOICE_NAME,
        'gender': 'male',
        'voice_id': INWORLD_VOICE_ID,
        'delivery_mode': INWORLD_DELIVERY_MODE,
        'instruction': INWORLD_INSTRUCTION,
    },
    'winifred': {
        'name': os.environ.get('WINIFRED_VOICE_NAME', 'Winifred'),
        'gender': 'female',
        'voice_id': os.environ.get('WINIFRED_VOICE_ID', INWORLD_VOICE_ID),
        'delivery_mode': os.environ.get('WINIFRED_DELIVERY_MODE', 'STABLE'),
        'instruction': os.environ.get(
            'WINIFRED_INSTRUCTION',
            'speak like a mix of smeagol from lord of the rings with sneaky raspy scheming whispers and '
            'will turner from pirates of the caribbean with earnest heroic sincerity and '
            'walter bernard jr from the office with preppy eager slightly awkward charm',
        ),
    },
}
# Streaming requests allow 4,000 UTF-16 units; leave headroom for emoji and other wide characters
INWORLD_CHUNK_CHARS = 3500

# Bracket tags that insert a sound; any other [tag] is a style instruction that stays in force until changed
NON_VERBAL_TAGS = {
    'breathe', 'sigh', 'gasp', 'pant', 'huff', 'grunt', 'groan', 'moan',
    'laugh', 'chuckle', 'giggle', 'cackle', 'snort', 'scoff',
    'cry', 'sob', 'wail', 'whimper', 'whine', 'sniffle', 'sniff', 'shriek', 'squeal', 'howl',
    'clear throat', 'cough', 'sneeze', 'hiccup', 'yawn', 'burp', 'snore', 'choke', 'gag', 'swallow', 'gulp', 'spit',
    'tongue click', 'mouth click', 'mouth sound', 'lip smack', 'kiss', 'shush', 'raspberry', 'whistle', 'bleh',
    'chew', 'slurp', 'babble', 'beatbox', 'growl',
}

# Generated audio is cached so replaying the same text doesn't use Inworld credits again
AUDIO_CACHE_DIR = os.path.join('saves', 'audio_cache')


class InworldError(Exception):
    pass


def split_text(text, max_chars=INWORLD_CHUNK_CHARS):
    """Split text into chunks of at most max_chars, breaking at sentence ends where possible."""
    pieces = []
    for sentence in re.split(r'(?<=[.!?])\s+', text):
        # Break up sentences that are too long on their own at word boundaries
        while len(sentence) > max_chars:
            cut = sentence.rfind(' ', 0, max_chars)
            if cut <= 0:
                cut = max_chars
            pieces.append(sentence[:cut])
            sentence = sentence[cut:].lstrip()
        if sentence:
            pieces.append(sentence)

    chunks = []
    for piece in pieces:
        if chunks and len(chunks[-1]) + 1 + len(piece) <= max_chars:
            chunks[-1] += ' ' + piece
        else:
            chunks.append(piece)
    return chunks


def tag_words(tag):
    """Roughly normalize a tag's words so inflections like [clears throat] or [laughing] match the base sound."""
    words = set()
    for word in re.findall(r'[a-z]+', tag.lower()):
        for suffix in ('ing', 'ed', 'es', 's', 'e'):
            if word.endswith(suffix) and not word.endswith('ss') and len(word) > len(suffix) + 2:
                word = word[:-len(suffix)]
                break
        words.add(word)
    return frozenset(words)


NON_VERBAL_WORDS = {tag_words(tag) for tag in NON_VERBAL_TAGS}


def last_instruction_tag(text):
    """Return the last style [tag] (including [reset]) in text, or '' if there is none."""
    for tag in reversed(re.findall(r'\[[^\[\]]+\]', text)):
        if tag_words(tag) not in NON_VERBAL_WORDS:
            return tag
    return ''


def stream_inworld_audio(text, speaking_rate, voice_id=INWORLD_VOICE_ID, delivery_mode=INWORLD_DELIVERY_MODE,
                         instruction=''):
    """Yield MP3 bytes from Inworld as they are generated, one text chunk at a time."""
    headers = {
        'Authorization': f'Basic {INWORLD_API_KEY}',
        'Content-Type': 'application/json',
    }

    active_tag = ''
    for chunk in split_text(text):
        # Each chunk is a separate request, so repeat the style tag in force to keep it going across chunks
        request_text = f'{active_tag} {chunk}' if active_tag else chunk
        active_tag = last_instruction_tag(chunk) or active_tag

        payload = {
            'text': request_text,
            'voice_id': voice_id,
            'model_id': INWORLD_MODEL_ID,
            'audio_config': {
                'audio_encoding': 'MP3',
                'speaking_rate': speaking_rate,
            },
            'delivery_mode': delivery_mode,
            'language': 'AUTO',
        }
        if instruction:
            payload['instruction'] = instruction

        with requests.post(INWORLD_STREAM_URL, json=payload, headers=headers, stream=True, timeout=60) as response:
            if not response.ok:
                try:
                    message = response.json().get('message')
                except ValueError:
                    message = None
                raise InworldError(message or f'Inworld request failed ({response.status_code})')

            # Each line is a JSON message holding a base64 audio chunk
            for line in response.iter_lines():
                if not line:
                    continue
                message = json.loads(line)
                if 'error' in message:
                    raise InworldError(message['error'].get('message', 'Inworld streaming failed'))
                audio_content = message.get('result', {}).get('audioContent')
                if audio_content:
                    yield base64.b64decode(audio_content)


@app.route('/')
def index():
    # Only show the custom voices when Inworld is configured (voice IDs stay on the server)
    inworld_voices = [
        {
            'key': key,
            'name': voice['name'],
            'gender': voice['gender'],
            'delivery_mode': voice['delivery_mode'],
            'instruction': voice['instruction'],
        }
        for key, voice in INWORLD_VOICES.items()
        if voice['voice_id']
    ] if INWORLD_API_KEY else []
    return render_template(
        'index.html',
        inworld_voices=inworld_voices,
        delivery_modes=INWORLD_DELIVERY_MODES,
        instruction_max_chars=INWORLD_INSTRUCTION_MAX_CHARS,
    )

@app.route('/synthesize', methods=['POST'])
def synthesize():
    if not INWORLD_API_KEY:
        return jsonify({'error': 'Inworld voice is not configured'}), 503

    try:
        data = request.get_json()
        text = data.get('text', '').strip()

        if not text:
            return jsonify({'error': 'Text is required'}), 400

        voice = INWORLD_VOICES.get(data.get('voice', 'walter'))
        if not voice or not voice['voice_id']:
            return jsonify({'error': 'Unknown voice'}), 400

        # Inworld accepts speaking rates between 0.5 and 1.5
        speaking_rate = round(min(max(float(data.get('rate', 1.0)), 0.5), 1.5), 1)

        delivery_mode = str(data.get('delivery_mode', voice['delivery_mode'])).upper()
        if delivery_mode not in INWORLD_DELIVERY_MODES:
            delivery_mode = voice['delivery_mode']

        # An empty direction is allowed and means "no instruction, just the voice itself"
        instruction = str(data.get('instruction', voice['instruction'])).strip()[:INWORLD_INSTRUCTION_MAX_CHARS]

        job = {
            'text': text,
            'rate': speaking_rate,
            'voice': voice['voice_id'],
            'model': INWORLD_MODEL_ID,
            'delivery_mode': delivery_mode,
            'instruction': instruction,
        }
        # The same text and settings always map to the same id, which is what makes caching work
        audio_id = hashlib.sha256(json.dumps(job, sort_keys=True).encode('utf-8')).hexdigest()

        os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)
        job_path = os.path.join(AUDIO_CACHE_DIR, f'{audio_id}.json')
        if not os.path.exists(job_path):
            with open(job_path, 'w', encoding='utf-8') as f:
                json.dump(job, f)

        return jsonify({'audioUrl': f'/audio/{audio_id}'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/audio/<audio_id>')
def audio(audio_id):
    if not re.fullmatch(r'[0-9a-f]{64}', audio_id):
        return jsonify({'error': 'Audio not found'}), 404

    mp3_path = os.path.join(AUDIO_CACHE_DIR, f'{audio_id}.mp3')
    if os.path.exists(mp3_path):
        return send_file(mp3_path, mimetype='audio/mpeg', conditional=True)

    job_path = os.path.join(AUDIO_CACHE_DIR, f'{audio_id}.json')
    if not os.path.exists(job_path):
        return jsonify({'error': 'Audio not found'}), 404

    with open(job_path, encoding='utf-8') as f:
        job = json.load(f)

    # Fetch the first audio chunk up front so errors (like running out of credits)
    # come back as a real error status instead of an empty audio stream
    audio_stream = stream_inworld_audio(
        job['text'],
        job['rate'],
        job['voice'],
        job.get('delivery_mode', INWORLD_DELIVERY_MODE),
        job.get('instruction', ''),
    )
    try:
        first_chunk = next(audio_stream)
    except StopIteration:
        return jsonify({'error': 'Inworld returned no audio'}), 502
    except (InworldError, requests.RequestException) as e:
        return jsonify({'error': str(e)}), 502

    def generate():
        # Write to a unique temp file and only keep it once the whole text has been generated
        part_path = f'{mp3_path}.{uuid.uuid4().hex}.part'
        complete = False
        try:
            with open(part_path, 'wb') as f:
                for chunk in chain([first_chunk], audio_stream):
                    f.write(chunk)
                    yield chunk
            complete = True
        except (InworldError, requests.RequestException) as e:
            app.logger.error('Inworld streaming stopped early: %s', e)
        finally:
            if complete:
                os.replace(part_path, mp3_path)
            elif os.path.exists(part_path):
                os.remove(part_path)

    return Response(generate(), mimetype='audio/mpeg')

@app.route('/save-text', methods=['POST'])
def save_text():
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400
            
        # Create saves directory if it doesn't exist
        if not os.path.exists('saves'):
            os.makedirs('saves')
            
        # Generate filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'saves/text_{timestamp}.txt'
        
        # Save the text
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(text)
            
        return jsonify({'message': 'Text saved successfully', 'filename': filename}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
