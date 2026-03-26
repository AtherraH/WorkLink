import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const WorkerDashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('browse');
  const [openJobs, setOpenJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [suggestedCustomers, setSuggestedCustomers] = useState([]);
  const [suggestedJobs, setSuggestedJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'worker') { navigate('/login'); return; }
    fetchAll();
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

  const hasApplied = (jobId) => myApplications.some((a) => a.job_id === jobId);

  const activeJobs = assignedJobs.filter((j) => ['assigned', 'in_progress'].includes(j.status));
  const pastJobs = assignedJobs.filter((j) => j.status === 'completed');

  if (!user || loading) return <div style={s.center}>Loading...</div>;

  const tabs = ['browse', 'ai-jobs', 'active', 'past', 'applications', 'customers'];

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
          <button style={s.btnPurple} onClick={() => navigate(`/worker/${user.id}`)}>
            My Profile
          </button>
          <button style={s.btnGhost} onClick={logout}>Logout</button>
        </div>
      </div>

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
                    {(() => {
                      // Only show when assigned and worker not yet arrived
                      if (job.status !== 'assigned') return null;
                      // arrival_deadline: urgent=created_at+30min, scheduled=scheduled_time+30min
                      if (!job.arrival_deadline) return null;
                      const deadline = new Date(job.arrival_deadline);
                      const minsLeft = Math.floor((deadline - new Date()) / 60000);
                      const late = minsLeft < 0;
                      const urgent = minsLeft <= 10 && !late;
                      return (
                        <div style={{
                          margin: '8px 0',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: late ? '#fee2e2' : urgent ? '#fef3c7' : '#ede9fe',
                          border: `1px solid ${late ? '#fca5a5' : urgent ? '#fcd34d' : '#c4b5fd'}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <div>
                            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0,
                              color: late ? '#991b1b' : urgent ? '#92400e' : '#3730a3' }}>
                              {late ? '🚨 OVERDUE' : urgent ? '⚠️ ARRIVE SOON' : '⏱ Arrive by'}
                            </p>
                            <p style={{ fontSize: '12px', margin: '2px 0 0 0', color: '#555' }}>
                              {job.urgency === 'scheduled'
                                ? deadline.toLocaleString()
                                : `${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (30 min from selection)`}
                            </p>
                          </div>
                          <span style={{ fontSize: '20px', fontWeight: 'bold',
                            color: late ? '#ef4444' : urgent ? '#f59e0b' : '#4f46e5' }}>
                            {late ? `+${Math.abs(minsLeft)}m` : `${minsLeft}m`}
                          </span>
                        </div>
                      );
                    })()}
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
                  <div key={app.application_id || app.job_id} style={s.card}>
                    <span style={{
                      ...s.badgeBlue,
                      backgroundColor: app.job_status === 'completed' ? '#d1fae5' : app.job_status === 'assigned' ? '#fef3c7' : '#dbeafe',
                      color: app.job_status === 'completed' ? '#065f46' : app.job_status === 'assigned' ? '#92400e' : '#1d4ed8',
                    }}>
                      {app.job_status?.replace('_', ' ').toUpperCase()}
                    </span>
                    <h4 style={s.cardTitle}>{app.title}</h4>
                    <p style={s.meta}>🔧 {app.labor_type}</p>
                    <p style={s.meta}>📍 {app.location}</p>
                    <p style={s.meta}>💰 Rs.{app.rate}</p>
                    {['assigned', 'in_progress'].includes(app.job_status) && (
                      <button style={s.btnIndigo} onClick={() => navigate(`/worker-job/${app.job_id}`)}>
                        Open Job
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                    <a href={`tel:${c.phone}`} style={s.btnCallFull}>📞 Call Customer</a>
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
  btnCallFull: { display: 'block', marginTop: '10px', backgroundColor: '#10b981', color: '#fff', padding: '10px', borderRadius: '8px', textAlign: 'center', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' },
};

export default WorkerDashboard;