# Text to Speech Converter

A live Flask application that converts text to speech using **Walter Jr.**, a custom AI voice made with [Inworld TTS](https://inworld.ai/), with the browser's native Speech Synthesis API as a free fallback.

## Features
- **Walter Jr.** as the default voice, streamed from Inworld so playback starts quickly, even for long text.
- No length limit: long text is split at sentence breaks and played back in order.
- Generated audio is cached, so replaying the same text doesn't use Inworld credits.
- Automatic fallback to a built-in browser voice if Inworld is unavailable (e.g., out of credits).
- Text-to-speech conversion with customizable voice, rate, pitch, and volume.
- Support for multiple languages (browser-dependent).
- File upload for `.txt` files.
- Option to save text locally on the server.
- Responsive design with dark/light mode.

## Local Setup

This project uses [uv](https://docs.astral.sh/uv/) to manage Python and dependencies.

1. **Install uv** (if you don't have it):
   ```bash
   # macOS / Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   # Windows (PowerShell)
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

2. **Install Dependencies:**
   ```bash
   uv sync
   ```
   This downloads Python 3.11 if needed (pinned in `.python-version`), creates a `.venv`, and installs the exact versions in `uv.lock`.

3. **Set your Inworld API key** (from the API Keys page in the [Inworld Portal](https://platform.inworld.ai/)). Copy `.env.example` to `.env` and paste the Base64 key as-is:
   ```bash
   cp .env.example .env
   ```
   ```
   INWORLD_API_KEY=your-base64-key
   ```
   `.env` is ignored by git, so your key stays private. The app loads it on startup; real environment variables (like the ones set on Render) take priority.
   Without a key, Walter Jr. is hidden and the app uses browser voices only.

4. **Run the App:**
   ```bash
   uv run app.py
   ```
   The app will be available at `http://localhost:5000`.

### Managing Dependencies

```bash
uv add <package>      # add a dependency
uv remove <package>   # remove a dependency
uv lock --upgrade     # upgrade locked versions
```

Commit both `pyproject.toml` and `uv.lock` after changing dependencies.

### Walter Jr. Voice Settings

These environment variables are optional (set them in `.env` or your environment); the defaults are set in `app.py`.

| Variable | Default | Description |
|---|---|---|
| `INWORLD_VOICE_ID` | Walter Jr.'s voice ID | Voice ID copied from the Inworld TTS Playground |
| `INWORLD_VOICE_NAME` | `Walter Jr.` | Name shown in the Voice dropdown |
| `INWORLD_MODEL_ID` | `inworld-tts-2` | Inworld TTS model |
| `INWORLD_DELIVERY_MODE` | `STABLE` | Default delivery: `STABLE`, `BALANCED`, or `CREATIVE`. Stable sounds most like Walter Jr. |
| `INWORLD_INSTRUCTION` | *(empty)* | Optional default Character Direction sent with every request ([steering](https://docs.inworld.ai/tts/capabilities/steering.md)). Leave empty to keep Walter Jr.'s natural voice; see `.env.example` for a personality example. |

Walter Jr. supports speech rates from 0.5x to 1.5x. Inworld has no pitch setting, so the Pitch slider is disabled while Walter Jr. is selected.

When Walter Jr. is selected, the page also shows:
- **Delivery:** Creative (most expressive), Balanced, or Stable (most consistent).
- **Character Direction:** Optional plain-English note on how he should perform, like directing an actor. Blank by default, which keeps his natural voice.
- **Tags in the text:** Sounds like `[laugh]` or `[sigh]`, style changes like `[whisper]` that last until `[reset]`, and CAPS for emphasis. Browser voices skip these tags instead of reading them aloud.

Inworld's free plan includes roughly 70 minutes (~70,000 characters) of audio per month; see [Inworld pricing](https://inworld.ai/pricing).

## Live Deployment (Render)

This project is configured for deployment on [Render](https://render.com/) without Docker.

1. **Create a Render Account:** Sign up at [render.com](https://render.com/).
2. **New Web Service:** Select "New" > "Web Service".
3. **Connect Repository:** Connect your GitHub/GitLab repository.
4. **Configuration:**
   - **Runtime:** `Python 3`
   - **Build Command:** `uv sync --frozen`
   - **Start Command:** `uv run --frozen gunicorn --threads 4 --timeout 120 app:app` (threads let long audio stream without blocking the app)

   Render adds uv automatically because `uv.lock` is in the repo, and reads the Python version from `.python-version`.
5. **Environment Variables:**
   - Add `FLASK_SECRET_KEY` (you can generate a random string).
   - Add `INWORLD_API_KEY` (your Inworld Base64 API key).
6. **Persistence (Optional):**
   - If you want to keep saved text files and cached Walter Jr. audio across redeploys, go to **Disk** in Render settings and add a disk:
     - **Name:** `saves-data`
     - **Mount Path:** `/opt/render/project/src/saves`
     - **Size:** `1GB`

## Project Structure
- `app.py`: App entry point, Flask initialization, and API endpoints (including the Inworld streaming proxy).
- `saves/audio_cache/`: Cached Walter Jr. audio (created automatically, not committed).
- `templates/`: HTML templates (using Jinja2).
- `static/`: CSS and JavaScript files.
- `pyproject.toml` / `uv.lock`: Project dependencies and their locked versions (managed by uv).
- `.python-version`: Python version used by uv and Render.
- `.env.example`: Template for your local `.env` file (API key and optional voice settings).
- `render.yaml`: Infrastructure-as-code configuration for Render.
