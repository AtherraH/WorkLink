import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const JobDetail = () => {
  const { jobId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null); // null=not applied, 'pending','accepted','rejected'

  useEffect(() => {
    fetchJob();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const fetchJob = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/jobs/${jobId}`);
      setJob(res.data.job);
      if (user && user.role === 'customer') {
        try {
          const sugRes = await axios.get(
            `http://localhost:5000/api/suggestions/workers/${jobId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setSuggestions(sugRes.data.suggested_workers);
        } catch (err) {
          console.error('Failed to fetch suggestions:', err.message);
        }
      }
      // If worker, check if they've already applied
      if (user && user.role === 'worker') {
        try {
          const myApps = await axios.get(
            'http://localhost:5000/api/applications/my-applications',
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const existing = (myApps.data.applications || []).find(a => a.job_id === jobId);
          if (existing) setApplicationStatus(existing.status || 'pending');
        } catch (e) {}
      }
    } catch (err) {
      console.error('Failed to fetch job:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyForJob = async () => {
    setApplying(true);
    try {
      await axios.post(
        `http://localhost:5000/api/applications/${jobId}/apply`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setApplicationStatus('pending');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to apply.');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div style={styles.center}>Loading job details...</div>;
  if (!job) return <div style={styles.center}>Job not found.</div>;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate(-1)}>
        Back
      </button>

      <div style={styles.content}>
        <div style={styles.jobCard}>
          {job.photo_url && (
            <img src={job.photo_url} alt="job" style={styles.jobPhoto} />
          )}

          <div style={styles.jobHeader}>
            <div>
              <span style={job.urgency === 'urgent' ? styles.urgentBadge : styles.scheduledBadge}>
                {job.urgency === 'urgent' ? 'URGENT' : 'SCHEDULED'}
              </span>
              <h1 style={styles.jobTitle}>{job.title}</h1>
            </div>
            <div style={styles.rateBox}>
              <p style={styles.rate}>Rs.{job.rate}</p>
              <p style={styles.rateLabel}>Rate</p>
            </div>
          </div>

          <div style={styles.detailsGrid}>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Labor Type</p>
              <p style={styles.detailValue}>{job.labor_type}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Location</p>
              <p style={styles.detailValue}>{job.location}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Workers Needed</p>
              <p style={styles.detailValue}>{job.workers_needed}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Status</p>
              <p style={styles.detailValue}>{job.status.toUpperCase()}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Posted By</p>
              <p style={styles.detailValue}>{job.customer_name}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Contact</p>
              <p style={styles.detailValue}>{job.customer_phone}</p>
            </div>
          </div>

          <div style={styles.descriptionBox}>
            <p style={styles.detailLabel}>Description</p>
            <p style={styles.description}>{job.description}</p>
          </div>

          <div style={styles.actionButtons}>
            {user && user.role === 'worker' && job.status === 'open' && (
              applicationStatus ? (
                <div style={{
                  padding: '12px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  backgroundColor: applicationStatus === 'accepted' ? '#d1fae5' : applicationStatus === 'rejected' ? '#fee2e2' : '#fef3c7',
                  color: applicationStatus === 'accepted' ? '#065f46' : applicationStatus === 'rejected' ? '#991b1b' : '#92400e',
                  border: `1.5px solid ${applicationStatus === 'accepted' ? '#6ee7b7' : applicationStatus === 'rejected' ? '#fca5a5' : '#fcd34d'}`,
                }}>
                  {applicationStatus === 'accepted' && '✅ You have been selected for this job!'}
                  {applicationStatus === 'rejected' && '❌ You were not selected for this job.'}
                  {applicationStatus === 'pending' && '⏳ Application Submitted — Under Review'}
                </div>
              ) : (
                <button
                  style={applying ? styles.btnDisabled : styles.btnApply}
                  onClick={applyForJob}
                  disabled={applying}
                >
                  {applying ? 'Applying...' : '✋ Apply for this Job'}
                </button>
              )
            )}
            {user && user.role === 'worker' && job.status !== 'open' && applicationStatus && (
              <div style={{
                padding: '12px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '14px',
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: applicationStatus === 'accepted' ? '#d1fae5' : applicationStatus === 'rejected' ? '#fee2e2' : '#fef3c7',
                color: applicationStatus === 'accepted' ? '#065f46' : applicationStatus === 'rejected' ? '#991b1b' : '#92400e',
                border: `1.5px solid ${applicationStatus === 'accepted' ? '#6ee7b7' : applicationStatus === 'rejected' ? '#fca5a5' : '#fcd34d'}`,
              }}>
                {applicationStatus === 'accepted' && '✅ You were selected — Job is now ' + job.status.replace('_',' ')}
                {applicationStatus === 'rejected' && '❌ You were not selected for this job.'}
                {applicationStatus === 'pending' && '⏳ Application Submitted — Under Review'}
              </div>
            )}
            <button
              style={styles.btnChat}
              onClick={() => navigate(`/chat/${jobId}`)}
            >
              💬 Chat
            </button>
            {user && user.role === 'customer' && (
              <button
                style={styles.btnTrack}
                onClick={() => navigate(`/track/${jobId}`)}
              >
                Track Worker
              </button>
            )}
          </div>
        </div>

        {user && user.role === 'customer' && suggestions.length > 0 && (
          <div style={styles.suggestionsSection}>
            <h2 style={styles.suggestionsTitle}>Suggested Workers for this Job</h2>
            <p style={styles.suggestionsSubtitle}>Ranked by skill match, rating and availability</p>
            <div style={styles.workersGrid}>
              {suggestions.map((worker, index) => (
                <div key={worker.id} style={styles.workerCard}>
                  <div style={styles.workerRank}>#{index + 1}</div>
                  <div style={styles.avatarCircle}>
                    {worker.full_name.charAt(0)}
                  </div>
                  <h4 style={styles.workerName}>{worker.full_name}</h4>
                  <p style={styles.workerMeta}>Rating: {parseFloat(worker.rating).toFixed(1)}</p>
                  <p style={styles.workerMeta}>Score: {worker.score} pts</p>
                  <p style={styles.workerMeta}>{worker.is_online ? 'Online' : 'Offline'}</p>
                  {worker.skill_matched && (
                    <span style={styles.matchBadge}>Skill Match</span>
                  )}
                  <div style={styles.skillsRow}>
                    {worker.skills.map((skill) => (
                      <span key={skill} style={styles.skillBadge}>{skill}</span>
                    ))}
                  </div>
                  <button
                    style={styles.btnViewProfile}
                    onClick={() => navigate(`/worker/${worker.id}`)}
                  >
                    View Profile
                  </button>
                </div>
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
    padding: '20px',
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
    maxWidth: '900px',
    margin: '0 auto',
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '30px',
  },
  jobPhoto: {
    width: '100%',
    height: '250px',
    objectFit: 'cover',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  jobHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  urgentBadge: {
    display: 'inline-block',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  scheduledBadge: {
    display: 'inline-block',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  jobTitle: {
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#1a1a2e',
    margin: '0',
  },
  rateBox: {
    backgroundColor: '#ede9fe',
    padding: '16px 24px',
    borderRadius: '12px',
    textAlign: 'center',
  },
  rate: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#4f46e5',
    margin: '0',
  },
  rateLabel: {
    fontSize: '12px',
    color: '#666',
    margin: '4px 0 0 0',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  detailItem: {
    backgroundColor: '#f8f9fa',
    padding: '12px 16px',
    borderRadius: '8px',
  },
  detailLabel: {
    fontSize: '12px',
    color: '#999',
    margin: '0 0 4px 0',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0',
  },
  descriptionBox: {
    backgroundColor: '#f8f9fa',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  description: {
    fontSize: '15px',
    color: '#444',
    lineHeight: '1.6',
    margin: '8px 0 0 0',
  },
  actionButtons: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  btnApply: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  btnDisabled: {
    backgroundColor: '#a5b4fc',
    color: '#fff',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '8px',
    cursor: 'not-allowed',
    fontSize: '16px',
  },
  btnChat: {
    backgroundColor: '#f3f4f6',
    color: '#333',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  _btnCall_removed: {
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  btnTrack: {
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  suggestionsSection: {
    marginTop: '10px',
  },
  suggestionsTitle: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: '4px',
  },
  suggestionsSubtitle: {
    color: '#666',
    fontSize: '14px',
    marginBottom: '20px',
  },
  workersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
  },
  workerCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    textAlign: 'center',
    position: 'relative',
  },
  workerRank: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    backgroundColor: '#4f46e5',
    color: '#fff',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  avatarCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#4f46e5',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 'bold',
    margin: '0 auto 10px auto',
  },
  workerName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1a1a2e',
    margin: '0 0 6px 0',
  },
  workerMeta: {
    fontSize: '13px',
    color: '#666',
    margin: '3px 0',
  },
  matchBadge: {
    display: 'inline-block',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 'bold',
    margin: '6px 0',
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
  btnViewProfile: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    marginTop: '8px',
    width: '100%',
  },
};

export default JobDetail;