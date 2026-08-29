# Text to Speech Converter

A live Flask application that converts text to speech using the browser's native Speech Synthesis API.

## Features
- Text-to-speech conversion with customizable voice, rate, pitch, and volume.
- Support for multiple languages (browser-dependent).
- File upload for `.txt` files.
- Option to save text locally on the server.
- Responsive design with dark/light mode.

## Local Setup

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the App:**
   ```bash
   python app.py
   ```
   The app will be available at `http://localhost:5000`.

## Live Deployment (Render)

This project is configured for deployment on [Render](https://render.com/) without Docker.

1. **Create a Render Account:** Sign up at [render.com](https://render.com/).
2. **New Web Service:** Select "New" > "Web Service".
3. **Connect Repository:** Connect your GitHub/GitLab repository.
4. **Configuration:**
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
5. **Environment Variables:**
   - Add `FLASK_SECRET_KEY` (you can generate a random string).
   - Add `PYTHON_VERSION` (e.g., `3.11.0`).
6. **Persistence (Optional):**
   - If you want to keep saved text files across redeploys, go to **Disk** in Render settings and add a disk:
     - **Name:** `saves-data`
     - **Mount Path:** `/opt/render/project/src/saves`
     - **Size:** `1GB`

## Project Structure
- `app.py`: App entry point, Flask initialization, and API endpoints.
- `templates/`: HTML templates (using Jinja2).
- `static/`: CSS and JavaScript files.
- `render.yaml`: Infrastructure-as-code configuration for Render.
