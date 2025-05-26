// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// DOM elements
const usernameInput = document.getElementById('username-input');
const signInBtn = document.getElementById('sign-in-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');
const userCount = document.getElementById('user-count');
const authContainer = document.getElementById('auth-container');

let currentUser = null;
let typingTimeout;

// Sign in anonymously with username
signInBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (username) {
    auth.signInAnonymously()
      .then(() => {
        // Username will be stored in Firestore
        currentUser = {
          uid: auth.currentUser.uid,
          username: username,
          lastActive: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Add user to Firestore
        return db.collection('users').doc(currentUser.uid).set({
          username: username,
          lastActive: firebase.firestore.FieldValue.serverTimestamp(),
          online: true
        });
      })
      .then(() => {
        authContainer.style.display = 'none';
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
      })
      .catch(error => {
        console.error("Error signing in: ", error);
      });
  }
});

// Send message
function sendMessage() {
  const messageText = messageInput.value.trim();
  if (messageText && currentUser) {
    db.collection('messages').add({
      text: messageText,
      username: currentUser.username,
      userId: currentUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      messageInput.value = '';
    })
    .catch(error => {
      console.error("Error sending message: ", error);
    });
  }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// Typing indicator
messageInput.addEventListener('input', () => {
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).update({
      typing: true,
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      db.collection('users').doc(currentUser.uid).update({
        typing: false
      });
    }, 2000);
  }
});

// Listen for messages
db.collection('messages')
  .orderBy('timestamp')
  .onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        displayMessage(change.doc.data());
      }
    });
    scrollToBottom();
  });

// Listen for typing indicators
db.collection('users')
  .where('online', '==', true)
  .onSnapshot(snapshot => {
    let typingUsers = [];
    let onlineUsers = [];
    
    snapshot.forEach(doc => {
      const user = doc.data();
      if (user.typing && user.username !== currentUser.username) {
        typingUsers.push(user.username);
      }
      if (user.online) {
        onlineUsers.push(user.username);
      }
    });
    
    // Update typing indicator
    if (typingUsers.length > 0) {
      typingIndicator.textContent = `${typingUsers.join(', ')} ${typingUsers.length > 1 ? 'are' : 'is'} typing...`;
    } else {
      typingIndicator.textContent = '';
    }
    
    // Update user count
    userCount.textContent = `${onlineUsers.length} user${onlineUsers.length !== 1 ? 's' : ''} online`;
  });

// Display a message
function displayMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  
  if (message.userId === currentUser.uid) {
    messageDiv.classList.add('outgoing');
  } else {
    messageDiv.classList.add('incoming');
  }
  
  const messageHeader = document.createElement('div');
  messageHeader.classList.add('message-header');
  
  const usernameSpan = document.createElement('span');
  usernameSpan.classList.add('username');
  usernameSpan.textContent = message.username;
  
  const timestampSpan = document.createElement('span');
  timestampSpan.classList.add('timestamp');
  timestampSpan.textContent = formatTime(message.timestamp?.toDate());
  
  messageHeader.appendChild(usernameSpan);
  messageHeader.appendChild(timestampSpan);
  
  const messageText = document.createElement('div');
  messageText.classList.add('message-text');
  messageText.textContent = message.text;
  
  messageDiv.appendChild(messageHeader);
  messageDiv.appendChild(messageText);
  
  messagesContainer.appendChild(messageDiv);
}

// Format time
function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Scroll to bottom of messages
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle user disconnect
window.addEventListener('beforeunload', () => {
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).update({
      online: false,
      typing: false
    });
  }
});
