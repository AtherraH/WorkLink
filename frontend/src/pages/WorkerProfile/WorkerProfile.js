import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const WorkerProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWorker();
  }, [userId]);

  const fetchWorker = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/workers/${userId}`);
      // Handle both response shapes: { worker } or { profile }
      const data = res.data.worker || res.data.profile || res.data;
      if (!data || (!data.full_name && !data.user_id)) {
        setError('Worker not found.');
        return;
      }
      // Normalise — ensure portfolio and skills always exist
      setWorker({
        ...data,
        skills: Array.isArray(data.skills) ? data.skills : [],
        portfolio: Array.isArray(data.portfolio) ? data.portfolio : [],
        rating: data.rating || 0,
        total_ratings: data.total_ratings || 0,
        is_online: data.is_online || false,
      });
    } catch (err) {
      console.error('Failed to fetch worker:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to load worker profile.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={styles.center}>Loading profile...</div>;
  if (error) return (
    <div style={styles.center}>
      <p style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</p>
      <button style={styles.backBtn} onClick={() => navigate(-1)}>← Go Back</button>
    </div>
  );
  if (!worker) return <div style={styles.center}>Worker not found.</div>;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate(-1)}>← Back</button>

      <div style={styles.profileCard}>
        <div style={styles.avatarCircle}>{worker.full_name?.charAt(0) || '?'}</div>
        <h1 style={styles.name}>{worker.full_name}</h1>
        <p style={styles.phone}>{worker.phone}</p>

        <div style={styles.badgeRow}>
          <span style={worker.is_online ? styles.badgeOnline : styles.badgeOffline}>
            {worker.is_online ? '🟢 Online' : '⚫ Offline'}
          </span>
        </div>

        <a href={`tel:${worker.phone}`} style={styles.btnCall}>📞 Call Worker</a>

        <div style={styles.ratingRow}>
          <span style={styles.ratingNumber}>⭐ {parseFloat(worker.rating).toFixed(1)}</span>
          <span style={styles.ratingLabel}>({worker.total_ratings} reviews)</span>
        </div>

        <div style={styles.skillsRow}>
          {worker.skills.length > 0
            ? worker.skills.map(skill => <span key={skill} style={styles.skillBadge}>{skill}</span>)
            : <span style={styles.noSkill}>No skills listed</span>
          }
        </div>
      </div>

      <div style={styles.portfolioSection}>
        <h2 style={styles.portfolioTitle}>Portfolio ({worker.portfolio.length} jobs)</h2>
        {worker.portfolio.length === 0 ? (
          <p style={styles.emptyText}>No portfolio items yet.</p>
        ) : (
          <div style={styles.portfolioGrid}>
            {worker.portfolio.map(item => (
              <div key={item.id} style={styles.portfolioCard}>
                <img src={item.photo_url} alt={item.job_title} style={styles.portfolioPhoto} />
                <p style={styles.portfolioJobTitle}>{item.job_title}</p>
                <p style={styles.portfolioDate}>{new Date(item.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f0f4f8', padding: '20px' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666', padding: '20px' },
  backBtn: { backgroundColor: '#f3f4f6', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', marginBottom: '20px', color: '#333' },
  profileCard: { backgroundColor: '#fff', borderRadius: '12px', padding: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center', maxWidth: '500px', margin: '0 auto 30px auto' },
  avatarCircle: { width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', margin: '0 auto 16px auto' },
  name: { fontSize: '24px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  phone: { fontSize: '16px', color: '#666', margin: '0 0 12px 0' },
  badgeRow: { marginBottom: '12px' },
  badgeOnline: { display: 'inline-block', backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' },
  badgeOffline: { display: 'inline-block', backgroundColor: '#f3f4f6', color: '#666', padding: '4px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' },
  btnCall: { display: 'inline-block', backgroundColor: '#10b981', color: '#fff', padding: '10px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold', marginBottom: '16px' },
  ratingRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '12px 0' },
  ratingNumber: { fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' },
  ratingLabel: { fontSize: '14px', color: '#666' },
  skillsRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '12px' },
  skillBadge: { backgroundColor: '#ede9fe', color: '#4f46e5', padding: '4px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' },
  noSkill: { color: '#bbb', fontSize: '13px', fontStyle: 'italic' },
  portfolioSection: { maxWidth: '900px', margin: '0 auto' },
  portfolioTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '16px' },
  emptyText: { color: '#666', textAlign: 'center', padding: '40px' },
  portfolioGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' },
  portfolioCard: { backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  portfolioPhoto: { width: '100%', height: '160px', objectFit: 'cover' },
  portfolioJobTitle: { fontSize: '14px', fontWeight: 'bold', color: '#333', padding: '10px 12px 4px 12px', margin: 0 },
  portfolioDate: { fontSize: '12px', color: '#999', padding: '0 12px 10px 12px', margin: 0 },
};

export default WorkerProfile;