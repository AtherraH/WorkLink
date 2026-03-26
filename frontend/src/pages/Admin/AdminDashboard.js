import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      await Promise.all([
        fetchStats(),
        fetchUsers(),
        fetchJobs(),
        fetchDisputes(),
        fetchActions(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err.message);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.users);
    } catch (err) {
      console.error('Failed to fetch users:', err.message);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/jobs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs(res.data.jobs);
    } catch (err) {
      console.error('Failed to fetch jobs:', err.message);
    }
  };

  const fetchDisputes = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/disputes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDisputes(res.data.disputes);
    } catch (err) {
      console.error('Failed to fetch disputes:', err.message);
    }
  };

  const fetchActions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/admin/actions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActions(res.data.actions);
    } catch (err) {
      console.error('Failed to fetch actions:', err.message);
    }
  };

  const banUser = async (userId, userName) => {
    const reason = prompt(`Enter reason for banning ${userName}:`);
    if (!reason) return;
    try {
      await axios.put(
        `http://localhost:5000/api/admin/users/${userId}/ban`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`${userName} has been banned.`);
      fetchUsers();
      fetchActions();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to ban user.');
    }
  };

  const unbanUser = async (userId, userName) => {
    if (!window.confirm(`Unban ${userName}?`)) return;
    try {
      await axios.put(
        `http://localhost:5000/api/admin/users/${userId}/unban`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`${userName} has been unbanned.`);
      fetchUsers();
      fetchActions();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unban user.');
    }
  };

  const warnUser = async (userId, userName) => {
    const reason = prompt(`Enter warning reason for ${userName}:`);
    if (!reason) return;
    try {
      await axios.put(
        `http://localhost:5000/api/admin/users/${userId}/warn`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`Warning issued to ${userName}.`);
      fetchUsers();
      fetchActions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to warn user.');
    }
  };

  const resolveDispute = async (disputeId) => {
    const resolution = prompt('Enter resolution details:');
    if (!resolution) return;
    try {
      await axios.put(
        `http://localhost:5000/api/admin/disputes/${disputeId}/resolve`,
        { resolution },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Dispute resolved!');
      fetchDisputes();
      fetchActions();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resolve dispute.');
    }
  };

  const getJobStatusColor = (status) => {
    const colors = {
      open: '#d1fae5', assigned: '#fef3c7',
      in_progress: '#dbeafe', completed: '#ede9fe', cancelled: '#fee2e2',
    };
    return colors[status] || '#f3f4f6';
  };

  const filteredUsers = users.filter((u) => {
    if (userFilter === 'all') return true;
    if (userFilter === 'banned') return u.is_banned;
    return u.role === userFilter && !u.is_banned;
  });

  const filteredJobs = jobs.filter((j) => {
    if (jobFilter === 'all') return true;
    return j.status === jobFilter;
  });

  if (!user) return <div style={styles.center}>Loading...</div>;
  if (loading) return <div style={styles.center}>Loading admin dashboard...</div>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>WorkLink Admin</h2>
          <p style={styles.subtitle}>
            Logged in as {user.full_name} &nbsp;|&nbsp; Platform Management
          </p>
        </div>
        <button style={styles.btnSecondary} onClick={logout}>
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {['stats', 'users', 'jobs', 'disputes', 'actions'].map((tab) => (
          <button
            key={tab}
            style={activeTab === tab ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'stats' && '📊 Stats'}
            {tab === 'users' && `👥 Users (${users.length})`}
            {tab === 'jobs' && `💼 Jobs (${jobs.length})`}
            {tab === 'disputes' && `⚠️ Disputes (${disputes.filter(d => d.status === 'open').length} open)`}
            {tab === 'actions' && `📋 Actions Log (${actions.length})`}
          </button>
        ))}
      </div>

      {/* Stats Tab */}
      {activeTab === 'stats' && stats && (
        <div style={styles.content}>
          <h3 style={styles.sectionTitle}>Platform Overview</h3>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <p style={styles.statNumber}>{stats.total_users}</p>
              <p style={styles.statLabel}>Total Users</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statNumber}>{stats.total_workers}</p>
              <p style={styles.statLabel}>Workers</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statNumber}>{stats.total_customers}</p>
              <p style={styles.statLabel}>Customers</p>
            </div>
            <div style={{ ...styles.statCard, backgroundColor: '#d1fae5' }}>
              <p style={styles.statNumber}>{stats.online_workers}</p>
              <p style={styles.statLabel}>Online Now</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statNumber}>{stats.total_jobs}</p>
              <p style={styles.statLabel}>Total Jobs</p>
            </div>
            <div style={{ ...styles.statCard, backgroundColor: '#dbeafe' }}>
              <p style={styles.statNumber}>{stats.open_jobs}</p>
              <p style={styles.statLabel}>Open Jobs</p>
            </div>
            <div style={{ ...styles.statCard, backgroundColor: '#d1fae5' }}>
              <p style={styles.statNumber}>{stats.completed_jobs}</p>
              <p style={styles.statLabel}>Completed</p>
            </div>
            <div style={{ ...styles.statCard, backgroundColor: '#fee2e2' }}>
              <p style={styles.statNumber}>{stats.cancelled_jobs}</p>
              <p style={styles.statLabel}>Cancelled</p>
            </div>
            <div style={{ ...styles.statCard, backgroundColor: '#d1fae5' }}>
              <p style={styles.statNumber}>Rs.{stats.total_payments}</p>
              <p style={styles.statLabel}>Total Payments</p>
            </div>
            <div style={{ ...styles.statCard, backgroundColor: '#fee2e2' }}>
              <p style={styles.statNumber}>{stats.banned_users}</p>
              <p style={styles.statLabel}>Banned Users</p>
            </div>
            <div style={{ ...styles.statCard, backgroundColor: '#fee2e2' }}>
              <p style={styles.statNumber}>{stats.forfeited_bonds}</p>
              <p style={styles.statLabel}>No-Shows</p>
            </div>
            <div style={{ ...styles.statCard, backgroundColor: '#fee2e2' }}>
              <p style={styles.statNumber}>{stats.open_disputes}</p>
              <p style={styles.statLabel}>Open Disputes</p>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div style={styles.content}>
          <div style={styles.tabHeader}>
            <h3 style={styles.sectionTitle}>All Users ({filteredUsers.length})</h3>
            <div style={styles.filterRow}>
              {['all', 'customer', 'worker', 'banned'].map((f) => (
                <button
                  key={f}
                  style={userFilter === f ? styles.filterBtnActive : styles.filterBtn}
                  onClick={() => setUserFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Warnings</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} style={{
                    ...styles.tableRow,
                    backgroundColor: u.is_banned ? '#fff5f5' : '#fff',
                  }}>
                    <td style={styles.td}>
                      <div style={styles.userName}>{u.full_name}</div>
                      {u.is_banned && (
                        <div style={styles.banReason}>Banned: {u.ban_reason}</div>
                      )}
                    </td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}>{u.phone}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor:
                          u.role === 'admin' ? '#fef3c7' :
                          u.role === 'worker' ? '#dbeafe' : '#d1fae5',
                        color:
                          u.role === 'admin' ? '#92400e' :
                          u.role === 'worker' ? '#1d4ed8' : '#065f46',
                      }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: u.warn_count > 0 ? '#fef3c7' : '#f3f4f6',
                        color: u.warn_count > 0 ? '#92400e' : '#666',
                      }}>
                        {u.warn_count || 0} warnings
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: u.is_banned ? '#fee2e2' : '#d1fae5',
                        color: u.is_banned ? '#991b1b' : '#065f46',
                      }}>
                        {u.is_banned ? 'BANNED' : 'ACTIVE'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {u.role !== 'admin' && (
                        <div style={styles.actionBtns}>
                          {!u.is_banned && (
                            <button
                              style={styles.btnWarn}
                              onClick={() => warnUser(u.id, u.full_name)}
                            >
                              Warn
                            </button>
                          )}
                          {!u.is_banned && (
                            <button
                              style={styles.btnBan}
                              onClick={() => banUser(u.id, u.full_name)}
                            >
                              Ban
                            </button>
                          )}
                          {u.is_banned && (
                            <button
                              style={styles.btnUnban}
                              onClick={() => unbanUser(u.id, u.full_name)}
                            >
                              Unban
                            </button>
                          )}
                          {u.role === 'worker' && (
                            <button
                              style={styles.btnView}
                              onClick={() => navigate(`/worker/${u.id}`)}
                            >
                              Profile
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Jobs Tab */}
      {activeTab === 'jobs' && (
        <div style={styles.content}>
          <div style={styles.tabHeader}>
            <h3 style={styles.sectionTitle}>All Jobs ({filteredJobs.length})</h3>
            <div style={styles.filterRow}>
              {['all', 'open', 'assigned', 'in_progress', 'completed', 'cancelled'].map((f) => (
                <button
                  key={f}
                  style={jobFilter === f ? styles.filterBtnActive : styles.filterBtn}
                  onClick={() => setJobFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>Title</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Location</th>
                  <th style={styles.th}>Rate</th>
                  <th style={styles.th}>Urgency</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>View</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} style={styles.tableRow}>
                    <td style={styles.td}>{job.title}</td>
                    <td style={styles.td}>{job.customer_name}</td>
                    <td style={styles.td}>{job.labor_type}</td>
                    <td style={styles.td}>{job.location}</td>
                    <td style={styles.td}>Rs.{job.rate}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: job.urgency === 'urgent' ? '#fee2e2' : '#dbeafe',
                        color: job.urgency === 'urgent' ? '#991b1b' : '#1d4ed8',
                      }}>
                        {job.urgency.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: getJobStatusColor(job.status),
                        color: '#333',
                      }}>
                        {job.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                    <td style={styles.td}>
                      <button
                        style={styles.btnView}
                        onClick={() => navigate(`/job/${job.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disputes Tab */}
      {activeTab === 'disputes' && (
        <div style={styles.content}>
          <h3 style={styles.sectionTitle}>Disputes Management</h3>
          {disputes.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>✅</div>
              <p style={styles.emptyTitle}>No Disputes</p>
              <p style={styles.emptyText}>No disputes have been filed yet.</p>
            </div>
          ) : (
            <div style={styles.disputesGrid}>
              {disputes.map((dispute) => (
                <div key={dispute.id} style={{
                  ...styles.disputeCard,
                  borderLeft: dispute.status === 'open'
                    ? '4px solid #ef4444'
                    : '4px solid #10b981',
                }}>
                  <div style={styles.disputeHeader}>
                    <div style={styles.disputeHeaderLeft}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: dispute.status === 'open' ? '#fee2e2' : '#d1fae5',
                        color: dispute.status === 'open' ? '#991b1b' : '#065f46',
                      }}>
                        {dispute.status.toUpperCase()}
                      </span>
                      <h4 style={styles.disputeReason}>{dispute.reason}</h4>
                    </div>
                    <span style={styles.disputeDate}>
                      {new Date(dispute.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p style={styles.disputeDesc}>{dispute.description}</p>

                  <div style={styles.disputeParties}>
                    <div style={styles.partyBox}>
                      <p style={styles.partyLabel}>Reporter</p>
                      <p style={styles.partyName}>{dispute.reporter_name}</p>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: '#dbeafe', color: '#1d4ed8',
                      }}>
                        {dispute.reporter_role}
                      </span>
                    </div>
                    <div style={styles.vsText}>VS</div>
                    <div style={styles.partyBox}>
                      <p style={styles.partyLabel}>Reported</p>
                      <p style={styles.partyName}>{dispute.reported_name}</p>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: '#fee2e2', color: '#991b1b',
                      }}>
                        {dispute.reported_role}
                      </span>
                    </div>
                  </div>

                  {dispute.job_title && (
                    <p style={styles.disputeJob}>📋 Job: {dispute.job_title}</p>
                  )}

                  {dispute.resolution && (
                    <div style={styles.resolutionBox}>
                      <p style={styles.resolutionLabel}>✅ Resolution:</p>
                      <p style={styles.resolutionText}>{dispute.resolution}</p>
                    </div>
                  )}

                  {dispute.status === 'open' && (
                    <div style={styles.disputeActions}>
                      <button
                        style={styles.btnResolve}
                        onClick={() => resolveDispute(dispute.id)}
                      >
                        ✅ Resolve
                      </button>
                      <button
                        style={styles.btnWarn}
                        onClick={() => warnUser(dispute.reported_id, dispute.reported_name)}
                      >
                        ⚠️ Warn Reported
                      </button>
                      <button
                        style={styles.btnBan}
                        onClick={() => banUser(dispute.reported_id, dispute.reported_name)}
                      >
                        🚫 Ban Reported
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions Log Tab */}
      {activeTab === 'actions' && (
        <div style={styles.content}>
          <h3 style={styles.sectionTitle}>Admin Actions Log</h3>
          {actions.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📋</div>
              <p style={styles.emptyTitle}>No Actions Yet</p>
              <p style={styles.emptyText}>Admin actions will appear here.</p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.th}>Admin</th>
                    <th style={styles.th}>Action</th>
                    <th style={styles.th}>Target User</th>
                    <th style={styles.th}>Reason</th>
                    <th style={styles.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => (
                    <tr key={action.id} style={styles.tableRow}>
                      <td style={styles.td}>{action.admin_name}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          backgroundColor:
                            action.action_type === 'ban' ? '#fee2e2' :
                            action.action_type === 'unban' ? '#d1fae5' :
                            action.action_type === 'warn' ? '#fef3c7' : '#ede9fe',
                          color:
                            action.action_type === 'ban' ? '#991b1b' :
                            action.action_type === 'unban' ? '#065f46' :
                            action.action_type === 'warn' ? '#92400e' : '#4f46e5',
                        }}>
                          {action.action_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={styles.td}>{action.target_name || '-'}</td>
                      <td style={styles.td}>{action.reason}</td>
                      <td style={styles.td}>
                        {new Date(action.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    backgroundColor: '#1a1a2e', padding: '20px 30px', color: '#fff',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { margin: 0, fontSize: '22px', fontWeight: 'bold' },
  subtitle: { margin: '4px 0 0 0', color: '#a5b4fc', fontSize: '14px' },
  btnSecondary: {
    backgroundColor: 'transparent', color: '#fff', border: '1px solid #fff',
    padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
  },
  tabs: {
    display: 'flex', backgroundColor: '#fff',
    borderBottom: '1px solid #eee', padding: '0 20px', overflowX: 'auto',
  },
  tab: {
    padding: '14px 16px', border: 'none', backgroundColor: 'transparent',
    cursor: 'pointer', fontSize: '13px', color: '#666', whiteSpace: 'nowrap',
  },
  tabActive: {
    padding: '14px 16px', border: 'none', backgroundColor: 'transparent',
    cursor: 'pointer', fontSize: '13px', color: '#4f46e5',
    borderBottom: '3px solid #4f46e5', fontWeight: 'bold', whiteSpace: 'nowrap',
  },
  content: { padding: '30px' },
  sectionTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '20px' },
  tabHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
  },
  filterRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  filterBtn: {
    backgroundColor: '#f3f4f6', color: '#666', border: 'none',
    padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
  },
  filterBtnActive: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
  },
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px',
  },
  statCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '20px',
    textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  statNumber: { fontSize: '28px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 4px 0' },
  statLabel: { fontSize: '13px', color: '#666', margin: 0 },
  tableWrapper: { overflowX: 'auto', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' },
  tableHeader: { backgroundColor: '#1a1a2e' },
  th: { padding: '14px 16px', textAlign: 'left', color: '#fff', fontSize: '13px', fontWeight: 'bold' },
  tableRow: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '12px 16px', fontSize: '13px', color: '#333' },
  userName: { fontWeight: 'bold', color: '#1a1a2e' },
  banReason: { fontSize: '11px', color: '#991b1b', marginTop: '2px' },
  badge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
  },
  actionBtns: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  btnWarn: {
    backgroundColor: '#fef3c7', color: '#92400e', border: 'none',
    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
  },
  btnBan: {
    backgroundColor: '#fee2e2', color: '#991b1b', border: 'none',
    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
  },
  btnUnban: {
    backgroundColor: '#d1fae5', color: '#065f46', border: 'none',
    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
  },
  btnView: {
    backgroundColor: '#ede9fe', color: '#4f46e5', border: 'none',
    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
  },
  btnResolve: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
  },
  disputesGrid: { display: 'flex', flexDirection: 'column', gap: '16px' },
  disputeCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  disputeHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '8px',
  },
  disputeHeaderLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  disputeDate: { fontSize: '12px', color: '#999' },
  disputeReason: { fontSize: '15px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 },
  disputeDesc: { fontSize: '14px', color: '#555', marginBottom: '14px' },
  disputeParties: {
    display: 'flex', alignItems: 'center', gap: '16px',
    backgroundColor: '#f8f9fa', padding: '14px', borderRadius: '8px', marginBottom: '12px',
  },
  partyBox: { flex: 1, textAlign: 'center' },
  partyLabel: { fontSize: '11px', color: '#999', margin: '0 0 4px 0', textTransform: 'uppercase' },
  partyName: { fontSize: '15px', fontWeight: 'bold', color: '#333', margin: '0 0 4px 0' },
  vsText: { fontSize: '18px', fontWeight: 'bold', color: '#ef4444' },
  disputeJob: { fontSize: '13px', color: '#666', marginBottom: '12px' },
  resolutionBox: {
    backgroundColor: '#d1fae5', padding: '12px',
    borderRadius: '8px', marginBottom: '12px',
  },
  resolutionLabel: { fontSize: '12px', fontWeight: 'bold', color: '#065f46', margin: '0 0 4px 0' },
  resolutionText: { fontSize: '14px', color: '#333', margin: 0 },
  disputeActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  emptyState: {
    textAlign: 'center', padding: '60px', backgroundColor: '#fff',
    borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  emptyIcon: { fontSize: '48px', marginBottom: '16px' },
  emptyTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  emptyText: { color: '#666', fontSize: '15px' },
};

export default AdminDashboard;