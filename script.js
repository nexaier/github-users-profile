// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCwJSfAGzFc28lUpLhQCG25ybwEwyMyBP0",
  authDomain: "chat-dc33d.firebaseapp.com",
  projectId: "chat-dc33d",
  storageBucket: "chat-dc33d.firebasestorage.app",
  messagingSenderId: "463651786662",
  appId: "1:463651786662:web:13f496299367af73da8967"
};

// Debug flag - set to false in production
const DEBUG_MODE = true;

function debugLog(message, data = null) {
  if (DEBUG_MODE) {
    console.log(`[DEBUG] ${message}`, data || '');
  }
}

function showError(message) {
  alert(`Error: ${message}`);
  debugLog(`User shown error: ${message}`);
}

try {
  // Initialize Firebase
  debugLog("Initializing Firebase...");
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();
  debugLog("Firebase initialized successfully");
} catch (error) {
  showError("Failed to initialize Firebase");
  console.error("Firebase initialization error:", error);
}

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
signInBtn.addEventListener('click', async () => {
  const username = usernameInput.value.trim();
  
  if (!username) {
    showError("Please enter a username");
    return;
  }

  debugLog("Attempting to sign in...", { username });
  
  try {
    // Disable button during sign-in to prevent multiple clicks
    signInBtn.disabled = true;
    signInBtn.textContent = "Signing in...";
    
    const userCredential = await auth.signInAnonymously();
    debugLog("Anonymous authentication successful", { uid: userCredential.user.uid });
    
    currentUser = {
      uid: userCredential.user.uid,
      username: username,
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    debugLog("Storing user data in Firestore...", currentUser);
    
    await db.collection('users').doc(currentUser.uid).set({
      username: username,
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
      online: true,
      typing: false
    });
    
    debugLog("User data stored successfully");
    
    authContainer.style.display = 'none';
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
    
    debugLog("User signed in and UI updated");
    
  } catch (error) {
    console.error("Sign in error:", error);
    showError("Failed to sign in. Please try again.");
    
    // Re-enable button if there was an error
    signInBtn.disabled = false;
    signInBtn.textContent = "Join Chat";
  }
});

// Send message
async function sendMessage() {
  const messageText = messageInput.value.trim();
  
  if (!messageText) {
    debugLog("Attempt to send empty message blocked");
    return;
  }
  
  if (!currentUser) {
    showError("You need to sign in first");
    return;
  }

  debugLog("Sending message...", { text: messageText });
  
  try {
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";
    
    await db.collection('messages').add({
      text: messageText,
      username: currentUser.username,
      userId: currentUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    debugLog("Message sent successfully");
    messageInput.value = '';
    
  } catch (error) {
    console.error("Message send error:", error);
    showError("Failed to send message. Please try again.");
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
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
  if (!currentUser) return;

  debugLog("User typing detected");
  
  try {
    db.collection('users').doc(currentUser.uid).update({
      typing: true,
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      debugLog("User stopped typing");
      db.collection('users').doc(currentUser.uid).update({
        typing: false
      }).catch(error => {
        console.error("Error updating typing status:", error);
      });
    }, 2000);
  } catch (error) {
    console.error("Typing indicator error:", error);
  }
});

// Listen for messages
try {
  debugLog("Setting up message listener...");
  
  db.collection('messages')
    .orderBy('timestamp')
    .onSnapshot(
      snapshot => {
        debugLog("New message snapshot received", { count: snapshot.docChanges().length });
        
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            debugLog("New message added", change.doc.data());
            displayMessage(change.doc.data());
          }
        });
        scrollToBottom();
      },
      error => {
        console.error("Message listener error:", error);
        showError("Connection to messages lost. Please refresh the page.");
      }
    );
} catch (error) {
  console.error("Error setting up message listener:", error);
  showError("Failed to set up message listener");
}

// Listen for typing indicators and online users
try {
  debugLog("Setting up user status listener...");
  
  db.collection('users')
    .where('online', '==', true)
    .onSnapshot(
      snapshot => {
        debugLog("User status update received", { count: snapshot.size });
        
        let typingUsers = [];
        let onlineUsers = [];
        
        snapshot.forEach(doc => {
          const user = doc.data();
          if (user.typing && user.username !== currentUser?.username) {
            typingUsers.push(user.username);
          }
          if (user.online) {
            onlineUsers.push(user.username);
          }
        });
        
        // Update typing indicator
        if (typingUsers.length > 0) {
          const typingText = `${typingUsers.join(', ')} ${typingUsers.length > 1 ? 'are' : 'is'} typing...`;
          typingIndicator.textContent = typingText;
          debugLog("Typing indicator updated", { text: typingText });
        } else {
          typingIndicator.textContent = '';
        }
        
        // Update user count
        const userCountText = `${onlineUsers.length} user${onlineUsers.length !== 1 ? 's' : ''} online`;
        userCount.textContent = userCountText;
        debugLog("User count updated", { count: onlineUsers.length });
      },
      error => {
        console.error("User status listener error:", error);
        showError("Connection to user status lost. Some features may not work.");
      }
    );
} catch (error) {
  console.error("Error setting up user status listener:", error);
}

// Display a message
function displayMessage(message) {
  try {
    debugLog("Displaying message", message);
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    
    if (message.userId === currentUser?.uid) {
      messageDiv.classList.add('outgoing');
      debugLog("Outgoing message detected");
    } else {
      messageDiv.classList.add('incoming');
      debugLog("Incoming message detected");
    }
    
    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');
    
    const usernameSpan = document.createElement('span');
    usernameSpan.classList.add('username');
    usernameSpan.textContent = message.username;
    
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('timestamp');
    const timestamp = formatTime(message.timestamp?.toDate());
    timestampSpan.textContent = timestamp;
    
    messageHeader.appendChild(usernameSpan);
    messageHeader.appendChild(timestampSpan);
    
    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    messageText.textContent = message.text;
    
    messageDiv.appendChild(messageHeader);
    messageDiv.appendChild(messageText);
    
    messagesContainer.appendChild(messageDiv);
    
    debugLog("Message displayed in UI");
  } catch (error) {
    console.error("Message display error:", error);
    showError("Failed to display a message. Please refresh the page.");
  }
}

// Format time
function formatTime(date) {
  try {
    if (!date) {
      debugLog("Invalid date received for formatting");
      return '';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error("Time formatting error:", error);
    return '';
  }
}

// Scroll to bottom of messages
function scrollToBottom() {
  try {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    debugLog("Scrolled to bottom of messages");
  } catch (error) {
    console.error("Scroll error:", error);
  }
}

// Handle user disconnect
window.addEventListener('beforeunload', async () => {
  if (currentUser) {
    debugLog("User leaving - updating status to offline");
    
    try {
      await db.collection('users').doc(currentUser.uid).update({
        online: false,
        typing: false
      });
      debugLog("User status updated to offline successfully");
    } catch (error) {
      console.error("Error updating user status on exit:", error);
    }
  }
});

// Handle authentication state changes
auth.onAuthStateChanged(user => {
  if (user) {
    debugLog("Auth state changed - user signed in", { uid: user.uid });
  } else {
    debugLog("Auth state changed - user signed out");
  }
});

// Initial debug log
debugLog("Chat application initialized");
