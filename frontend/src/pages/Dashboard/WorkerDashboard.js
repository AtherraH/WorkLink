import React, { useState, useEffect } from 'react';
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

const WorkerDashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('browse');
  const [openJobs, setOpenJobs] = useState([]);
  const [myDisputes, setMyDisputes] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [suggestedCustomers, setSuggestedCustomers] = useState([]);
  const [suggestedJobs, setSuggestedJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'worker') { navigate('/login'); return; }
    fetchAll();
    // Fetch my disputes
    axios.get(`http://localhost:5000/api/disputes/my-disputes`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => setMyDisputes(r.data.disputes || [])).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const fetchAll = async () => {
    try {
      await Promise.all([
        fetchOpenJobs(),
        fetchMyApplications(),
        fetchAssignedJobs(),
        fetchProfile(),
        fetchSuggestedCustomers(),
        fetchSuggestedJobs(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenJobs = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/jobs');
      setOpenJobs(res.data.jobs);
    } catch (err) { console.error(err.message); }
  };

  const fetchMyApplications = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/applications/my-applications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyApplications(res.data.applications);
    } catch (err) { console.error(err.message); }
  };

  const fetchAssignedJobs = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/workers/assigned-jobs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAssignedJobs(res.data.jobs);
    } catch (err) { console.error(err.message); }
  };

  const fetchProfile = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/workers/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(res.data.profile);
    } catch (err) { console.error(err.message); }
  };

  const fetchSuggestedCustomers = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/suggestions/customers/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuggestedCustomers(res.data.suggested_customers || []);
    } catch (err) { console.error(err.message); }
  };

  const fetchSuggestedJobs = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/suggestions/jobs/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuggestedJobs(res.data.suggested_jobs || []);
    } catch (err) { console.error(err.message); }
  };

  const applyForJob = async (jobId) => {
    try {
      await axios.post(
        `http://localhost:5000/api/applications/${jobId}/apply`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Application submitted!');
      fetchMyApplications();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to apply.');
    }
  };

  const toggleOnline = async () => {
    try {
      const res = await axios.put(
        'http://localhost:5000/api/workers/toggle-online',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile((prev) => ({ ...prev, is_online: res.data.is_online }));
    } catch (err) { alert('Failed to toggle status.'); }
  };

  const [notifications, setNotifications] = useState([]);
  const [sysNotifs, setSysNotifs] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('worker_notifs') || '[]');
      // Deduplicate on load: keep only first occurrence of each type+message
      const seen = new Set();
      const deduped = raw.filter((n) => {
        const key = `${n.type}_${n.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      // Persist cleaned list back immediately so stale duplicates are gone
      if (deduped.length !== raw.length) {
        localStorage.setItem('worker_notifs', JSON.stringify(deduped));
      }
      return deduped;
    } catch(e) { return []; }
  });

  // Single socket connection for all personal notifications
  useEffect(() => {
    if (!user) return;
    let socket;
    import('socket.io-client').then(({ io }) => {
      socket = io('http://localhost:5000');
      socket.emit('join_user_room', user.id);

      // Job selection / rejection notifications
      socket.on('job_notification', (data) => {
        setNotifications(prev => [{ ...data, id: Date.now() }, ...prev.slice(0, 4)]);
        fetchAll();
      });

      // Admin system notifications (ban / warn / unban / resolve)
      socket.on('system_notification', (notif) => {
        // If banned, show alert then force logout immediately
        if (notif.type === 'ban') {
          alert(`🚫 Your account has been banned.\n\nReason: ${notif.message.replace(/^.*Reason: /, '')}\n\nYou will be logged out now.`);
          localStorage.removeItem('worker_notifs');
          logout();
          navigate('/login');
          return;
        }
        setSysNotifs(prev => {
          // Skip if an identical type+message already exists in the list
          const key = `${notif.type}_${notif.message}`;
          if (prev.some(n => `${n.type}_${n.message}` === key)) return prev;
          const updated = [notif, ...prev].slice(0, 10);
          localStorage.setItem('worker_notifs', JSON.stringify(updated));
          return updated;
        });
      });
    }).catch(() => {});

    return () => { if (socket) socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const hasApplied = (jobId) => myApplications.some((a) => a.job_id === jobId);

  const activeJobs = assignedJobs.filter((j) => ['assigned', 'in_progress'].includes(j.status));
  const pastJobs = assignedJobs.filter((j) => j.status === 'completed');

  if (!user || loading) return <div style={s.center}>Loading...</div>;

  const tabs = ['browse', 'ai-jobs', 'active', 'past', 'applications', 'customers', 'disputes'];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h2 style={s.hTitle}>Hello, {user.full_name}!</h2>
          <p style={s.hSub}>
            Worker Dashboard &nbsp;
            <span style={{ color: profile?.is_online ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
              ● {profile?.is_online ? 'Online' : 'Offline'}
            </span>
          </p>
        </div>
        <div style={s.hBtns}>
          <button style={s.btnOnline} onClick={toggleOnline}>
            {profile?.is_online ? '🔴 Go Offline' : '🟢 Go Online'}
          </button>
          <button style={s.btnPurple} onClick={() => navigate('/worker-profile')}>
            My Profile
          </button>
          <button style={s.btnGhost} onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </div>

      {/* System Notifications (ban/warn/resolve) */}
      {sysNotifs.length > 0 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          {sysNotifs.map((n, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', marginBottom: '6px', borderRadius: '8px',
              background: n.type === 'ban' ? '#fee2e2' : n.type === 'warn' ? '#fef3c7' : '#d1fae5',
              border: `1px solid ${n.type === 'ban' ? '#fca5a5' : n.type === 'warn' ? '#fcd34d' : '#6ee7b7'}` }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600',
                color: n.type === 'ban' ? '#991b1b' : n.type === 'warn' ? '#92400e' : '#065f46' }}>
                {n.type === 'ban' ? '🚫' : n.type === 'warn' ? '⚠️' : '✅'} {n.message}
              </p>
              <button onClick={() => { const updated = sysNotifs.filter((_,j)=>j!==i); setSysNotifs(updated); localStorage.setItem('worker_notifs', JSON.stringify(updated)); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '16px' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          {notifications.map(n => (
            <div key={n.id} style={{
              padding: '12px 16px', borderRadius: '10px', marginBottom: '8px',
              background: n.type === 'selected' ? '#d1fae5' : '#fee2e2',
              border: `1px solid ${n.type === 'selected' ? '#6ee7b7' : '#fca5a5'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: n.type === 'selected' ? '#065f46' : '#991b1b', fontWeight: '500' }}>
                {n.message}
              </p>
              <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af', flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={s.stats}>
        {[
          ['⭐', parseFloat(profile?.rating || 0).toFixed(1), 'Rating'],
          ['📋', myApplications.length, 'Applied'],
          ['🔨', activeJobs.length, 'Active Jobs'],
          ['✅', pastJobs.length, 'Completed'],
          ['🤖', suggestedJobs.length, 'AI Job Picks'],
        ].map(([icon, val, lbl]) => (
          <div key={lbl} style={s.stat}>
            <span style={s.statIcon}>{icon}</span>
            <span style={s.statVal}>{val}</span>
            <span style={s.statLbl}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {tabs.map((t) => (
          <button key={t} style={activeTab === t ? s.tabOn : s.tabOff} onClick={() => setActiveTab(t)}>
            {t === 'browse' && '🔍 Browse Jobs'}
            {t === 'ai-jobs' && `🤖 AI Picks (${suggestedJobs.length})`}
            {t === 'active' && `🔨 Active (${activeJobs.length})`}
            {t === 'past' && `✅ Past (${pastJobs.length})`}
            {t === 'applications' && `📋 Applications (${myApplications.length})`}
            {t === 'customers' && `👥 Suggested Customers (${suggestedCustomers.length})`}
          {t === 'disputes' && `⚠️ Disputes (${myDisputes.length})`}
          </button>
        ))}
      </div>

      <div style={s.content}>

        {/* Browse Jobs */}
        {activeTab === 'browse' && (
          <div>
            <h3 style={s.secTitle}>All Open Jobs ({openJobs.length})</h3>
            {openJobs.length === 0 ? <p style={s.empty}>No open jobs right now.</p> : (
              <div style={s.grid}>
                {openJobs.map((job) => (
                  <div key={job.id} style={s.card}>
                    {job.photo_url && <img src={job.photo_url} alt="job" style={s.cardImg} />}
                    <span style={job.urgency === 'urgent' ? s.badgeRed : s.badgeBlue}>
                      {job.urgency === 'urgent' ? '🔴 URGENT' : '🔵 SCHEDULED'}
                    </span>
                    <h4 style={s.cardTitle}>{job.title}</h4>
                    <p style={s.meta}>🔧 {job.labor_type}</p>
                    <p style={s.meta}>📍 {job.location}</p>
                    <p style={s.meta}>💰 Rs.{job.rate}</p>
                    <p style={s.meta}>👤 {job.customer_name}</p>
                    <div style={s.cardActions}>
                      {hasApplied(job.id) ? (
                        <span style={s.appliedBadge}>✓ Applied</span>
                      ) : (
                        <button style={s.btnGreen} onClick={() => applyForJob(job.id)}>Apply Now</button>
                      )}
                      <button style={s.btnGray} onClick={() => navigate(`/job/${job.id}`)}>Details</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Job Suggestions */}
        {activeTab === 'ai-jobs' && (
          <div>
            <h3 style={s.secTitle}>🤖 AI-Suggested Jobs for You ({suggestedJobs.length})</h3>
            <p style={s.subText}>Ranked by skill match, urgency, rate & proximity</p>
            {suggestedJobs.length === 0 ? <p style={s.empty}>No suggestions yet. Set your skills in your profile!</p> : (
              <div style={s.grid}>
                {suggestedJobs.map((job, i) => (
                  <div key={job.id} style={{ ...s.card, borderLeft: '4px solid #4f46e5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={job.urgency === 'urgent' ? s.badgeRed : s.badgeBlue}>
                        {job.urgency === 'urgent' ? '🔴 URGENT' : '🔵 SCHEDULED'}
                      </span>
                      <span style={s.scoreTag}>Score: {job.score}</span>
                    </div>
                    {job.skill_matched && <p style={s.matchTag}>✓ Matches your skills</p>}
                    <h4 style={s.cardTitle}>{job.title}</h4>
                    <p style={s.meta}>🔧 {job.labor_type}</p>
                    <p style={s.meta}>📍 {job.location}</p>
                    <p style={s.meta}>💰 Rs.{job.rate}</p>
                    <div style={s.cardActions}>
                      {hasApplied(job.id) ? (
                        <span style={s.appliedBadge}>✓ Applied</span>
                      ) : (
                        <button style={s.btnGreen} onClick={() => applyForJob(job.id)}>Apply Now</button>
                      )}
                      <button style={s.btnGray} onClick={() => navigate(`/job/${job.id}`)}>Details</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Jobs */}
        {activeTab === 'active' && (
          <div>
            <h3 style={s.secTitle}>Active Jobs ({activeJobs.length})</h3>
            {activeJobs.length === 0 ? <p style={s.empty}>No active jobs right now.</p> : (
              <div style={s.grid}>
                {activeJobs.map((job) => (
                  <div key={job.id} style={{ ...s.card, borderLeft: '4px solid #f59e0b' }}>
                    <span style={s.badgeYellow}>{job.status.replace('_', ' ').toUpperCase()}</span>
                    <h4 style={s.cardTitle}>{job.title}</h4>
                    <p style={s.meta}>📍 {job.location}</p>
                    <p style={s.meta}>💰 Rs.{job.rate}</p>
                    <p style={s.meta}>👤 {job.customer_name}</p>
                    <p style={s.meta}>📞 {job.customer_phone}</p>
                    {job.scheduled_time && (
                      <p style={s.meta}>🕐 {new Date(job.scheduled_time).toLocaleString([], { hour12: true })}</p>
                    )}
                    <div style={s.cardActions}>
                      <button style={s.btnIndigo} onClick={() => navigate(`/worker-job/${job.id}`)}>
                        Open Job
                      </button>
                      <button style={s.btnGray} onClick={() => navigate(`/chat/${job.id}`)}>Chat</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Past Jobs */}
        {activeTab === 'past' && (
          <div>
            <h3 style={s.secTitle}>Completed Jobs ({pastJobs.length})</h3>
            {pastJobs.length === 0 ? <p style={s.empty}>No completed jobs yet.</p> : (
              <div style={s.grid}>
                {pastJobs.map((job) => (
                  <div key={job.id} style={{ ...s.card, borderLeft: '4px solid #10b981' }}>
                    <span style={s.badgeGreen}>✅ COMPLETED</span>
                    <h4 style={s.cardTitle}>{job.title}</h4>
                    <p style={s.meta}>📍 {job.location}</p>
                    <p style={s.meta}>💰 Rs.{job.rate}</p>
                    <p style={s.meta}>👤 {job.customer_name}</p>
                    <div style={{ margin: '10px 0', padding: '10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#15803d', fontWeight: '700' }}>⏱ Job Timeline</p>
                      <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#374151' }}>
                        🟢 Entry: <strong>{formatTime(job.entry_time)}</strong>
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#374151' }}>
                        🔴 Exit: <strong>{formatTime(job.exit_time)}</strong>
                      </p>
                    </div>
                    <button style={s.btnGray} onClick={() => navigate(`/worker-job/${job.id}`)}>
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Applications */}
        {activeTab === 'applications' && (
          <div>
            <h3 style={s.secTitle}>My Applications ({myApplications.length})</h3>
            {myApplications.length === 0 ? <p style={s.empty}>No applications yet.</p> : (
              <div style={s.grid}>
                {myApplications.map((app) => (
                  <div key={app.application_id || app.job_id} style={{
                    ...s.card,
                    borderLeft: app.status === 'rejected' ? '4px solid #ef4444' : app.status === 'accepted' ? '4px solid #10b981' : '4px solid #e5e7eb',
                    opacity: app.status === 'rejected' ? 0.8 : 1,
                  }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      {/* Application status badge */}
                      <span style={{
                        ...s.badgeBlue,
                        backgroundColor: app.status === 'rejected' ? '#fee2e2' : app.status === 'accepted' ? '#d1fae5' : '#fef3c7',
                        color: app.status === 'rejected' ? '#991b1b' : app.status === 'accepted' ? '#065f46' : '#92400e',
                      }}>
                        {app.status === 'rejected' ? '❌ Not Selected' : app.status === 'accepted' ? '✅ Selected' : '⏳ Pending'}
                      </span>
                      {/* Job status badge */}
                      <span style={{
                        ...s.badgeBlue,
                        backgroundColor: app.job_status === 'completed' ? '#d1fae5' : app.job_status === 'in_progress' ? '#dbeafe' : '#f3f4f6',
                        color: app.job_status === 'completed' ? '#065f46' : app.job_status === 'in_progress' ? '#1d4ed8' : '#6b7280',
                      }}>
                        {app.job_status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <h4 style={s.cardTitle}>{app.title}</h4>
                    <p style={s.meta}>👤 {app.customer_name}</p>
                    <p style={s.meta}>🔧 {app.labor_type}</p>
                    <p style={s.meta}>📍 {app.location}</p>
                    <p style={s.meta}>💰 Rs.{app.rate}</p>
                    {app.status === 'rejected' && (
                      <p style={{ fontSize: '12px', color: '#ef4444', margin: '8px 0 0 0' }}>
                        This job was assigned to another worker.
                      </p>
                    )}
                    {app.status === 'accepted' && ['assigned', 'in_progress'].includes(app.job_status) && (
                      <button style={s.btnIndigo} onClick={() => navigate(`/worker-job/${app.job_id}`)}>
                        Open Job →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Disputes */}
        {activeTab === 'disputes' && <DisputesTab disputes={myDisputes} token={token} currentUserId={user.id} />}

        {/* Suggested Customers */}
        {activeTab === 'customers' && (
          <div>
            <h3 style={s.secTitle}>Suggested Customers ({suggestedCustomers.length})</h3>
            <p style={s.subText}>Based on your skills and their job posting history</p>
            {suggestedCustomers.length === 0 ? <p style={s.empty}>No suggestions yet. Complete more jobs to unlock!</p> : (
              <div style={s.grid}>
                {suggestedCustomers.map((c) => (
                  <div key={c.id} style={s.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={s.custAvatar}>{c.full_name?.charAt(0)}</div>
                      <span style={s.scoreTag}>Score: {c.score}</span>
                    </div>
                    <h4 style={s.cardTitle}>{c.full_name}</h4>
                    <p style={s.meta}>Jobs Posted: {c.total_jobs_posted}</p>
                    <p style={s.meta}>Avg Rate: Rs.{parseFloat(c.avg_rate || 0).toFixed(0)}</p>
                    <div style={s.skillsRow}>
                      {(c.job_types || []).filter(Boolean).map((t) => (
                        <span key={t} style={s.skillBadge}>{t}</span>
                      ))}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      {(c.reasons || []).map((r, i) => (
                        <p key={i} style={{ color: '#10b981', fontSize: '12px', margin: '2px 0' }}>✓ {r}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666' },
  header: { backgroundColor: '#1a1a2e', padding: '20px 30px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  hTitle: { margin: 0, fontSize: '22px', fontWeight: 'bold' },
  hSub: { margin: '4px 0 0 0', color: '#a5b4fc', fontSize: '14px' },
  hBtns: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  btnOnline: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  btnPurple: { backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  btnGhost: { backgroundColor: 'transparent', color: '#fff', border: '1px solid #fff', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  stats: { display: 'flex', backgroundColor: '#fff', padding: '16px 30px', gap: '30px', flexWrap: 'wrap', borderBottom: '1px solid #eee' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '70px' },
  statIcon: { fontSize: '20px' },
  statVal: { fontSize: '22px', fontWeight: 'bold', color: '#1a1a2e' },
  statLbl: { fontSize: '11px', color: '#666', textAlign: 'center' },
  tabs: { display: 'flex', backgroundColor: '#fff', borderBottom: '1px solid #eee', padding: '0 20px', overflowX: 'auto' },
  tabOn: { padding: '14px 16px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#4f46e5', borderBottom: '3px solid #4f46e5', fontWeight: 'bold', whiteSpace: 'nowrap' },
  tabOff: { padding: '14px 16px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#666', whiteSpace: 'nowrap' },
  content: { padding: '24px 30px' },
  secTitle: { fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '8px' },
  subText: { color: '#666', fontSize: '13px', marginBottom: '20px' },
  empty: { color: '#999', textAlign: 'center', padding: '40px', fontSize: '15px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  card: { backgroundColor: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
  cardImg: { width: '100%', height: '130px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' },
  cardTitle: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: '8px 0 6px 0' },
  meta: { color: '#666', fontSize: '13px', margin: '3px 0' },
  cardActions: { display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' },
  badgeRed: { display: 'inline-block', backgroundColor: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' },
  badgeBlue: { display: 'inline-block', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' },
  badgeYellow: { display: 'inline-block', backgroundColor: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' },
  badgeGreen: { display: 'inline-block', backgroundColor: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' },
  appliedBadge: { backgroundColor: '#d1fae5', color: '#065f46', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' },
  scoreTag: { backgroundColor: '#4f46e5', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' },
  matchTag: { color: '#10b981', fontSize: '12px', fontWeight: 'bold', margin: '4px 0 8px 0' },
  btnGreen: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  btnGray: { backgroundColor: '#f3f4f6', color: '#333', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  btnIndigo: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  custAvatar: { width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' },
  skillsRow: { display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '8px 0' },
  skillBadge: { backgroundColor: '#ede9fe', color: '#4f46e5', padding: '2px 8px', borderRadius: '20px', fontSize: '11px' },
};


const DisputesTab = ({ disputes, token, currentUserId }) => {
  const [openChatId, setOpenChatId] = React.useState(null);
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
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef(null);
  const socketRef = React.useRef(null);

  React.useEffect(() => {
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

  React.useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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

export default WorkerDashboard;