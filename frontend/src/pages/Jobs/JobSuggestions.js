import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const JobSuggestions = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');
  const [workers, setWorkers] = useState([]);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (jobId) {
      fetchSuggestions();
      fetchJob();
    } else {
      setLoading(false);
    }
  }, [jobId]);

  const fetchJob = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJob(res.data.job);
    } catch (err) {
      console.error('Failed to fetch job:', err.message);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/suggestions/workers/${jobId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkers(res.data.suggested_workers || []);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={s.center}>Loading suggestions...</div>;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/customer-dashboard')}>← Dashboard</button>
        <h2 style={s.title}>AI Worker Suggestions</h2>
        <div />
      </div>

      {job && (
        <div style={s.jobBar}>
          <p style={s.jobBarTitle}>Suggestions for: <strong>{job.title}</strong></p>
          <p style={s.jobBarMeta}>🔧 {job.labor_type} &nbsp;|&nbsp; 📍 {job.location} &nbsp;|&nbsp; Rs.{job.rate}</p>
        </div>
      )}

      <div style={s.content}>
        <p style={s.subtitle}>
          {workers.length} workers ranked by skill match, rating, availability & proximity
        </p>

        {workers.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontSize: '48px', margin: 0 }}>🤖</p>
            <p style={s.emptyTitle}>No suggestions available yet</p>
            <p style={s.emptySub}>Make sure workers have created profiles and set their skills.</p>
            <button style={s.btnPrimary} onClick={() => navigate('/customer-dashboard')}>
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div style={s.grid}>
            {workers.map((worker, index) => (
              <div key={worker.id} style={s.card}>
                <div style={s.cardTop}>
                  <div style={s.rank}>#{index + 1}</div>
                  <div style={s.avatar}>{worker.full_name?.charAt(0)}</div>
                  <div style={s.workerInfo}>
                    <h3 style={s.workerName}>{worker.full_name}</h3>
                    <div style={s.badges}>
                      {worker.skill_matched && (
                        <span style={s.badgeGreen}>✓ Skill Match</span>
                      )}
                      {worker.is_online && (
                        <span style={s.badgeBlue}>🟢 Online</span>
                      )}
                    </div>
                  </div>
                  <div style={s.scoreCircle}>{worker.score}</div>
                </div>

                <div style={s.stats}>
                  <div style={s.stat}>
                    <p style={s.statVal}>⭐ {parseFloat(worker.rating || 0).toFixed(1)}</p>
                    <p style={s.statLbl}>Rating</p>
                  </div>
                  <div style={s.stat}>
                    <p style={s.statVal}>{worker.total_ratings || 0}</p>
                    <p style={s.statLbl}>Reviews</p>
                  </div>
                  <div style={s.stat}>
                    <p style={s.statVal}>{worker.completed_jobs || 0}</p>
                    <p style={s.statLbl}>Jobs Done</p>
                  </div>
                  {worker.hourly_rate && (
                    <div style={s.stat}>
                      <p style={s.statVal}>Rs.{worker.hourly_rate}</p>
                      <p style={s.statLbl}>Rate/hr</p>
                    </div>
                  )}
                </div>

                {worker.skills && worker.skills.length > 0 && (
                  <div style={s.skillsRow}>
                    {worker.skills.slice(0, 4).map((skill) => (
                      <span key={skill} style={s.skillBadge}>{skill}</span>
                    ))}
                  </div>
                )}

                {worker.bio && (
                  <p style={s.bio}>{worker.bio.substring(0, 80)}...</p>
                )}

                <div style={s.actions}>
                  <button
                    style={s.btnView}
                    onClick={() => navigate(`/worker/${worker.id}`)}
                  >
                    View Profile
                  </button>
                  {jobId && (
                    <button
                      style={s.btnSelect}
                      onClick={() => navigate(`/job-manage/${jobId}`)}
                    >
                      Manage Job
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666' },
  header: { backgroundColor: '#1a1a2e', padding: '16px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { backgroundColor: 'transparent', color: '#a5b4fc', border: '1px solid #a5b4fc', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  title: { color: '#fff', fontSize: '20px', fontWeight: 'bold', margin: 0 },
  jobBar: { backgroundColor: '#16213e', padding: '14px 30px', borderBottom: '1px solid #333' },
  jobBarTitle: { color: '#fff', fontSize: '15px', margin: '0 0 4px 0' },
  jobBarMeta: { color: '#a5b4fc', fontSize: '13px', margin: 0 },
  content: { padding: '30px', maxWidth: '900px', margin: '0 auto' },
  subtitle: { color: '#666', fontSize: '14px', marginBottom: '24px' },
  empty: { textAlign: 'center', padding: '60px', backgroundColor: '#fff', borderRadius: '16px' },
  emptyTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', margin: '16px 0 8px 0' },
  emptySub: { color: '#666', marginBottom: '20px' },
  btnPrimary: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  grid: { display: 'flex', flexDirection: 'column', gap: '16px' },
  card: { backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  cardTop: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' },
  rank: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f3f4f6', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 },
  avatar: { width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 'bold', flexShrink: 0 },
  workerInfo: { flex: 1 },
  workerName: { fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 6px 0' },
  badges: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  badgeGreen: { backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' },
  badgeBlue: { backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' },
  scoreCircle: { width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', flexShrink: 0 },
  stats: { display: 'flex', gap: '20px', marginBottom: '12px', flexWrap: 'wrap' },
  stat: { textAlign: 'center', minWidth: '60px' },
  statVal: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 2px 0' },
  statLbl: { fontSize: '11px', color: '#999', margin: 0, textTransform: 'uppercase' },
  skillsRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' },
  skillBadge: { backgroundColor: '#ede9fe', color: '#4f46e5', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' },
  bio: { color: '#666', fontSize: '13px', margin: '0 0 12px 0', lineHeight: '1.5' },
  actions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  btnView: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },

  btnSelect: { backgroundColor: '#f59e0b', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
};

export default JobSuggestions;