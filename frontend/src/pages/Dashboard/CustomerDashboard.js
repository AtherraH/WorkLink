import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CustomerDashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'customer') { navigate('/login'); return; }
    fetchMyJobs();
  }, []);

  const fetchMyJobs = async () => {
    try {
      const res = await axios.get(
        'http://localhost:5000/api/jobs/customer/my-jobs',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setJobs(res.data.jobs);
    } catch (err) {
      console.error('Failed to fetch jobs:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

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
          {/* Arrival deadline — only for assigned jobs with worker not yet arrived */}
          {job.status === 'assigned' && job.arrival_deadline && (() => {
            const deadline = new Date(job.arrival_deadline);
            const now = new Date();
            const minsLeft = Math.floor((deadline - now) / 60000);
            const isLate = minsLeft < 0;
            const isSoon = minsLeft <= 10 && !isLate;
            const bgColor = isLate ? '#fee2e2' : isSoon ? '#fef3c7' : '#ede9fe';
            const borderColor = isLate ? '#fca5a5' : isSoon ? '#fcd34d' : '#c4b5fd';
            const textColor = isLate ? '#991b1b' : isSoon ? '#92400e' : '#3730a3';
            const numColor = isLate ? '#ef4444' : isSoon ? '#f59e0b' : '#4f46e5';
            return (
              <div onClick={e => e.stopPropagation()} style={{
                margin: '10px 0 4px 0', padding: '10px 12px', borderRadius: '8px',
                backgroundColor: bgColor, border: `1px solid ${borderColor}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0, color: textColor }}>
                    {isLate ? '🚨 WORKER OVERDUE' : isSoon ? '⚠️ ARRIVING SOON' : '⏱ Worker must arrive by'}
                  </p>
                  <p style={{ fontSize: '11px', margin: '2px 0 0 0', color: '#555' }}>
                    {deadline.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: numColor }}>
                  {isLate ? `+${Math.abs(minsLeft)}m late` : `${minsLeft}m`}
                </span>
              </div>
            );
          })()}
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

export default CustomerDashboard;