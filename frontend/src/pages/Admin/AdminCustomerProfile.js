import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AdminCustomerProfile = () => {
  const { userId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fetchAll = async () => {
    try {
      // Get all users from admin endpoint and find this one
      const usersRes = await axios.get('http://localhost:5000/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const found = (usersRes.data.users || []).find((u) => u.id === userId);
      setCustomer(found || null);

      // Get all jobs and filter by this customer
      const jobsRes = await axios.get('http://localhost:5000/api/admin/jobs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs((jobsRes.data.jobs || []).filter((j) => j.customer_id === userId));

      // Get disputes involving this customer
      const disputesRes = await axios.get('http://localhost:5000/api/admin/disputes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDisputes(
        (disputesRes.data.disputes || []).filter(
          (d) => d.reporter_id === userId || d.reported_id === userId
        )
      );
    } catch (err) {
      console.error('Failed to fetch customer profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getJobStatusColor = (status) => {
    const map = {
      open: '#d1fae5', assigned: '#fef3c7',
      in_progress: '#dbeafe', completed: '#ede9fe', cancelled: '#fee2e2',
    };
    return map[status] || '#f3f4f6';
  };

  if (loading) return <div style={s.center}>Loading customer profile...</div>;
  if (!customer) return <div style={s.center}>Customer not found.</div>;

  const completedJobs = jobs.filter((j) => j.status === 'completed').length;
  const cancelledJobs = jobs.filter((j) => j.status === 'cancelled').length;
  const openDisputes = disputes.filter((d) => d.status === 'open').length;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/admin')}>← Admin Dashboard</button>
        <h2 style={s.title}>Customer Profile</h2>
        <span style={s.adminBadge}>🛡️ Admin View</span>
      </div>

      <div style={s.content}>
        {/* Profile Card */}
        <div style={s.card}>
          <div style={s.profileTop}>
            <div style={s.avatar}>{customer.full_name?.charAt(0).toUpperCase()}</div>
            <div style={s.profileInfo}>
              <h2 style={s.name}>{customer.full_name}</h2>
              <p style={s.email}>📧 {customer.email}</p>
              <p style={s.phone}>📞 {customer.phone}</p>
              <div style={s.badges}>
                <span style={{
                  ...s.badge,
                  background: customer.is_banned ? '#fee2e2' : '#d1fae5',
                  color: customer.is_banned ? '#991b1b' : '#065f46',
                }}>
                  {customer.is_banned ? '🚫 BANNED' : '✅ ACTIVE'}
                </span>
                {customer.warn_count > 0 && (
                  <span style={{ ...s.badge, background: '#fef3c7', color: '#92400e' }}>
                    ⚠️ {customer.warn_count} Warning{customer.warn_count > 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ ...s.badge, background: '#ede9fe', color: '#4f46e5' }}>
                  CUSTOMER
                </span>
              </div>
            </div>
          </div>

          {customer.is_banned && customer.ban_reason && (
            <div style={s.banBox}>
              <p style={s.banLabel}>Ban Reason:</p>
              <p style={s.banReason}>{customer.ban_reason}</p>
            </div>
          )}

          <div style={s.infoGrid}>
            <div style={s.infoItem}>
              <p style={s.infoLabel}>Member Since</p>
              <p style={s.infoValue}>
                {new Date(customer.created_at).toLocaleDateString([], {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            </div>
            <div style={s.infoItem}>
              <p style={s.infoLabel}>Total Jobs Posted</p>
              <p style={s.infoValue}>{jobs.length}</p>
            </div>
            <div style={s.infoItem}>
              <p style={s.infoLabel}>Completed Jobs</p>
              <p style={{ ...s.infoValue, color: '#065f46' }}>{completedJobs}</p>
            </div>
            <div style={s.infoItem}>
              <p style={s.infoLabel}>Cancelled Jobs</p>
              <p style={{ ...s.infoValue, color: cancelledJobs > 0 ? '#991b1b' : '#333' }}>
                {cancelledJobs}
              </p>
            </div>
            <div style={s.infoItem}>
              <p style={s.infoLabel}>Open Disputes</p>
              <p style={{ ...s.infoValue, color: openDisputes > 0 ? '#dc2626' : '#333' }}>
                {openDisputes}
              </p>
            </div>
            <div style={s.infoItem}>
              <p style={s.infoLabel}>Total Disputes</p>
              <p style={s.infoValue}>{disputes.length}</p>
            </div>
          </div>
        </div>

        {/* Jobs */}
        <div style={s.card}>
          <h3 style={s.cardTitle}>📋 Job History ({jobs.length})</h3>
          {jobs.length === 0 ? (
            <p style={s.empty}>No jobs posted yet.</p>
          ) : (
            <div style={s.tableWrapper}>
              <table style={s.table}>
                <thead>
                  <tr style={s.tableHead}>
                    <th style={s.th}>Title</th>
                    <th style={s.th}>Type</th>
                    <th style={s.th}>Location</th>
                    <th style={s.th}>Rate</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Date</th>
                    <th style={s.th}>View</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} style={s.tableRow}>
                      <td style={s.td}>{job.title}</td>
                      <td style={s.td}>{job.labor_type}</td>
                      <td style={s.td}>{job.location}</td>
                      <td style={s.td}>Rs.{job.rate}</td>
                      <td style={s.td}>
                        <span style={{
                          ...s.badge,
                          background: getJobStatusColor(job.status),
                          color: '#333',
                        }}>
                          {job.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={s.td}>
                        {new Date(job.created_at).toLocaleDateString()}
                      </td>
                      <td style={s.td}>
                        <button
                          style={s.btnView}
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
          )}
        </div>

        {/* Disputes */}
        <div style={s.card}>
          <h3 style={s.cardTitle}>⚠️ Dispute History ({disputes.length})</h3>
          {disputes.length === 0 ? (
            <p style={s.empty}>No disputes on record.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {disputes.map((d) => {
                const isReporter = d.reporter_id === userId;
                return (
                  <div key={d.id} style={{
                    ...s.disputeCard,
                    borderLeft: d.status === 'open' ? '4px solid #ef4444' : '4px solid #10b981',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{
                          ...s.badge,
                          background: d.status === 'open' ? '#fee2e2' : '#d1fae5',
                          color: d.status === 'open' ? '#991b1b' : '#065f46',
                          marginRight: '8px',
                        }}>
                          {d.status.toUpperCase()}
                        </span>
                        <span style={{ ...s.badge, background: '#ede9fe', color: '#4f46e5' }}>
                          {isReporter ? 'REPORTER' : 'REPORTED'}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        {new Date(d.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ fontWeight: 'bold', color: '#1a1a2e', margin: '8px 0 4px 0' }}>
                      {d.reason}
                    </p>
                    <p style={{ fontSize: '13px', color: '#555', margin: '0 0 8px 0' }}>
                      {d.description}
                    </p>
                    {d.job_title && (
                      <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>
                        📋 Job: {d.job_title}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={s.btnChat}
                        onClick={() => navigate(`/dispute-chat/${d.id}`)}
                      >
                        💬 View Chat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666' },
  header: {
    backgroundColor: '#1a1a2e', padding: '16px 30px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: {
    backgroundColor: 'transparent', color: '#a5b4fc',
    border: '1px solid #a5b4fc', padding: '8px 16px',
    borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
  },
  title: { color: '#fff', fontSize: '20px', fontWeight: 'bold', margin: 0 },
  adminBadge: {
    backgroundColor: '#fef3c7', color: '#92400e',
    padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold',
  },
  content: { padding: '30px', maxWidth: '900px', margin: '0 auto' },
  card: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px',
  },
  cardTitle: { fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '16px' },
  profileTop: { display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '20px' },
  avatar: {
    width: '72px', height: '72px', borderRadius: '50%',
    backgroundColor: '#10b981', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '28px', fontWeight: 'bold', flexShrink: 0,
  },
  profileInfo: { flex: 1 },
  name: { fontSize: '22px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 6px 0' },
  email: { fontSize: '14px', color: '#555', margin: '0 0 4px 0' },
  phone: { fontSize: '14px', color: '#555', margin: '0 0 10px 0' },
  badges: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  badge: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
  },
  banBox: { backgroundColor: '#fee2e2', padding: '12px', borderRadius: '8px', marginBottom: '16px' },
  banLabel: { fontSize: '11px', fontWeight: 'bold', color: '#991b1b', margin: '0 0 4px 0' },
  banReason: { fontSize: '14px', color: '#7f1d1d', margin: 0 },
  infoGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px',
  },
  infoItem: { backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '8px' },
  infoLabel: { fontSize: '11px', color: '#999', margin: '0 0 4px 0', textTransform: 'uppercase' },
  infoValue: { fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 },
  tableWrapper: { overflowX: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' },
  tableHead: { backgroundColor: '#1a1a2e' },
  th: { padding: '12px 14px', textAlign: 'left', color: '#fff', fontSize: '12px', fontWeight: 'bold' },
  tableRow: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 14px', fontSize: '13px', color: '#333' },
  empty: { color: '#999', fontStyle: 'italic', textAlign: 'center', padding: '20px' },
  disputeCard: {
    backgroundColor: '#fff', borderRadius: '10px', padding: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  btnView: {
    backgroundColor: '#ede9fe', color: '#4f46e5', border: 'none',
    padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
  },
  btnChat: {
    backgroundColor: '#dc2626', color: '#fff', border: 'none',
    padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
  },
};

export default AdminCustomerProfile;