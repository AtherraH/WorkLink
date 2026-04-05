import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CustomerProfile = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!user) return;
    fetchProfile();
    fetchMyJobs();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(
        'http://localhost:5000/api/auth/profile',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile(res.data.user);
      setForm({
        full_name: res.data.user.full_name,
        phone: res.data.user.phone,
        address: res.data.user.address || '',
      });
    } catch (err) {
      console.error('Failed to fetch profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyJobs = async () => {
    try {
      const res = await axios.get(
        'http://localhost:5000/api/jobs/customer/my-jobs',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setJobs(res.data.jobs);
    } catch (err) {
      console.error('Failed to fetch jobs:', err.message);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await axios.put(
        'http://localhost:5000/api/auth/profile',
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Profile updated successfully!');
      setEditing(false);
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: '#d1fae5', assigned: '#fef3c7',
      in_progress: '#dbeafe', completed: '#ede9fe', cancelled: '#fee2e2',
    };
    return colors[status] || '#f3f4f6';
  };

  const getStatusTextColor = (status) => {
    const colors = {
      open: '#065f46', assigned: '#92400e',
      in_progress: '#1d4ed8', completed: '#4f46e5', cancelled: '#991b1b',
    };
    return colors[status] || '#333';
  };

  if (loading) return <div style={styles.center}>Loading profile...</div>;
  if (!profile) return <div style={styles.center}>Profile not found.</div>;

  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const activeJobs = jobs.filter((j) => ['assigned', 'in_progress'].includes(j.status));
  const openJobs = jobs.filter((j) => j.status === 'open');

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/customer-dashboard')}>
          ← Dashboard
        </button>
        <h2 style={styles.headerTitle}>My Profile</h2>
        <div />
      </div>

      {/* Profile Card */}
      <div style={styles.profileSection}>
        <div style={styles.profileCard}>
          <div style={styles.avatarBox}>
            <div style={styles.avatar}>
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              {editing ? (
                <input
                  style={styles.nameInput}
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              ) : (
                <h2 style={styles.profileName}>{profile.full_name}</h2>
              )}
              <span style={styles.customerBadge}>CUSTOMER</span>
            </div>
          </div>

          <div style={styles.profileInfo}>
            <div style={styles.infoItem}>
              <p style={styles.infoLabel}>Email</p>
              <p style={styles.infoValue}>{profile.email}</p>
            </div>
            <div style={styles.infoItem}>
              <p style={styles.infoLabel}>Phone</p>
              {editing ? (
                <input
                  style={styles.editInput}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              ) : (
                <p style={styles.infoValue}>{profile.phone}</p>
              )}
            </div>
            <div style={styles.infoItem}>
              <p style={styles.infoLabel}>Address</p>
              {editing ? (
                <input
                  style={styles.editInput}
                  value={form.address}
                  placeholder="Your full address"
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              ) : (
                <p style={styles.infoValue}>{profile.address || '—'}</p>
              )}
            </div>
            <div style={styles.infoItem}>
              <p style={styles.infoLabel}>Member Since</p>
              <p style={styles.infoValue}>
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div style={styles.editButtons}>
            {editing ? (
              <>
                <button
                  style={saving ? styles.btnDisabled : styles.btnSave}
                  onClick={saveProfile}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button style={styles.btnCancel} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button style={styles.btnEdit} onClick={() => setEditing(true)}>
                ✏️ Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <p style={styles.statNumber}>{jobs.length}</p>
            <p style={styles.statLabel}>Total Jobs</p>
          </div>
          <div style={{ ...styles.statCard, backgroundColor: '#dbeafe' }}>
            <p style={styles.statNumber}>{activeJobs.length}</p>
            <p style={styles.statLabel}>Active</p>
          </div>
          <div style={{ ...styles.statCard, backgroundColor: '#d1fae5' }}>
            <p style={styles.statNumber}>{completedJobs.length}</p>
            <p style={styles.statLabel}>Completed</p>
          </div>
          <div style={{ ...styles.statCard, backgroundColor: '#fef3c7' }}>
            <p style={styles.statNumber}>{openJobs.length}</p>
            <p style={styles.statLabel}>Open</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {['overview', 'history'].map((tab) => (
          <button
            key={tab}
            style={activeTab === tab ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && '📋 Overview'}
            {tab === 'history' && `📜 Job History (${jobs.length})`}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={styles.content}>
          <div style={styles.overviewGrid}>
            <div style={styles.overviewCard}>
              <h4 style={styles.overviewTitle}>Account Details</h4>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Full Name</span>
                <span style={styles.detailVal}>{profile.full_name}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Email</span>
                <span style={styles.detailVal}>{profile.email}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Phone</span>
                <span style={styles.detailVal}>{profile.phone}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Role</span>
                <span style={styles.detailVal}>Customer</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Joined</span>
                <span style={styles.detailVal}>
                  {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div style={styles.overviewCard}>
              <h4 style={styles.overviewTitle}>Activity Summary</h4>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Total Jobs Posted</span>
                <span style={styles.detailVal}>{jobs.length}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Jobs Completed</span>
                <span style={styles.detailVal}>{completedJobs.length}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Active Jobs</span>
                <span style={styles.detailVal}>{activeJobs.length}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Open Jobs</span>
                <span style={styles.detailVal}>{openJobs.length}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Completion Rate</span>
                <span style={styles.detailVal}>
                  {jobs.length > 0
                    ? `${Math.round((completedJobs.length / jobs.length) * 100)}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job History Tab */}
      {activeTab === 'history' && (
        <div style={styles.content}>
          <h3 style={styles.sectionTitle}>Job History</h3>
          {jobs.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyIcon}>📋</p>
              <p style={styles.emptyTitle}>No Jobs Yet</p>
              <p style={styles.emptyText}>Your posted jobs will appear here.</p>
              <button
                style={styles.btnPrimary}
                onClick={() => navigate('/post-job')}
              >
                Post a Job
              </button>
            </div>
          ) : (
            <div style={styles.jobsGrid}>
              {jobs.map((job) => (
                <div key={job.id} style={styles.jobCard}>
                  <div style={styles.jobCardHeader}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: getStatusColor(job.status),
                      color: getStatusTextColor(job.status),
                    }}>
                      {job.status.toUpperCase()}
                    </span>
                    <span style={styles.jobDate}>
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 style={styles.jobTitle}>{job.title}</h4>
                  <p style={styles.jobMeta}>🔧 {job.labor_type}</p>
                  <p style={styles.jobMeta}>📍 {job.location}</p>
                  <p style={styles.jobMeta}>💰 Rs.{job.rate}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666' },
  header: {
    backgroundColor: '#1a1a2e', padding: '16px 30px', color: '#fff',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: {
    backgroundColor: 'transparent', color: '#a5b4fc', border: '1px solid #a5b4fc',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
  },
  headerTitle: { fontSize: '20px', fontWeight: 'bold', margin: 0 },
  profileSection: { padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' },
  profileCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  avatarBox: { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' },
  avatar: {
    width: '80px', height: '80px', borderRadius: '50%',
    backgroundColor: '#4f46e5', color: '#fff', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold',
    flexShrink: 0,
  },
  profileName: { fontSize: '24px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 6px 0' },
  nameInput: {
    fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e',
    border: '2px solid #4f46e5', borderRadius: '8px', padding: '6px 12px',
    marginBottom: '6px', width: '100%',
  },
  customerBadge: {
    display: 'inline-block', backgroundColor: '#d1fae5', color: '#065f46',
    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
  },
  profileInfo: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px', marginBottom: '20px',
  },
  infoItem: { backgroundColor: '#f8f9fa', padding: '14px', borderRadius: '8px' },
  infoLabel: { fontSize: '11px', color: '#999', margin: '0 0 4px 0', textTransform: 'uppercase' },
  infoValue: { fontSize: '15px', fontWeight: 'bold', color: '#333', margin: 0 },
  editInput: {
    width: '100%', padding: '8px', borderRadius: '6px',
    border: '2px solid #4f46e5', fontSize: '14px', boxSizing: 'border-box',
  },
  editButtons: { display: 'flex', gap: '12px' },
  btnEdit: {
    backgroundColor: '#ede9fe', color: '#4f46e5', border: 'none',
    padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
  },
  btnSave: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
  },
  btnDisabled: {
    backgroundColor: '#a5b4fc', color: '#fff', border: 'none',
    padding: '10px 20px', borderRadius: '8px', cursor: 'not-allowed', fontSize: '14px',
  },
  btnCancel: {
    backgroundColor: '#f3f4f6', color: '#333', border: 'none',
    padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
  },
  statsRow: {
    display: 'flex', gap: '16px', flexWrap: 'wrap',
  },
  statCard: {
    flex: 1, minWidth: '100px', backgroundColor: '#fff', borderRadius: '12px',
    padding: '20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  statNumber: { fontSize: '28px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 4px 0' },
  statLabel: { fontSize: '13px', color: '#666', margin: 0 },
  tabs: {
    display: 'flex', backgroundColor: '#fff',
    borderBottom: '1px solid #eee', padding: '0 30px',
  },
  tab: {
    padding: '14px 20px', border: 'none', backgroundColor: 'transparent',
    cursor: 'pointer', fontSize: '14px', color: '#666',
  },
  tabActive: {
    padding: '14px 20px', border: 'none', backgroundColor: 'transparent',
    cursor: 'pointer', fontSize: '14px', color: '#4f46e5',
    borderBottom: '3px solid #4f46e5', fontWeight: 'bold',
  },
  content: { padding: '30px' },
  sectionTitle: { fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '20px' },
  overviewGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px',
  },
  overviewCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  overviewTitle: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 16px 0' },
  detailRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '10px 0', borderBottom: '1px solid #f3f4f6',
  },
  detailKey: { fontSize: '14px', color: '#666' },
  detailVal: { fontSize: '14px', fontWeight: 'bold', color: '#333' },
  jobsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px',
  },
  jobCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  jobCardHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '10px',
  },
  statusBadge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
  },
  jobDate: { fontSize: '12px', color: '#999' },
  jobTitle: { fontSize: '15px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  jobMeta: { fontSize: '13px', color: '#666', margin: '3px 0' },
  emptyState: {
    textAlign: 'center', padding: '60px', backgroundColor: '#fff',
    borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  emptyIcon: { fontSize: '48px', margin: '0 0 12px 0' },
  emptyTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  emptyText: { color: '#666', marginBottom: '20px' },
  btnPrimary: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px',
  },
};

export default CustomerProfile;