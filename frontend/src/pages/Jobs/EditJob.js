import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const laborTypes = [
  'plumbing', 'electrical', 'cleaning', 'gardening',
  'painting', 'carpentry', 'moving', 'cooking',
  'driving', 'security', 'tutoring', 'other',
];

const EditJob = () => {
  const { jobId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    rate: '',
    location: '',
    labor_type: '',
    urgency: 'urgent',
    workers_needed: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const fetchJob = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/jobs/${jobId}`);
      const job = res.data.job;
      setForm({
        title: job.title,
        description: job.description,
        rate: job.rate,
        location: job.location,
        labor_type: job.labor_type,
        urgency: job.urgency,
        workers_needed: job.workers_needed,
      });
    } catch (err) {
      console.error('Failed to fetch job:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await axios.put(
        `http://localhost:5000/api/jobs/${jobId}`,
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Job updated successfully!');
      navigate('/customer-dashboard');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update job.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={styles.center}>Loading job...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          Back
        </button>
        <h2 style={styles.title}>Edit Job</h2>
        <p style={styles.subtitle}>Only open jobs can be edited</p>

        <label style={styles.label}>Job Title</label>
        <input
          style={styles.input}
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. Fix kitchen sink"
        />

        <label style={styles.label}>Labor Type</label>
        <select
          style={styles.input}
          name="labor_type"
          value={form.labor_type}
          onChange={handleChange}
        >
          {laborTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <label style={styles.label}>Description</label>
        <textarea
          style={{ ...styles.input, height: '100px', resize: 'vertical' }}
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Describe the task in detail..."
        />

        <label style={styles.label}>Rate (Rs.)</label>
        <input
          style={styles.input}
          name="rate"
          type="number"
          value={form.rate}
          onChange={handleChange}
          placeholder="e.g. 500"
        />

        <label style={styles.label}>Location</label>
        <input
          style={styles.input}
          name="location"
          value={form.location}
          onChange={handleChange}
          placeholder="e.g. Koramangala, Bangalore"
        />

        <label style={styles.label}>Urgency</label>
        <select
          style={styles.input}
          name="urgency"
          value={form.urgency}
          onChange={handleChange}
        >
          <option value="urgent">Urgent</option>
          <option value="scheduled">Scheduled</option>
        </select>

        <label style={styles.label}>Workers Needed</label>
        <input
          style={styles.input}
          name="workers_needed"
          type="number"
          value={form.workers_needed}
          onChange={handleChange}
          min="1"
        />

        <div style={styles.buttons}>
          <button
            style={saving ? styles.btnDisabled : styles.btnSave}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            style={styles.btnCancel}
            onClick={() => navigate('/customer-dashboard')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh', backgroundColor: '#f0f4f8',
    padding: '30px', display: 'flex', justifyContent: 'center',
  },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666' },
  card: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '40px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', width: '100%', maxWidth: '560px',
    height: 'fit-content',
  },
  backBtn: {
    backgroundColor: '#f3f4f6', color: '#333', border: 'none',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '14px', marginBottom: '20px',
  },
  title: { fontSize: '24px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 4px 0' },
  subtitle: { color: '#666', fontSize: '14px', marginBottom: '24px' },
  label: {
    display: 'block', fontSize: '14px', fontWeight: 'bold',
    color: '#333', marginBottom: '6px',
  },
  input: {
    width: '100%', padding: '12px', marginBottom: '16px',
    borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px',
    boxSizing: 'border-box',
  },
  buttons: { display: 'flex', gap: '12px', marginTop: '8px' },
  btnSave: {
    flex: 1, backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '14px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '16px', fontWeight: 'bold',
  },
  btnDisabled: {
    flex: 1, backgroundColor: '#a5b4fc', color: '#fff', border: 'none',
    padding: '14px', borderRadius: '8px', cursor: 'not-allowed', fontSize: '16px',
  },
  btnCancel: {
    flex: 1, backgroundColor: '#f3f4f6', color: '#333', border: 'none',
    padding: '14px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px',
  },
};

export default EditJob;