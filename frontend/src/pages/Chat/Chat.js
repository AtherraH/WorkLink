import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';

// Connect to socket server
const socket = io('http://localhost:5000');

const Chat = () => {
  const { jobId } = useParams();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom when new message arrives
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Join the job's chat room
    socket.emit('join_room', jobId);

    // Load existing messages
    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `http://localhost:5000/api/chat/${jobId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages(res.data.messages);
      } catch (err) {
        console.error('Failed to load messages:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Listen for incoming messages
    socket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Cleanup on unmount
    return () => {
      socket.off('receive_message');
    };
  }, [jobId, token]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    // Emit message via socket
    socket.emit('send_message', {
      jobId,
      senderId: user.id,
      senderName: user.full_name,
      message: newMessage.trim(),
    });

    setNewMessage('');
  };

  // Send on Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) return <div style={styles.center}>Loading chat...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.headerTitle}>💬 Job Chat</h3>
          <p style={styles.headerSubtitle}>Job ID: {jobId.slice(0, 8)}...</p>
        </div>

        {/* Messages */}
        <div style={styles.messagesContainer}>
          {messages.length === 0 && (
            <p style={styles.noMessages}>No messages yet. Say hello!</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div
                key={msg.id}
                style={isMe ? styles.messageRowMe : styles.messageRowOther}
              >
                {!isMe && (
                  <p style={styles.senderName}>{msg.sender_name}</p>
                )}
                <div style={isMe ? styles.bubbleMe : styles.bubbleOther}>
                  <p style={styles.messageText}>{msg.message}</p>
                  <p style={styles.messageTime}>
                    {new Date(msg.sent_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={styles.inputContainer}>
          <textarea
            style={styles.input}
            placeholder="Type a message... (Enter to send)"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            rows={2}
          />
          <button style={styles.sendBtn} onClick={handleSend}>
            Send
          </button>
        </div>

      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f0f4f8',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '600px',
    display: 'flex',
    flexDirection: 'column',
    height: '80vh',
  },
  center: {
    textAlign: 'center',
    marginTop: '100px',
    fontSize: '18px',
    color: '#666',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #f0f0f0',
    backgroundColor: '#4f46e5',
    borderRadius: '12px 12px 0 0',
  },
  headerTitle: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: 'bold',
    margin: 0,
  },
  headerSubtitle: {
    color: '#c7d2fe',
    fontSize: '12px',
    margin: '4px 0 0 0',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  noMessages: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    marginTop: '40px',
  },
  messageRowMe: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  messageRowOther: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px',
    marginLeft: '4px',
  },
  bubbleMe: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: '18px 18px 4px 18px',
    maxWidth: '70%',
  },
  bubbleOther: {
    backgroundColor: '#f3f4f6',
    color: '#1a1a2e',
    padding: '10px 14px',
    borderRadius: '18px 18px 18px 4px',
    maxWidth: '70%',
  },
  messageText: {
    margin: 0,
    fontSize: '15px',
    lineHeight: '1.4',
  },
  messageTime: {
    margin: '4px 0 0 0',
    fontSize: '11px',
    opacity: 0.7,
    textAlign: 'right',
  },
  inputContainer: {
    display: 'flex',
    padding: '16px',
    borderTop: '1px solid #f0f0f0',
    gap: '10px',
  },
  input: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    resize: 'none',
    fontFamily: 'inherit',
  },
  sendBtn: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    alignSelf: 'flex-end',
  },
};

export default Chat;