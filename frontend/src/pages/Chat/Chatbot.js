import React, { useState } from 'react';
import axios from 'axios';

const Chatbot = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: 'bot',
      text: 'Hi! I am WorkLink Assistant. I can answer questions about WorkLink or provide live AI support for complex issues. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const getRuleBasedResponse = (userMessage) => {
    const msg = userMessage.toLowerCase();
    if (msg.includes('hello') || msg.includes('hi')) {
      return 'Hello! How can I help you with WorkLink today?';
    }
    if (msg.includes('post') && msg.includes('job')) {
      return 'To post a job, go to your Customer Dashboard and click "Post New Job". You can add a title, description, rate, location and even use voice input!';
    }
    if (msg.includes('apply') || msg.includes('application')) {
      return 'As a worker, go to your Worker Dashboard and browse open jobs. Click "Apply Now" on any job that matches your skills!';
    }
    if (msg.includes('otp')) {
      return 'When you arrive at the job location, ask the customer for the 6-digit OTP. Go to Verify OTP tab in your Worker Dashboard and enter it to mark your arrival.';
    }
    if (msg.includes('payment')) {
      return 'Payments are handled directly between customer and worker. After job completion, the customer clicks "Pay Worker" and the worker confirms receipt. Rating unlocks after payment!';
    }
    if (msg.includes('rating') || msg.includes('review')) {
      return 'After payment is completed, customers can rate workers from 1 to 5 stars. Higher ratings help workers get more jobs!';
    }
    if (msg.includes('emergency') || msg.includes('backup')) {
      return 'If a worker does not arrive within 30 minutes, you can trigger Emergency Backup from the Bond Status page. 3 nearby workers will be notified instantly!';
    }
    if (msg.includes('track') || msg.includes('location')) {
      return 'You can track your assigned worker in real-time on the map. Go to Track Worker from your Customer Dashboard after a worker is assigned.';
    }
    if (msg.includes('cancel')) {
      return 'To cancel a job, the customer can trigger emergency backup or wait for the worker. Worker reliability is tracked automatically.';
    }
    if (msg.includes('profile')) {
      return 'Workers can view their public profile by clicking "My Profile" in the Worker Dashboard. Your portfolio is automatically updated after each completed job!';
    }
    if (msg.includes('online') || msg.includes('offline')) {
      return 'Workers can toggle their online or offline status from the Worker Dashboard header. Being online increases your visibility to customers!';
    }
    if (msg.includes('portfolio')) {
      return 'Your portfolio is automatically updated every time you complete a job and upload a completion photo. Customers can view it on your profile!';
    }
    if (msg.includes('skill')) {
      return 'Workers skills are shown on their profile. Having matching skills increases your chances of being suggested for jobs!';
    }
    if (msg.includes('chat')) {
      return 'You can chat with your customer or worker directly from any assigned job. Click the Chat button on the job card!';
    }
    if (msg.includes('call')) {
      return 'You can call the customer or worker directly using the Call button on the job detail page or worker profile page!';
    }
    if (msg.includes('suggestion') || msg.includes('suggest')) {
      return 'WorkLink uses AI to suggest the best workers for each job based on skills, rating, location and availability!';
    }
    if (msg.includes('register') || msg.includes('signup')) {
      return 'To register, go to the Register page and fill in your name, email, phone and password. Choose your role as Customer or Worker!';
    }
    if (msg.includes('login') || msg.includes('sign in')) {
      return 'Go to the Login page and enter your email and password. You will be redirected to your dashboard automatically!';
    }
    if (msg.includes('photo') || msg.includes('picture')) {
      return 'Workers must upload a completion photo when finishing a job. This photo is automatically added to their public portfolio!';
    }
    if (msg.includes('admin')) {
      return 'The Admin Dashboard shows platform-wide stats including total users, jobs, payments and worker reliability tracking.';
    }
    if (msg.includes('thank')) {
      return 'You are welcome! Is there anything else I can help you with?';
    }
    if (msg.includes('bye') || msg.includes('goodbye')) {
      return 'Goodbye! Have a great day using WorkLink!';
    }
    return null;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input.trim();
    const userMessage = {
      id: messages.length + 1,
      from: 'user',
      text: userText,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      const ruleResponse = getRuleBasedResponse(userText);
      let botText;

      if (ruleResponse) {
        botText = ruleResponse;
      } else {
        // Call backend which calls Groq
        const res = await axios.post(
          'http://localhost:5000/api/chatbot/reply',
          {
            message: userText,
            history: updatedMessages,
          }
        );
        botText = res.data.reply;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          from: 'bot',
          text: botText,
        },
      ]);
    } catch (err) {
      console.error('Chatbot error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          from: 'bot',
          text: 'Sorry, I am having trouble connecting right now. Please try again shortly!',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <>
      <button style={styles.floatingBtn} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? 'X' : 'Help'}
      </button>

      {isOpen && (
        <div style={styles.chatWindow}>
          <div style={styles.header}>
            <div style={styles.botAvatar}>W</div>
            <div>
              <p style={styles.botName}>WorkLink Assistant</p>
              <p style={styles.botStatus}>AI-Powered Live Support</p>
            </div>
          </div>

          <div style={styles.messagesContainer}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={msg.from === 'user' ? styles.userRow : styles.botRow}
              >
                <div style={msg.from === 'user' ? styles.userBubble : styles.botBubble}>
                  <p style={styles.messageText}>{msg.text}</p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={styles.botRow}>
                <div style={styles.botBubble}>
                  <p style={styles.messageText}>Typing...</p>
                </div>
              </div>
            )}
          </div>

          <div style={styles.quickQuestions}>
            {['How to post a job?', 'How to apply?', 'Payment help', 'OTP help'].map((q) => (
              <button
                key={q}
                style={styles.quickBtn}
                onClick={() => setInput(q)}
              >
                {q}
              </button>
            ))}
          </div>

          <div style={styles.inputContainer}>
            <input
              style={styles.input}
              type="text"
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isTyping}
            />
            <button
              style={isTyping ? styles.sendBtnDisabled : styles.sendBtn}
              onClick={handleSend}
              disabled={isTyping}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const styles = {
  floatingBtn: {
    position: 'fixed',
    bottom: '30px',
    right: '30px',
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: 'none',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 4px 12px rgba(79,70,229,0.4)',
    zIndex: 1000,
  },
  chatWindow: {
    position: 'fixed',
    bottom: '100px',
    right: '30px',
    width: '340px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    overflow: 'hidden',
    maxHeight: '520px',
  },
  header: {
    backgroundColor: '#4f46e5',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  botAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '16px',
  },
  botName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '14px',
    margin: 0,
  },
  botStatus: {
    color: '#c7d2fe',
    fontSize: '11px',
    margin: 0,
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '270px',
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  botRow: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  userBubble: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '14px 14px 4px 14px',
    maxWidth: '80%',
  },
  botBubble: {
    backgroundColor: '#f3f4f6',
    color: '#333',
    padding: '8px 12px',
    borderRadius: '14px 14px 14px 4px',
    maxWidth: '80%',
  },
  messageText: {
    margin: 0,
    fontSize: '13px',
    lineHeight: '1.4',
  },
  quickQuestions: {
    display: 'flex',
    gap: '6px',
    padding: '8px 14px',
    flexWrap: 'wrap',
    borderTop: '1px solid #f0f0f0',
  },
  quickBtn: {
    backgroundColor: '#ede9fe',
    color: '#4f46e5',
    border: 'none',
    padding: '4px 10px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  inputContainer: {
    display: 'flex',
    padding: '10px 14px',
    borderTop: '1px solid #f0f0f0',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '13px',
  },
  sendBtn: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  sendBtnDisabled: {
    backgroundColor: '#a5b4fc',
    color: '#fff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '8px',
    cursor: 'not-allowed',
    fontSize: '13px',
  },
};

export default Chatbot;