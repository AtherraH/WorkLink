import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import VoiceInput from '../../components/VoiceInput';

const PostJob = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    labor_type: '',
    description: '',
    rate: '',
    location: '',
    urgency: 'urgent',
    scheduled_date: '',
    scheduled_hour: '12',
    scheduled_minute: '00',
    scheduled_ampm: 'AM',
    scheduled_time: '',
  });

  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if not a customer
  if (!user || user.role !== 'customer') {
    return (
      <div style={styles.center}>
        <p>Only customers can post jobs.</p>
      </div>
    );
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Called when voice input returns spoken text
  const handleVoiceResult = (spokenText) => {
    setFormData({ ...formData, description: spokenText });
  };

  const handlePhotoChange = (e) => {
    setPhoto(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use FormData because we're sending a photo
      const data = new FormData();
      data.append('title', formData.title);
      data.append('labor_type', formData.labor_type);
      data.append('description', formData.description);
      data.append('rate', formData.rate);
      data.append('location', formData.location);
      data.append('urgency', formData.urgency);
      if (formData.urgency === 'scheduled' && formData.scheduled_date) {
        // Convert 12h parts to 24h ISO datetime for the backend
        let hour = parseInt(formData.scheduled_hour, 10);
        if (formData.scheduled_ampm === 'PM' && hour !== 12) hour += 12;
        if (formData.scheduled_ampm === 'AM' && hour === 12) hour = 0;
        const hh = String(hour).padStart(2, '0');
        const scheduled_time = `${formData.scheduled_date}T${hh}:${formData.scheduled_minute}:00`;
        data.append('scheduled_time', scheduled_time);
      }
      if (photo) {
        data.append('photo', photo);
      }

      const res = await axios.post('http://localhost:5000/api/jobs', data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      alert('Job posted successfully!');
      navigate(`/job/${res.data.job.id}`);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post job.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5',
            fontWeight: '600', fontSize: '14px', padding: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => navigate('/customer-dashboard')}
        >
          ← Back to Dashboard
        </button>
        <h2 style={styles.title}>Post a Job</h2>
        <p style={styles.subtitle}>Describe what help you need</p>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <input
            style={styles.input}
            type="text"
            name="title"
            placeholder="Job Title (e.g. Fix leaking pipe)"
            value={formData.title}
            onChange={handleChange}
            required
          />

          <input
            style={styles.input}
            type="text"
            name="labor_type"
            placeholder="Labor Type (e.g. plumbing, electrical)"
            value={formData.labor_type}
            onChange={handleChange}
            required
          />

          {/* Voice Input Button */}
          <VoiceInput onResult={handleVoiceResult} />

          <textarea
            style={{ ...styles.input, height: '100px', resize: 'vertical' }}
            name="description"
            placeholder="Job Description (type or use voice above)"
            value={formData.description}
            onChange={handleChange}
            required
          />

          <input
            style={styles.input}
            type="number"
            name="rate"
            placeholder="Rate (₹ per hour or fixed)"
            value={formData.rate}
            onChange={handleChange}
            required
          />

          <input
            style={styles.input}
            type="text"
            name="location"
            placeholder="Location (e.g. Koramangala, Bangalore)"
            value={formData.location}
            onChange={handleChange}
            required
          />


          <select
            style={styles.input}
            name="urgency"
            value={formData.urgency}
            onChange={handleChange}
          >
            <option value="urgent">Urgent (ASAP)</option>
            <option value="scheduled">Scheduled (Pick a time)</option>
          </select>

          {/* Show date/time picker only for scheduled jobs */}
          {formData.urgency === 'scheduled' && (
            <div>
              <label style={styles.label}>Scheduled Date &amp; Time</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  style={{ ...styles.input, flex: '2', minWidth: '140px', marginBottom: 0 }}
                  type="date"
                  name="scheduled_date"
                  value={formData.scheduled_date}
                  onChange={handleChange}
                  required
                />
                <select
                  style={{ ...styles.input, flex: '1', minWidth: '70px', marginBottom: 0 }}
                  name="scheduled_hour"
                  value={formData.scheduled_hour}
                  onChange={handleChange}
                >
                  {Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(h=>(
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <select
                  style={{ ...styles.input, flex: '1', minWidth: '70px', marginBottom: 0 }}
                  name="scheduled_minute"
                  value={formData.scheduled_minute}
                  onChange={handleChange}
                >
                  {['00','15','30','45'].map(m=>(
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  style={{ ...styles.input, flex: '1', minWidth: '70px', marginBottom: 0 }}
                  name="scheduled_ampm"
                  value={formData.scheduled_ampm}
                  onChange={handleChange}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          )}

          {/* Photo upload */}
          <label style={styles.label}>Upload a photo of the task (optional):</label>
          <input
            style={styles.input}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
          />

          <button
            style={loading ? styles.buttonDisabled : styles.button}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Posting...' : 'Post Job'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f0f4f8',
    padding: '30px 20px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    padding: '30px',
    maxWidth: '500px',
    margin: '0 auto',
  },
  center: {
    textAlign: 'center',
    marginTop: '100px',
    fontSize: '18px',
    color: '#666',
  },
  title: {
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: '4px',
  },
  subtitle: {
    color: '#666',
    marginBottom: '24px',
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '14px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '15px',
    boxSizing: 'border-box',
  },
  label: {
    fontSize: '14px',
    color: '#555',
    marginBottom: '6px',
    display: 'block',
  },
  button: {
    width: '100%',
    padding: '13px',
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '6px',
  },
  buttonDisabled: {
    width: '100%',
    padding: '13px',
    backgroundColor: '#a5b4fc',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'not-allowed',
    marginTop: '6px',
  },
  error: {
    color: 'red',
    marginBottom: '12px',
    fontSize: '14px',
  },
};

export default PostJob;