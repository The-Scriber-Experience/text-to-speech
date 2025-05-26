from flask import Flask
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'your-secret-key-goes-here')

# Import routes after app initialization to avoid circular imports
from routes import *
