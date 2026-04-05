import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const formatTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const CustomerDashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [myDisputes, setMyDisputes] = useState([]);
  const [jobTimelines, setJobTimelines] = useState({});
  const [sysNotifs, setSysNotifs] = useState(() => { try { return JSON.parse(localStorage.getItem('customer_notifs') || '[]'); } catch(e) { return []; } });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'customer') { navigate('/login'); return; }
    fetchMyJobs();
    axios.get('http://localhost:5000/api/disputes/my-disputes',
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => setMyDisputes(r.data.disputes || [])).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for admin system notifications (ban/warn/unban/resolve)
  useEffect(() => {
    if (!user) return;
    let socket;
    import('socket.io-client').then(({ io }) => {
      socket = io('http://localhost:5000');
      socket.emit('join_user_room', user.id);
      socket.on('system_notification', (notif) => {
        // If banned, show alert then force logout immediately
        if (notif.type === 'ban') {
          alert(`🚫 Your account has been banned.\n\nReason: ${notif.message.replace(/^.*Reason: /, '')}\n\nYou will be logged out now.`);
          logout();
          navigate('/login');
          return;
        }
        setSysNotifs(prev => {
          const key = `${notif.type}_${notif.message}`;
          if (prev.some(n => `${n.type}_${n.message}` === key)) return prev;
          const updated = [notif, ...prev].slice(0, 10);
          localStorage.setItem('customer_notifs', JSON.stringify(updated));
          return updated;
        });
      });
    }).catch(() => {});
    return () => { if (socket) socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchMyJobs = async () => {
    try {
      const res = await axios.get(
        'http://localhost:5000/api/jobs/customer/my-jobs',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setJobs(res.data.jobs);
      // Fetch entry/exit times for completed jobs
      const completed = res.data.jobs.filter(j => j.status === 'completed');
      const timelines = {};
      await Promise.all(completed.map(async (j) => {
        try {
          const tr = await axios.get(
            `http://localhost:5000/api/completion/${j.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (tr.data.completion) timelines[j.id] = tr.data.completion;
        } catch (e) {}
      }));
      setJobTimelines(timelines);
    } catch (err) {
      console.error('Failed to fetch jobs:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => { localStorage.removeItem('customer_notifs'); logout(); navigate('/login'); };

  const activeJobs = jobs.filter((j) => ['assigned', 'in_progress'].includes(j.status));
  const openJobs = jobs.filter((j) => j.status === 'open');
  const pastJobs = jobs.filter((j) => ['completed', 'cancelled'].includes(j.status));

  const getStatusColor = (status) => ({
    open: { bg: '#d1fae5', text: '#065f46' },
    assigned: { bg: '#fef3c7', text: '#92400e' },
    in_progress: { bg: '#dbeafe', text: '#1d4ed8' },
    completed: { bg: '#ede9fe', text: '#4f46e5' },
    cancelled: { bg: '#fee2e2', text: '#991b1b' },
  }[status] || { bg: '#f3f4f6', text: '#333' });

  const renderJobCard = (job) => {
    const sc = getStatusColor(job.status);
    return (
      <div
        key={job.id}
        style={styles.jobCard}
        onClick={() => navigate(`/job-manage/${job.id}`)}
      >
        {job.photo_url && (
          <img src={job.photo_url} alt="job" style={styles.jobPhoto} />
        )}
        <div style={styles.jobBody}>
          <div style={styles.jobTop}>
            <span style={{ ...styles.badge, backgroundColor: sc.bg, color: sc.text }}>
              {job.status.replace('_', ' ').toUpperCase()}
            </span>
            <span style={{
              ...styles.badge,
              backgroundColor: job.urgency === 'urgent' ? '#fee2e2' : '#dbeafe',
              color: job.urgency === 'urgent' ? '#991b1b' : '#1d4ed8',
            }}>
              {job.urgency === 'urgent' ? '🔴 URGENT' : '🔵 SCHEDULED'}
            </span>
          </div>
          <h3 style={styles.jobTitle}>{job.title}</h3>
          <p style={styles.jobMeta}>🔧 {job.labor_type}</p>
          <p style={styles.jobMeta}>📍 {job.location}</p>
          <p style={styles.jobMeta}>💰 Rs.{job.rate}</p>
          <p style={styles.jobMeta}>🗓 {new Date(job.created_at).toLocaleDateString()}</p>
          {job.status === 'completed' && jobTimelines[job.id] && (
            <div style={{ margin: '10px 0', padding: '10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#15803d', fontWeight: '700' }}>⏱ Job Timeline</p>
              <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#374151' }}>
                🟢 Entry: <strong>{formatTime(jobTimelines[job.id].entry_time)}</strong>
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#374151' }}>
                🔴 Exit: <strong>{formatTime(jobTimelines[job.id].exit_time)}</strong>
              </p>
            </div>
          )}
          <div style={styles.jobCardFooter}>
            <button style={styles.btnManage}>Manage Job →</button>
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = ({ icon, title, text, btnText, btnAction }) => (
    <div style={styles.emptyState}>
      <p style={styles.emptyIcon}>{icon}</p>
      <p style={styles.emptyTitle}>{title}</p>
      <p style={styles.emptyText}>{text}</p>
      {btnText && (
        <button style={styles.btnPrimary} onClick={btnAction}>{btnText}</button>
      )}
    </div>
  );

  if (!user) return <div style={styles.center}>Loading...</div>;
  if (loading) return <div style={styles.center}>Loading dashboard...</div>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.logo} onClick={() => navigate('/')}>WorkLink</h1>
        </div>
        <div style={styles.headerCenter}>
          <p style={styles.headerGreeting}>Hello, {user.full_name}! 👋</p>
          <p style={styles.headerRole}>Customer Dashboard</p>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.btnOutline} onClick={() => navigate('/customer-profile')}>
            My Profile
          </button>
          <button style={styles.btnPrimary} onClick={() => navigate('/post-job')}>
            + Post Job
          </button>
          <button style={styles.btnDanger} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* System Notifications */}
      {sysNotifs.length > 0 && (
        <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #eee' }}>
          {sysNotifs.map((n, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', marginBottom: '6px', borderRadius: '8px',
              background: n.type === 'ban' ? '#fee2e2' : n.type === 'warn' ? '#fef3c7' : '#d1fae5',
              border: `1px solid ${n.type === 'ban' ? '#fca5a5' : n.type === 'warn' ? '#fcd34d' : '#6ee7b7'}` }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600',
                color: n.type === 'ban' ? '#991b1b' : n.type === 'warn' ? '#92400e' : '#065f46' }}>
                {n.type === 'ban' ? '🚫' : n.type === 'warn' ? '⚠️' : '✅'} {n.message}
              </p>
              <button onClick={() => { const updated = sysNotifs.filter((_,j)=>j!==i); setSysNotifs(updated); localStorage.setItem('customer_notifs', JSON.stringify(updated)); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={styles.statsBar}>
        <div style={styles.statCard}>
          <p style={styles.statNum}>{jobs.length}</p>
          <p style={styles.statLbl}>Total Jobs</p>
        </div>
        <div style={{ ...styles.statCard, borderTop: '4px solid #f59e0b' }}>
          <p style={styles.statNum}>{openJobs.length}</p>
          <p style={styles.statLbl}>Open</p>
        </div>
        <div style={{ ...styles.statCard, borderTop: '4px solid #3b82f6' }}>
          <p style={styles.statNum}>{activeJobs.length}</p>
          <p style={styles.statLbl}>Active</p>
        </div>
        <div style={{ ...styles.statCard, borderTop: '4px solid #10b981' }}>
          <p style={styles.statNum}>{pastJobs.length}</p>
          <p style={styles.statLbl}>Completed</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { key: 'active', label: `🔵 Active (${activeJobs.length})` },
          { key: 'open', label: `🟡 Open (${openJobs.length})` },
          { key: 'past', label: `✅ Past (${pastJobs.length})` },
          { key: 'all', label: `📋 All (${jobs.length})` },
          { key: 'disputes', label: `⚠️ Disputes (${myDisputes.length})` },
        ].map((t) => (
          <button
            key={t.key}
            style={activeTab === t.key ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'active' && (
          activeJobs.length === 0
            ? <EmptyState icon="🔵" title="No Active Jobs"
                text="Jobs assigned to workers will appear here."
                btnText="View Open Jobs" btnAction={() => setActiveTab('open')} />
            : <div style={styles.grid}>{activeJobs.map(renderJobCard)}</div>
        )}
        {activeTab === 'open' && (
          openJobs.length === 0
            ? <EmptyState icon="🟡" title="No Open Jobs"
                text="Post a new job to start receiving applications."
                btnText="Post a Job" btnAction={() => navigate('/post-job')} />
            : <div style={styles.grid}>{openJobs.map(renderJobCard)}</div>
        )}
        {activeTab === 'disputes' && <DisputesTab disputes={myDisputes} token={token} currentUserId={user.id} />}

        {activeTab === 'past' && (
          pastJobs.length === 0
            ? <EmptyState icon="✅" title="No Past Jobs"
                text="Completed and cancelled jobs will appear here." />
            : <div style={styles.grid}>{pastJobs.map(renderJobCard)}</div>
        )}
        {activeTab === 'all' && (
          jobs.length === 0
            ? <EmptyState icon="📋" title="No Jobs Yet"
                text="You haven't posted any jobs yet."
                btnText="Post Your First Job" btnAction={() => navigate('/post-job')} />
            : <div style={styles.grid}>{jobs.map(renderJobCard)}</div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666' },
  header: {
    backgroundColor: '#1a1a2e', padding: '16px 30px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft: {},
  logo: {
    color: '#fff', fontSize: '22px', fontWeight: 'bold', margin: 0,
    cursor: 'pointer',
  },
  headerCenter: { textAlign: 'center' },
  headerGreeting: { color: '#fff', fontWeight: 'bold', fontSize: '16px', margin: 0 },
  headerRole: { color: '#a5b4fc', fontSize: '13px', margin: '2px 0 0 0' },
  headerRight: { display: 'flex', gap: '10px', alignItems: 'center' },
  btnOutline: {
    backgroundColor: 'transparent', color: '#fff', border: '1px solid #fff',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
  },
  btnPrimary: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
  },
  btnDanger: {
    backgroundColor: '#ef4444', color: '#fff', border: 'none',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
  },
  statsBar: {
    display: 'flex', gap: '20px', padding: '24px 30px',
    backgroundColor: '#fff', borderBottom: '1px solid #eee', flexWrap: 'wrap',
  },
  statCard: {
    flex: 1, minWidth: '100px', backgroundColor: '#f8fafc', borderRadius: '12px',
    padding: '16px', textAlign: 'center', borderTop: '4px solid #4f46e5',
  },
  statNum: { fontSize: '28px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 },
  statLbl: { fontSize: '13px', color: '#666', margin: '4px 0 0 0' },
  tabs: {
    display: 'flex', backgroundColor: '#fff',
    borderBottom: '1px solid #eee', padding: '0 30px', overflowX: 'auto',
  },
  tab: {
    padding: '14px 20px', border: 'none', backgroundColor: 'transparent',
    cursor: 'pointer', fontSize: '14px', color: '#666', whiteSpace: 'nowrap',
  },
  tabActive: {
    padding: '14px 20px', border: 'none', backgroundColor: 'transparent',
    cursor: 'pointer', fontSize: '14px', color: '#4f46e5',
    borderBottom: '3px solid #4f46e5', fontWeight: 'bold', whiteSpace: 'nowrap',
  },
  content: { padding: '30px' },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px',
  },
  jobCard: {
    backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  jobPhoto: { width: '100%', height: '140px', objectFit: 'cover' },
  jobBody: { padding: '16px' },
  jobTop: { display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' },
  badge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
  },
  jobTitle: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  jobMeta: { fontSize: '13px', color: '#666', margin: '3px 0' },
  jobCardFooter: { marginTop: '12px' },
  btnManage: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '10px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '14px', width: '100%', fontWeight: 'bold',
  },
  emptyState: {
    textAlign: 'center', padding: '60px 20px', backgroundColor: '#fff',
    borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  emptyIcon: { fontSize: '48px', margin: '0 0 12px 0' },
  emptyTitle: { fontSize: '22px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  emptyText: { color: '#666', marginBottom: '20px' },
};


const DisputesTab = ({ disputes, token, currentUserId }) => {
  const [openChatId, setOpenChatId] = useState(null);
  return (
    <div>
      <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a2e', marginBottom: '16px' }}>
        ⚠️ My Disputes ({disputes.length})
      </h3>
      {disputes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          <p style={{ fontSize: '40px', margin: '0 0 12px 0' }}>✅</p>
          <p style={{ fontWeight: '700', fontSize: '16px' }}>No disputes filed</p>
          <p style={{ fontSize: '14px' }}>You have not raised any disputes yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {disputes.map((d) => (
            <div key={d.id} style={{
              background: '#fff', borderRadius: '12px', padding: '16px 20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderLeft: `4px solid ${d.status === 'open' ? '#ef4444' : '#10b981'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '999px', background: d.status === 'open' ? '#fee2e2' : '#d1fae5', color: d.status === 'open' ? '#991b1b' : '#065f46' }}>
                  {d.status?.toUpperCase()}
                </span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {new Date(d.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p style={{ margin: '0 0 4px 0', fontWeight: '700', fontSize: '15px', color: '#1a1a2e' }}>{d.reason}</p>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b' }}>{d.description}</p>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#9ca3af' }}>📋 Job: {d.job_title || '—'}</p>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#9ca3af' }}>
                Reported: {d.reported_name} ({d.reported_role})
              </p>
              {d.resolution && (
                <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#065f46', fontWeight: '600' }}>✅ Resolution: {d.resolution}</p>
                </div>
              )}
              <button
                style={{ backgroundColor: openChatId === d.id ? '#1d4ed8' : '#4f46e5', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setOpenChatId(openChatId === d.id ? null : d.id)}
              >
                💬 {openChatId === d.id ? 'Hide Admin Chat' : 'Chat with Admin'}
              </button>
              {openChatId === d.id && (
                <DisputeChatPanel disputeId={d.id} token={token} currentUserId={currentUserId} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DisputeChatPanel = ({ disputeId, token, currentUserId }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    import('socket.io-client').then(({ io }) => {
      socketRef.current = io('http://localhost:5000');
      socketRef.current.emit('join_dispute_room', disputeId);
      socketRef.current.on('dispute_message', (msg) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      });
    }).catch(() => {});
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/dispute-chat/${disputeId}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(res.data.messages || []);
    } catch(e) {}
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await axios.post(`http://localhost:5000/api/dispute-chat/${disputeId}`, { message: input.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      setInput('');
    } catch(e) { alert('Failed to send message.'); }
    finally { setSending(false); }
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div style={{ marginTop: '14px', border: '1.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: '#f8faff' }}>
      <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>🛡️</span>
        <p style={{ margin: 0, color: '#fff', fontWeight: '700', fontSize: '13px' }}>Admin Support Chat</p>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#c7d2fe' }}>Visible to admin &amp; both parties</span>
      </div>
      <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '13px', margin: '20px 0' }}>
            No messages yet. Send a message to reach admin support.
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          const isAdmin = msg.sender_role === 'admin';
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              {!isMe && (
                <span style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px', marginLeft: '4px' }}>
                  {isAdmin ? '🛡️ Admin' : msg.sender_name}
                </span>
              )}
              <div style={{ padding: '8px 12px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', maxWidth: '75%', background: isMe ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : isAdmin ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : '#e5e7eb', color: isMe || isAdmin ? '#fff' : '#1a1a2e' }}>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>{msg.message}</p>
                <p style={{ margin: '3px 0 0 0', fontSize: '10px', opacity: 0.75, textAlign: 'right' }}>
                  {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
        <input
          style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', outline: 'none' }}
          placeholder="Type your message to admin..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKey}
          disabled={sending}
        />
        <button
          style={{ backgroundColor: sending ? '#a5b4fc' : '#4f46e5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: sending ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600' }}
          onClick={sendMessage}
          disabled={sending}
        >Send</button>
      </div>
    </div>
  );
};

export default CustomerDashboard;