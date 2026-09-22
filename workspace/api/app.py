import os
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def hello_world():
    return jsonify(message="Hello, World!")

if __name__ == '__main__':
    # Grab the port from the environment, defaulting to 4000
    port = int(os.environ.get('PORT', 4000))
    app.run(host='0.0.0.0', port=port)