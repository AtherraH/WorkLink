import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';

const Chat = () => {
  const { jobId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [otherPerson, setOtherPerson] = useState(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Create socket per component instance (not module-level)
    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('join_room', jobId);

    fetchData();

    socketRef.current.on('receive_message', (message) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchData = async () => {
    try {
      // Fetch job info
      const jobRes = await axios.get(`http://localhost:5000/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJob(jobRes.data.job);

      // Fetch messages
      const msgRes = await axios.get(`http://localhost:5000/api/chat/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(msgRes.data.messages || []);

      // Determine the other person in the chat
      const j = jobRes.data.job;
      if (user?.role === 'customer') {
        // Fetch assigned worker info
        try {
          const workerRes = await axios.get(
            `http://localhost:5000/api/applications/${jobId}/assigned-worker`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setOtherPerson(workerRes.data.worker);
        } catch (e) {}
      } else {
        // Worker — fetch customer info from job
        setOtherPerson({ full_name: j?.customer_name || 'Customer', id: j?.customer_id });
      }
    } catch (err) {
      console.error('Failed to load chat:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!newMessage.trim() || !socketRef.current) return;
    socketRef.current.emit('send_message', {
      jobId,
      senderId: user.id,
      senderName: user.full_name,
      message: newMessage.trim(),
    });
    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (loading) return <div style={s.center}>Loading chat...</div>;

  return (
    <div style={s.page}>
      <div style={s.chatBox}>
        {/* Header */}
        <div style={s.header}>
          <button style={s.backBtn} onClick={() => navigate(-1)}>←</button>
          <div style={s.headerInfo}>
            <p style={s.headerTitle}>
              💬 {job?.title || 'Job Chat'}
            </p>
            <p style={s.headerSub}>
              {otherPerson ? `Chat with ${otherPerson.full_name}` : 'Job conversation'}
            </p>
          </div>
          {otherPerson?.phone && (
            <a href={`tel:${otherPerson.phone}`} style={s.callBtn}>📞</a>
          )}
        </div>

        {/* Job info bar */}
        {job && (
          <div style={s.jobBar}>
            <span style={s.jobBarText}>📋 {job.title}</span>
            <span style={{
              ...s.statusBadge,
              background: job.status === 'completed' ? '#d1fae5' : job.status === 'in_progress' ? '#dbeafe' : job.status === 'open' ? '#ede9fe' : '#fef3c7',
              color: job.status === 'completed' ? '#065f46' : job.status === 'in_progress' ? '#1e40af' : job.status === 'open' ? '#4f46e5' : '#92400e',
            }}>
              {job.status?.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        )}
        {job?.status === 'open' && (
          <div style={{ padding: '8px 18px', background: '#fef3c7', borderBottom: '1px solid #fde68a', fontSize: '12px', color: '#92400e' }}>
            💡 Pre-selection chat — messages are saved and visible to both parties after worker is selected.
          </div>
        )}

        {/* Messages */}
        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={s.empty}>
              <p style={{ fontSize: '32px', margin: '0 0 8px 0' }}>💬</p>
              <p style={{ color: '#666', fontWeight: '600', marginBottom: '4px' }}>No messages yet</p>
              <p style={{ color: '#999', fontStyle: 'italic', fontSize: '13px' }}>
                {job?.status === 'open' ? 'Send a message to introduce yourself before being selected.' : 'Start chatting about this job.'}
              </p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} style={isMe ? s.rowMe : s.rowOther}>
                {!isMe && <p style={s.senderName}>{msg.sender_name}</p>}
                <div style={isMe ? s.bubbleMe : s.bubbleOther}>
                  <p style={s.msgText}>{msg.message}</p>
                  <p style={s.msgTime}>
                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={s.inputRow}>
          <textarea
            style={s.input}
            placeholder="Type a message... (Enter to send)"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            rows={2}
          />
          <button style={s.sendBtn} onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  chatBox: { backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', height: '85vh' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666' },
  header: { padding: '14px 18px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', flexShrink: 0 },
  headerInfo: { flex: 1 },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: '15px', margin: 0 },
  headerSub: { color: '#c7d2fe', fontSize: '12px', margin: '2px 0 0 0' },
  callBtn: { background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '8px', textDecoration: 'none', fontSize: '16px' },
  jobBar: { padding: '8px 18px', background: '#f8faff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  jobBarText: { fontSize: '13px', color: '#4b5563', fontWeight: '600' },
  statusBadge: { fontSize: '11px', padding: '2px 10px', borderRadius: '999px', fontWeight: '700' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '60px' },
  rowMe: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  rowOther: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  senderName: { fontSize: '11px', color: '#9ca3af', marginBottom: '3px', marginLeft: '4px' },
  bubbleMe: { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', padding: '10px 14px', borderRadius: '18px 18px 4px 18px', maxWidth: '72%' },
  bubbleOther: { background: '#f3f4f6', color: '#1a1a2e', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', maxWidth: '72%' },
  msgText: { margin: 0, fontSize: '14px', lineHeight: '1.5' },
  msgTime: { margin: '4px 0 0 0', fontSize: '10px', opacity: 0.7, textAlign: 'right' },
  inputRow: { display: 'flex', padding: '14px', borderTop: '1px solid #f0f0f0', gap: '10px' },
  input: { flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', resize: 'none', fontFamily: 'inherit', outline: 'none' },
  sendBtn: { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', alignSelf: 'flex-end' },
};

export default Chat;