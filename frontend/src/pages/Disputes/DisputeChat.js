import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';

const DisputeChat = () => {
  const { disputeId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [dispute, setDispute] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchData();

    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('join_dispute_room', disputeId);
    socketRef.current.on('dispute_message', (msg) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchData = async () => {
    try {
      // Fetch dispute details
      let disputeData = null;
      if (user?.role === 'admin') {
        const res = await axios.get('http://localhost:5000/api/admin/disputes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        disputeData = (res.data.disputes || []).find((d) => d.id === disputeId);
      } else {
        const res = await axios.get('http://localhost:5000/api/disputes/my-disputes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        disputeData = (res.data.disputes || []).find((d) => d.id === disputeId);
      }
      setDispute(disputeData);

      // Fetch messages
      const msgRes = await axios.get(
        `http://localhost:5000/api/dispute-chat/${disputeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(msgRes.data.messages || []);
    } catch (err) {
      console.error('Failed to load dispute chat:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    try {
      await axios.post(
        `http://localhost:5000/api/dispute-chat/${disputeId}`,
        { message: newMessage.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message.');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getRoleBadgeStyle = (role) => {
    if (role === 'admin') return { background: '#fef3c7', color: '#92400e' };
    if (role === 'worker') return { background: '#dbeafe', color: '#1d4ed8' };
    return { background: '#d1fae5', color: '#065f46' };
  };

  if (loading) return <div style={s.center}>Loading dispute chat...</div>;

  return (
    <div style={s.page}>
      <div style={s.chatBox}>
        {/* Header */}
        <div style={s.header}>
          <button style={s.backBtn} onClick={() => navigate(-1)}>←</button>
          <div style={s.headerInfo}>
            <p style={s.headerTitle}>⚖️ Dispute Chat</p>
            <p style={s.headerSub}>
              {dispute ? `Re: ${dispute.reason}` : 'Dispute conversation with admin'}
            </p>
          </div>
          {dispute?.status && (
            <span style={{
              ...s.statusBadge,
              background: dispute.status === 'open' ? '#fee2e2' : '#d1fae5',
              color: dispute.status === 'open' ? '#991b1b' : '#065f46',
            }}>
              {dispute.status.toUpperCase()}
            </span>
          )}
        </div>

        {/* Dispute info bar */}
        {dispute && (
          <div style={s.infoBar}>
            <span style={s.infoText}>
              🗂 {dispute.job_title || 'General Dispute'} &nbsp;|&nbsp;
              Reporter: <strong>{dispute.reporter_name}</strong> &nbsp;vs&nbsp;
              <strong>{dispute.reported_name}</strong>
            </span>
          </div>
        )}

        {/* Admin notice */}
        <div style={s.adminNotice}>
          🔒 This is a secure dispute channel. All messages are visible to both parties and the admin.
        </div>

        {/* Messages */}
        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={s.empty}>
              <p style={{ fontSize: '32px', margin: '0 0 8px 0' }}>⚖️</p>
              <p style={{ color: '#666', fontWeight: '600', marginBottom: '4px' }}>
                No messages yet
              </p>
              <p style={{ color: '#999', fontStyle: 'italic', fontSize: '13px' }}>
                Start the conversation with admin or the other party.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            const isAdmin = msg.sender_role === 'admin';
            return (
              <div key={msg.id} style={isMe ? s.rowMe : s.rowOther}>
                {!isMe && (
                  <div style={s.senderMeta}>
                    <span style={s.senderName}>{msg.sender_name}</span>
                    <span style={{ ...s.roleBadge, ...getRoleBadgeStyle(msg.sender_role) }}>
                      {msg.sender_role.toUpperCase()}
                    </span>
                  </div>
                )}
                <div style={
                  isMe ? s.bubbleMe :
                  isAdmin ? s.bubbleAdmin : s.bubbleOther
                }>
                  {isAdmin && !isMe && (
                    <p style={s.adminLabel}>🛡️ Admin</p>
                  )}
                  <p style={s.msgText}>{msg.message}</p>
                  <p style={s.msgTime}>
                    {new Date(msg.sent_at).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input — disabled if dispute resolved */}
        {dispute?.status === 'resolved' ? (
          <div style={s.resolvedBar}>
            ✅ This dispute has been resolved. Chat is now read-only.
          </div>
        ) : (
          <div style={s.inputRow}>
            <textarea
              style={s.input}
              placeholder="Type your message... (Enter to send)"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              rows={2}
            />
            <button style={s.sendBtn} onClick={handleSend}>Send</button>
          </div>
        )}
      </div>
    </div>
  );
};

const s = {
  page: {
    minHeight: '100vh', backgroundColor: '#f0f4f8',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  },
  chatBox: {
    backgroundColor: '#fff', borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)', width: '100%',
    maxWidth: '680px', display: 'flex', flexDirection: 'column', height: '88vh',
  },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666' },
  header: {
    padding: '14px 18px',
    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    borderRadius: '16px 16px 0 0',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
    width: '32px', height: '32px', borderRadius: '50%',
    cursor: 'pointer', fontSize: '16px', flexShrink: 0,
  },
  headerInfo: { flex: 1 },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: '15px', margin: 0 },
  headerSub: { color: '#fca5a5', fontSize: '12px', margin: '2px 0 0 0' },
  statusBadge: {
    fontSize: '11px', padding: '3px 10px',
    borderRadius: '999px', fontWeight: '700', flexShrink: 0,
  },
  infoBar: {
    padding: '8px 18px', background: '#fef2f2',
    borderBottom: '1px solid #fecaca',
  },
  infoText: { fontSize: '13px', color: '#7f1d1d' },
  adminNotice: {
    padding: '8px 18px', background: '#f0fdf4',
    borderBottom: '1px solid #bbf7d0',
    fontSize: '12px', color: '#166534',
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  empty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', marginTop: '60px',
  },
  rowMe: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  rowOther: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  senderMeta: {
    display: 'flex', alignItems: 'center', gap: '6px',
    marginBottom: '3px', marginLeft: '4px',
  },
  senderName: { fontSize: '11px', color: '#6b7280', fontWeight: '600' },
  roleBadge: {
    fontSize: '9px', padding: '1px 6px', borderRadius: '999px',
    fontWeight: '700', textTransform: 'uppercase',
  },
  bubbleMe: {
    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    color: '#fff', padding: '10px 14px',
    borderRadius: '18px 18px 4px 18px', maxWidth: '72%',
  },
  bubbleAdmin: {
    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    color: '#fff', padding: '10px 14px',
    borderRadius: '18px 18px 18px 4px', maxWidth: '72%',
  },
  bubbleOther: {
    background: '#f3f4f6', color: '#1a1a2e',
    padding: '10px 14px',
    borderRadius: '18px 18px 18px 4px', maxWidth: '72%',
  },
  adminLabel: { fontSize: '10px', fontWeight: '700', margin: '0 0 4px 0', opacity: 0.85 },
  msgText: { margin: 0, fontSize: '14px', lineHeight: '1.5' },
  msgTime: { margin: '4px 0 0 0', fontSize: '10px', opacity: 0.7, textAlign: 'right' },
  inputRow: {
    display: 'flex', padding: '14px', borderTop: '1px solid #f0f0f0', gap: '10px',
  },
  input: {
    flex: 1, padding: '10px 14px', borderRadius: '10px',
    border: '1.5px solid #e5e7eb', fontSize: '14px',
    resize: 'none', fontFamily: 'inherit', outline: 'none',
  },
  sendBtn: {
    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    color: '#fff', border: 'none', padding: '10px 20px',
    borderRadius: '10px', cursor: 'pointer', fontSize: '14px',
    fontWeight: '600', alignSelf: 'flex-end',
  },
  resolvedBar: {
    padding: '14px 18px', background: '#d1fae5',
    color: '#065f46', fontWeight: '600', fontSize: '14px', textAlign: 'center',
    borderTop: '1px solid #a7f3d0',
  },
};

export default DisputeChat;