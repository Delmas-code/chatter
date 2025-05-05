from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_bcrypt import Bcrypt
from pymongo import MongoClient
import os
import json
from bson import ObjectId
from dotenv import load_dotenv
from datetime import datetime, timezone
import re

# Load environment variables
load_dotenv()

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)


# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key')
app.json_encoder = CustomJSONEncoder

# Initialize extensions
socketio = SocketIO(app, cors_allowed_origins="*")
bcrypt = Bcrypt(app)

# Connect to MongoDB
mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/chatter')
client = MongoClient(mongo_uri)
db = client.get_database('chatter_igl1cj') #igl1aj igl1bj igl1cj swe1aj swe1bj
users_collection = db.users
messages_collection = db.messages

# User registration route
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Validate input
    if not data or not all(key in data for key in ['username', 'email', 'password']):
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    
    username = data['username']
    email = data['email']
    password = data['password']
    
    # Validate email format
    email_regex = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    if not re.match(email_regex, email):
        return jsonify({'success': False, 'message': 'Invalid email format'}), 400
    
    # Check if username or email already exists
    if users_collection.find_one({'username': username}):
        return jsonify({'success': False, 'message': 'Username already exists'}), 400
    
    if users_collection.find_one({'email': email}):
        return jsonify({'success': False, 'message': 'Email already exists'}), 400
    
    # Hash password
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    # Create user document
    user = {
        'username': username,
        'email': email,
        'password': hashed_password,
        'created_at': datetime.now(timezone.utc)
    }
    
    # Insert user into database
    users_collection.insert_one(user)
    
    return jsonify({'success': True, 'message': 'User registered successfully'}), 201

# User login route
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not all(key in data for key in ['username', 'password']):
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    
    username = data['username']
    password = data['password']
    
    # Find user
    user = users_collection.find_one({'username': username})
    
    if not user or not bcrypt.check_password_hash(user['password'], password):
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    
    # Create session
    session['user_id'] = str(user['_id'])
    session['username'] = user['username']
    
    return jsonify({
        'success': True, 
        'message': 'Login successful',
        'user': {'username': user['username']}
    }), 200

# User logout route
@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200

# calculating unread count
def get_unread_count(user, other_user):
    return messages_collection.count_documents({
        'sender': other_user,
        'receiver': user,
        'read_at': None
    })
    
    
# Get user's conversations
@app.route('/conversations', methods=['GET'])
def get_conversations():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    current_user = session['username']
    
    # Find all unique conversations the user has participated in
    sent_messages = messages_collection.find({'sender': current_user}).distinct('receiver')
    received_messages = messages_collection.find({'receiver': current_user}).distinct('sender')    
    
    # Combine and remove duplicates
    conversations = list(set(sent_messages + received_messages))
    
    conversation_data = []
    for convo_partner in conversations:
        unread_count = get_unread_count(current_user, convo_partner)
        conversation_data.append({
            'username': convo_partner,
            'unread_count': unread_count
        })
    
    return jsonify({'success': True, 'conversations': conversation_data}), 200

# User search route
@app.route('/search', methods=['GET'])
def search_user():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    query = request.args.get('username', '')
    
    if not query:
        return jsonify({'success': False, 'message': 'No search query provided'}), 400
    
    # Find users matching the query
    users = list(users_collection.find(
        {'username': {'$regex': f'^{query}', '$options': 'i'}, 
         'username': {'$ne': session['username']}},
        {'password': 0}  # Exclude password field
    ))
    
    # Convert ObjectId to string for JSON serialization
    for user in users:
        user['_id'] = str(user['_id'])
    
    return jsonify({'success': True, 'users': users}), 200

# Get chat history
@app.route('/chat/<username>', methods=['GET'])
def get_chat_history(username):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    current_user = session['username']
    
    # Find the other user
    other_user = users_collection.find_one({'username': username})
    if not other_user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    # Get chat history
    messages = list(messages_collection.find(
        {
            '$or': [
                {'sender': current_user, 'receiver': username},
                {'sender': username, 'receiver': current_user}
            ]
        }
    ).sort('created_at', 1)) # Or 'sent_at'
    
    
    # Convert messages to JSON-serializable format
    serializable_messages = []
    for message in messages:
        serializable_messages.append({
            '_id': str(message['_id']),
            'sender': message['sender'],
            'receiver': message['receiver'],
            'content': message['content'],
            'created_at': message['created_at'].isoformat() if message.get('created_at') else None, # Or 'timestamp'
            'sent_at': message['sent_at'].isoformat() if message.get('sent_at') else None,
            'delivered_at': message['delivered_at'].isoformat() if message.get('delivered_at') else None,
            'read_at': message['read_at'].isoformat() if message.get('read_at') else None
        })
    
    return jsonify({'success': True, 'messages': serializable_messages}), 200

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    if 'username' not in session:
        return False
    
    username = session['username']
    join_room(username)
    print(f"User {username} connected")

@socketio.on('disconnect')
def handle_disconnect():
    if 'username' in session:
        username = session['username']
        leave_room(username)
        print(f"User {username} disconnected")

@socketio.on('send_message')
def handle_message(data):
    if 'username' not in session:
        return
    
    sender = session['username']
    receiver = data.get('receiver')
    content = data.get('content')
    
    if not receiver or not content:
        return
    
    # Save message to database
    timestamp = datetime.now(timezone.utc)
    
    message = {
        'sender': sender,
        'receiver': receiver,
        'content': content,
        'created_at': timestamp,
        'sent_at': timestamp,
        'delivered_at': None,
        'read_at': None
    }
    
    message_id = messages_collection.insert_one(message).inserted_id
    
    # Create a JSON-serializable version of the message for Socket.IO
    socketio_message = {
        '_id': str(message_id),
        'sender': sender,
        'receiver': receiver,
        'content': content,
        'timestamp': timestamp.isoformat()  # Convert to ISO format string
    }
    
    # Send message to receiver if online
    emit('receive_message', socketio_message, room=receiver)
    
    # Also send confirmation back to sender
    emit('message_sent', socketio_message, room=sender)

@socketio.on('message_delivered_ack')
def handle_delivery_ack(data):
    message_id = data.get('message_id')
    if not message_id:
        return
    messages_collection.update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'delivered_at': datetime.now(timezone.utc)}}
    )
    emit('message_delivered', {'message_id': message_id}, room=session['username'])

@socketio.on('read_message')
def handle_read_message(data):
    message_id = data.get('message_id')
    if not message_id:
        return
    messages_collection.update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'read_at': datetime.now(timezone.utc)}}
    )
    emit('message_read', {'message_id': message_id}, room=messages_collection.find_one({'_id': ObjectId(message_id)})['sender'])

# Home route
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    # socketio.run(app, debug=True, host='0.0.0.0', port=10000)
    socketio.run(app, debug=True, host='127.0.0.1', port=5000)