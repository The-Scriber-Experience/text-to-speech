import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'your-secret-key-goes-here')

@app.route('/')
def index():
    return render_template('index.html')

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
