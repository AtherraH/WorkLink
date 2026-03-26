import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const BondStatus = () => {
  const { jobId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [bond, setBond] = useState(null);
  const [emergency, setEmergency] = useState(null);
  const [noShowStatus, setNoShowStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, [jobId]);

  const fetchAll = async () => {
    try {
      const [bondRes, noShowRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/bonds/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`http://localhost:5000/api/emergency/check/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setBond(bondRes.data.bond);
      setNoShowStatus(noShowRes.data);
    } catch (err) {
      console.error('Failed to fetch bond/emergency:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerEmergency = async () => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/emergency/trigger/${jobId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmergency(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to trigger emergency.');
    }
  };

  const forfeitBond = async () => {
    if (!window.confirm('Are you sure? This will mark the worker as no-show.')) return;
    try {
      const res = await axios.put(
        `http://localhost:5000/api/bonds/${jobId}/forfeit`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to report no-show.');
    }
  };

  const getBondStatusColor = (status) => {
    const colors = {
      active: '#d1fae5',
      forfeited: '#fee2e2',
      released: '#dbeafe',
    };
    return colors[status] || '#f3f4f6';
  };

  const getBondStatusTextColor = (status) => {
    const colors = {
      active: '#065f46',
      forfeited: '#991b1b',
      released: '#1d4ed8',
    };
    return colors[status] || '#333';
  };

  if (loading) return <div style={styles.center}>Loading status...</div>;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate(-1)}>
        Back
      </button>

      <div style={styles.content}>
        <h2 style={styles.pageTitle}>Worker Reliability & Emergency Status</h2>

        {/* Bond Card */}
        {bond ? (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Worker Commitment Status</h3>
            <div style={styles.bondGrid}>
              <div style={styles.bondItem}>
                <p style={styles.bondLabel}>Job</p>
                <p style={styles.bondValue}>{bond.job_title}</p>
              </div>
              <div style={styles.bondItem}>
                <p style={styles.bondLabel}>Worker</p>
                <p style={styles.bondValue}>{bond.worker_name}</p>
              </div>
              <div style={styles.bondItem}>
                <p style={styles.bondLabel}>No-Show Risk</p>
                <p style={styles.bondValue}>{bond.no_show_probability}%</p>
              </div>
              <div style={styles.bondItem}>
                <p style={styles.bondLabel}>Status</p>
                <span style={{
                  ...styles.statusBadge,
                  backgroundColor: getBondStatusColor(bond.status),
                  color: getBondStatusTextColor(bond.status),
                }}>
                  {bond.status.toUpperCase()}
                </span>
              </div>
            </div>
            {bond.status === 'active' && (
              <button style={styles.btnForfeit} onClick={forfeitBond}>
                Report Worker No-Show
              </button>
            )}
          </div>
        ) : (
          <div style={styles.card}>
            <p style={styles.emptyText}>No commitment record found for this job.</p>
          </div>
        )}

        {/* No-Show Status */}
        {noShowStatus && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Worker Arrival Status</h3>
            <div style={noShowStatus.is_late ? styles.lateAlert : styles.okAlert}>
              <p style={styles.alertText}>{noShowStatus.message}</p>
              {noShowStatus.minutes_elapsed !== undefined && (
                <p style={styles.alertSubtext}>
                  Time elapsed: {noShowStatus.minutes_elapsed} minutes
                </p>
              )}
            </div>
            {noShowStatus.is_late && (
              <button style={styles.btnEmergency} onClick={triggerEmergency}>
                Trigger Emergency Backup
              </button>
            )}
          </div>
        )}

        {/* Emergency Backup Workers */}
        {emergency && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Emergency Backup Workers</h3>
            <p style={styles.emergencyMsg}>{emergency.message}</p>
            <div style={styles.workersGrid}>
              {emergency.backup_workers.map((worker) => (
                <div key={worker.id} style={styles.workerCard}>
                  <div style={styles.avatarCircle}>
                    {worker.full_name.charAt(0)}
                  </div>
                  <h4 style={styles.workerName}>{worker.full_name}</h4>
                  <p style={styles.workerMeta}>
                    Rating: {parseFloat(worker.rating).toFixed(1)}
                  </p>
                  <p style={styles.workerMeta}>Phone: {worker.phone}</p>
                  <div style={styles.skillsRow}>
                    {worker.skills.map((skill) => (
                      <span key={skill} style={styles.skillBadge}>{skill}</span>
                    ))}
                  </div>
                  <button
                    style={styles.btnChoose}
                    onClick={async () => {
                      try {
                        const res = await axios.put(
                          `http://localhost:5000/api/emergency/${jobId}/choose/${worker.id}`,
                          {},
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        alert(`Backup worker assigned! New OTP: ${res.data.new_otp}`);
                        navigate('/customer-dashboard');
                      } catch (err) {
                        alert('Failed to choose backup worker.');
                      }
                    }}
                  >
                    Choose This Worker
                  </button>
                </div>
              ))}
            </div>
            <div style={styles.optionsBox}>
              <p style={styles.optionsTitle}>Your Options:</p>
              {emergency.customer_options.map((option, i) => (
                <p key={i} style={styles.optionItem}>{option}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f0f4f8',
    padding: '20px 30px',
  },
  center: {
    textAlign: 'center',
    marginTop: '100px',
    fontSize: '18px',
    color: '#666',
  },
  backBtn: {
    backgroundColor: '#f3f4f6',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    marginBottom: '20px',
    color: '#333',
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: '24px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: '16px',
  },
  bondGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  bondItem: {
    backgroundColor: '#f8f9fa',
    padding: '12px',
    borderRadius: '8px',
  },
  bondLabel: {
    fontSize: '11px',
    color: '#999',
    margin: '0 0 4px 0',
    textTransform: 'uppercase',
  },
  bondValue: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  btnForfeit: {
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  lateAlert: {
    backgroundColor: '#fee2e2',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  okAlert: {
    backgroundColor: '#d1fae5',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  alertText: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0',
  },
  alertSubtext: {
    fontSize: '13px',
    color: '#666',
    margin: '6px 0 0 0',
  },
  btnEmergency: {
    backgroundColor: '#f59e0b',
    color: '#fff',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  emergencyMsg: {
    color: '#065f46',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  workersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  workerCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
  },
  avatarCircle: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    backgroundColor: '#4f46e5',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '0 auto 10px auto',
  },
  workerName: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#1a1a2e',
    margin: '0 0 4px 0',
  },
  workerMeta: {
    fontSize: '13px',
    color: '#666',
    margin: '3px 0',
  },
  skillsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    justifyContent: 'center',
    margin: '8px 0',
  },
  skillBadge: {
    backgroundColor: '#ede9fe',
    color: '#4f46e5',
    padding: '2px 8px',
    borderRadius: '20px',
    fontSize: '11px',
  },
  btnChoose: {
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    marginTop: '8px',
    width: '100%',
  },
  optionsBox: {
    backgroundColor: '#f8f9fa',
    padding: '16px',
    borderRadius: '8px',
  },
  optionsTitle: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '8px',
  },
  optionItem: {
    fontSize: '14px',
    color: '#555',
    margin: '4px 0',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
  },
};

export default BondStatus;
