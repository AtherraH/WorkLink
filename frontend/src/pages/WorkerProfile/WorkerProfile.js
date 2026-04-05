import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const WorkerProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorker();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fetchWorker = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/workers/${userId}`);
      setWorker(res.data.worker);
      try {
        const rRes = await axios.get(`http://localhost:5000/api/ratings/worker/${userId}`);
        setRatings(rRes.data.ratings || []);
      } catch (e) {}
    } catch (err) {
      console.error('Failed to fetch worker:', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={styles.center}>Loading profile...</div>;
  if (!worker) return <div style={styles.center}>Worker not found.</div>;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate(-1)}>
        Back
      </button>

      {/* Profile Header */}
      <div style={styles.profileCard}>
        <div style={styles.avatarCircle}>
          {worker.full_name.charAt(0)}
        </div>
        <h1 style={styles.name}>{worker.full_name}</h1>
        <p style={styles.phone}>{worker.phone}</p>

        <span style={worker.is_online ? styles.badgeOnline : styles.badgeOffline}>
          {worker.is_online ? 'Online' : 'Offline'}
        </span>

        <div style={styles.ratingRow}>
          <span style={styles.ratingNumber}>
            {parseFloat(worker.rating).toFixed(1)}
          </span>
          <span style={styles.ratingLabel}>
            ({worker.total_ratings} reviews)
          </span>
        </div>

        {/* Skills */}
        <div style={styles.skillsRow}>
          {worker.skills.map((skill) => (
            <span key={skill} style={styles.skillBadge}>{skill}</span>
          ))}
        </div>

        {/* Hourly Rate */}
        {worker.hourly_rate && (
          <div style={styles.hourlyRateBox}>
            <span style={styles.hourlyRateLabel}>Hourly Rate</span>
            <span style={styles.hourlyRateValue}>Rs.{worker.hourly_rate}/hr</span>
          </div>
        )}
      </div>

      {/* About Me */}
      {worker.bio && (
        <div style={styles.bioSection}>
          <h2 style={styles.bioTitle}>About Me</h2>
          <p style={styles.bioText}>{worker.bio}</p>
        </div>
      )}

      <ReviewsSection ratings={ratings} />

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
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    textAlign: 'center',
    maxWidth: '500px',
    margin: '0 auto 30px auto',
  },
  avatarCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#4f46e5',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: 'bold',
    margin: '0 auto 16px auto',
  },
  name: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1a1a2e',
    margin: '0 0 8px 0',
  },
  phone: {
    fontSize: '16px',
    color: '#666',
    margin: '0 0 12px 0',
  },

  badgeOnline: {
    display: 'inline-block',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '4px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 'bold',
    marginBottom: '12px',
    marginLeft: '10px',
  },
  badgeOffline: {
    display: 'inline-block',
    backgroundColor: '#f3f4f6',
    color: '#666',
    padding: '4px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 'bold',
    marginBottom: '12px',
    marginLeft: '10px',
  },
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    margin: '12px 0',
  },
  ratingNumber: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  ratingLabel: {
    fontSize: '14px',
    color: '#666',
  },
  skillsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    marginTop: '12px',
  },
  skillBadge: {
    backgroundColor: '#ede9fe',
    color: '#4f46e5',
    padding: '4px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  bioSection: {
    maxWidth: '500px',
    margin: '0 auto 24px auto',
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px 30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  bioTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1a1a2e',
    margin: '0 0 10px 0',
    textAlign: 'left',
  },
  bioText: {
    fontSize: '15px',
    color: '#444',
    lineHeight: '1.7',
    margin: 0,
    textAlign: 'left',
  },
  hourlyRateBox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#d1fae5',
    borderRadius: '20px',
    padding: '6px 16px',
    marginTop: '12px',
  },
  hourlyRateLabel: {
    fontSize: '12px',
    color: '#065f46',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  hourlyRateValue: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#065f46',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: '40px',
  },
};

const ReviewsSection = ({ ratings }) => (
  <div style={{ padding: '0 30px 30px 30px' }}>
    <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 16px 0' }}>
      ⭐ Customer Reviews ({ratings.length})
    </h2>
    {ratings.length === 0 ? (
      <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No reviews yet.</p>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {ratings.map((r, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: '12px', padding: '16px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '15px',
                }}>
                  {r.customer_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#1a1a2e' }}>{r.customer_name}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{r.job_title}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, color: '#f59e0b', fontSize: '16px' }}>
                  {'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                  {new Date(r.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
            {r.review && (
              <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: '1.5', fontStyle: 'italic' }}>
                "{r.review}"
              </p>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default WorkerProfile;