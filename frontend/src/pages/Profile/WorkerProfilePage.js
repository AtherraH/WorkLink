import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MapRecenter = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 15); }, [lat, lng]); // eslint-disable-line
  return null;
};

const allSkills = ['plumbing', 'electrical', 'cleaning', 'gardening', 'painting', 'carpentry', 'moving', 'cooking', 'driving', 'security', 'tutoring', 'other'];

const WorkerProfilePage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [form, setForm] = useState({ full_name: '', phone: '', bio: '', hourly_rate: '', skills: [] });
  const [myLocation, setMyLocation] = useState(null);  // { latitude, longitude }
  const [locSharing, setLocSharing] = useState(false);
  const [locError, setLocError] = useState('');
  const [lastLocUpdate, setLastLocUpdate] = useState(null);
  const watchRef = useRef(null);

  useEffect(() => {
    fetchProfile();
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/workers/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(res.data.profile);
      setForm({
        full_name: res.data.profile.full_name || '',
        phone: res.data.profile.phone || '',
        bio: res.data.profile.bio || '',
        hourly_rate: res.data.profile.hourly_rate || '',
        skills: res.data.profile.skills || [],
      });
    } catch (err) {
      console.error('Failed to fetch profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await axios.put(
        'http://localhost:5000/api/workers/profile',
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Profile updated!');
      setEditing(false);
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  // Start GPS location sharing — saves to DB + shows on map
  const startLocationSharing = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    setLocError('');
    setLocSharing(true);
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        console.log(`[GPS] lat=${latitude.toFixed(6)}, lng=${longitude.toFixed(6)}, accuracy=${accuracy}m`);
        setMyLocation({ latitude, longitude, accuracy });
        setLastLocUpdate(new Date().toLocaleTimeString());
        try {
          await axios.put(
            'http://localhost:5000/api/workers/location',
            { latitude, longitude },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (e) { console.error('Location save failed:', e.message); }
      },
      (err) => {
        console.error('[GPS Error]', err.code, err.message);
        const msgs = {
          1: 'Location permission denied. Please allow location access in your browser.',
          2: 'Location unavailable. Try moving to an open area.',
          3: 'Location request timed out. Retrying...',
        };
        setLocError(msgs[err.code] || err.message);
        setLocSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const stopLocationSharing = () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setLocSharing(false);
  };

  // One-shot: get current GPS position and show on map (no continuous sharing)
  const detectLocation = () => {
    if (!navigator.geolocation) { setLocError('Geolocation not supported.'); return; }
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        console.log(`[GPS Detect] lat=${latitude.toFixed(6)}, lng=${longitude.toFixed(6)}, accuracy=${accuracy}m`);
        setMyLocation({ latitude, longitude, accuracy });
        setLastLocUpdate(new Date().toLocaleTimeString());
        try {
          await axios.put(
            'http://localhost:5000/api/workers/location',
            { latitude, longitude },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (e) {}
      },
      (err) => {
        const msgs = { 1: 'Permission denied.', 2: 'Position unavailable.', 3: 'Timed out.' };
        setLocError(msgs[err.code] || err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Load saved location from DB on mount
  useEffect(() => {
    if (profile?.latitude && profile?.longitude) {
      setMyLocation({ latitude: parseFloat(profile.latitude), longitude: parseFloat(profile.longitude) });
    }
  }, [profile]);

  const toggleSkill = (skill) => {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  if (loading) return <div style={s.center}>Loading profile...</div>;
  if (!profile) return <div style={s.center}>Profile not found.</div>;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/worker-dashboard')}>← Dashboard</button>
        <h2 style={s.headerTitle}>My Profile</h2>
        <div />
      </div>

      {/* Profile Card */}
      <div style={s.profileSection}>
        <div style={s.profileCard}>
          <div style={s.profileTop}>
            <div style={s.avatarBox}>
              <div style={s.avatar}>{user.full_name.charAt(0)}</div>
              <div style={{
                ...s.onlineDot,
                backgroundColor: profile.is_online ? '#10b981' : '#9ca3af',
              }} />
            </div>
            <div style={s.profileInfo}>
              {editing ? (
                <input style={s.nameInput} value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })} />
              ) : (
                <h2 style={s.profileName}>{profile.full_name}</h2>
              )}
              <span style={s.workerBadge}>WORKER</span>
              <span style={{ ...s.onlineBadge, backgroundColor: profile.is_online ? '#d1fae5' : '#f3f4f6', color: profile.is_online ? '#065f46' : '#666' }}>
                {profile.is_online ? '🟢 Online' : '⚫ Offline'}
              </span>
            </div>
            <div style={s.ratingBox}>
              <p style={s.ratingNum}>⭐ {parseFloat(profile.rating || 0).toFixed(1)}</p>
              <p style={s.ratingLbl}>{profile.total_ratings || 0} reviews</p>
            </div>
          </div>

          {/* Bio */}
          <div style={s.bioBox}>
            <p style={s.bioLabel}>About Me</p>
            {editing ? (
              <textarea style={s.bioInput} rows={3} value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell customers about yourself..." />
            ) : (
              <p style={s.bioText}>{profile.bio || 'No bio added yet.'}</p>
            )}
          </div>

          {/* Skills */}
          <div style={s.skillsSection}>
            <p style={s.skillsLabel}>Skills</p>
            {editing ? (
              <div style={s.skillsGrid}>
                {allSkills.map(sk => (
                  <button key={sk}
                    style={{
                      ...s.skillToggle,
                      backgroundColor: form.skills.includes(sk) ? '#4f46e5' : '#f3f4f6',
                      color: form.skills.includes(sk) ? '#fff' : '#333',
                    }}
                    onClick={() => toggleSkill(sk)}
                  >
                    {sk}
                  </button>
                ))}
              </div>
            ) : (
              <div style={s.skillsRow}>
                {(profile.skills || []).map(sk => (
                  <span key={sk} style={s.skillTag}>{sk}</span>
                ))}
                {(!profile.skills || profile.skills.length === 0) && (
                  <p style={{ color: '#999', fontSize: '14px' }}>No skills added yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Rate & Phone */}
          <div style={s.detailsRow}>
            <div style={s.detailBox}>
              <p style={s.detailLbl}>Hourly Rate</p>
              {editing ? (
                <input style={s.detailInput} value={form.hourly_rate}
                  onChange={e => setForm({ ...form, hourly_rate: e.target.value })}
                  placeholder="e.g. 200" type="number" />
              ) : (
                <p style={s.detailVal}>Rs.{profile.hourly_rate || 'Not set'}</p>
              )}
            </div>
            <div style={s.detailBox}>
              <p style={s.detailLbl}>Phone</p>
              {editing ? (
                <input style={s.detailInput} value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} />
              ) : (
                <p style={s.detailVal}>{profile.phone}</p>
              )}
            </div>
            <div style={s.detailBox}>
              <p style={s.detailLbl}>Email</p>
              <p style={s.detailVal}>{profile.email}</p>
            </div>
            <div style={s.detailBox}>
              <p style={s.detailLbl}>Member Since</p>
              <p style={s.detailVal}>{new Date(profile.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Edit Buttons */}
          <div style={s.editBtns}>
            {editing ? (
              <>
                <button style={saving ? s.btnDisabled : s.btnSave} onClick={saveProfile} disabled={saving}>
                  {saving ? 'Saving...' : '💾 Save Changes'}
                </button>
                <button style={s.btnCancel} onClick={() => setEditing(false)}>Cancel</button>
              </>
            ) : (
              <button style={s.btnEdit} onClick={() => setEditing(true)}>✏️ Edit Profile</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          {[
            { num: profile.total_ratings || 0, lbl: 'Reviews', color: '#fef3c7' },
            { num: parseFloat(profile.rating || 0).toFixed(1), lbl: 'Rating', color: '#d1fae5' },
            { num: profile.hourly_rate ? `Rs.${profile.hourly_rate}` : 'N/A', lbl: 'Hourly Rate', color: '#dbeafe' },
            { num: (profile.skills || []).length, lbl: 'Skills', color: '#ede9fe' },
          ].map(stat => (
            <div key={stat.lbl} style={{ ...s.statCard, backgroundColor: stat.color }}>
              <p style={s.statNum}>{stat.num}</p>
              <p style={s.statLbl}>{stat.lbl}</p>
            </div>
          ))}
        </div>
      </div>

      {/* My Location Map */}
      <div style={s.locationSection}>
        <div style={s.locationCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={s.locationTitle}>📍 My Location</h3>
              <p style={s.locationSub}>Share your GPS location so customers can find you nearby</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={detectLocation} style={s.btnDetect}>🎯 Detect Location</button>
              {!locSharing ? (
                <button onClick={startLocationSharing} style={s.btnShare}>🟢 Share Live</button>
              ) : (
                <button onClick={stopLocationSharing} style={s.btnStop}>🔴 Stop Sharing</button>
              )}
            </div>
          </div>

          {locError && (
            <div style={s.locErrorBox}>⚠️ {locError}</div>
          )}

          {locSharing && (
            <div style={s.locActiveBar}>
              <span style={s.livePulse} />
              <span style={{ color: '#065f46', fontWeight: '600', fontSize: '13px' }}>
                LIVE — Location updating continuously
              </span>
              {lastLocUpdate && <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>Last: {lastLocUpdate}</span>}
            </div>
          )}

          {myLocation ? (
            <>
              <div style={s.coordRow}>
                <span style={s.coordBadge}>Lat: {parseFloat(myLocation.latitude).toFixed(6)}</span>
                <span style={s.coordBadge}>Lng: {parseFloat(myLocation.longitude).toFixed(6)}</span>
                {myLocation.accuracy && <span style={{ ...s.coordBadge, backgroundColor: '#d1fae5' }}>±{Math.round(myLocation.accuracy)}m</span>}
              </div>
              <div style={{ borderRadius: '12px', overflow: 'hidden', marginTop: '12px' }}>
                <MapContainer
                  center={[parseFloat(myLocation.latitude), parseFloat(myLocation.longitude)]}
                  zoom={15}
                  style={{ height: '300px', width: '100%' }}
                  key={`${myLocation.latitude}-${myLocation.longitude}`}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <MapRecenter lat={parseFloat(myLocation.latitude)} lng={parseFloat(myLocation.longitude)} />
                  <Marker position={[parseFloat(myLocation.latitude), parseFloat(myLocation.longitude)]}>
                    <Popup>
                      <strong>📍 My Location</strong><br />
                      {parseFloat(myLocation.latitude).toFixed(5)}, {parseFloat(myLocation.longitude).toFixed(5)}
                      {myLocation.accuracy && <><br />Accuracy: ±{Math.round(myLocation.accuracy)}m</>}
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </>
          ) : (
            <div style={s.noLocBox}>
              <p style={{ fontSize: '36px', margin: '0 0 10px 0' }}>🗺️</p>
              <p style={s.noLocTitle}>No location set yet</p>
              <p style={s.noLocText}>Click "Detect Location" to find your current GPS position</p>
            </div>
          )}
        </div>
      </div>

      {/* Portfolio */}
      <div style={s.portfolioSection}>
        <h3 style={s.portfolioTitle}>📸 Portfolio</h3>
        {profile.portfolio_photos && profile.portfolio_photos.length > 0 ? (
          <div style={s.photoGrid}>
            {profile.portfolio_photos.map((photo, i) => (
              <img key={i} src={photo} alt={`portfolio ${i + 1}`} style={s.portfolioPhoto} />
            ))}
          </div>
        ) : (
          <div style={s.emptyPortfolio}>
            <p style={{ fontSize: '40px', margin: 0 }}>📷</p>
            <p style={s.emptyTitle}>No portfolio photos yet</p>
            <p style={s.emptyText}>Photos from completed jobs will appear here automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666' },
  header: { backgroundColor: '#1a1a2e', padding: '16px 30px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { backgroundColor: 'transparent', color: '#a5b4fc', border: '1px solid #a5b4fc', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  headerTitle: { fontSize: '20px', fontWeight: 'bold', margin: 0 },
  profileSection: { padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' },
  profileCard: { backgroundColor: '#fff', borderRadius: '16px', padding: '30px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  profileTop: { display: 'flex', alignItems: 'flex-start', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' },
  avatarBox: { position: 'relative', flexShrink: 0 },
  avatar: { width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold' },
  onlineDot: { position: 'absolute', bottom: '4px', right: '4px', width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #fff' },
  profileInfo: { flex: 1 },
  nameInput: { fontSize: '22px', fontWeight: 'bold', border: '2px solid #4f46e5', borderRadius: '8px', padding: '6px 12px', marginBottom: '8px', width: '100%' },
  profileName: { fontSize: '26px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  workerBadge: { display: 'inline-block', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', marginRight: '8px' },
  onlineBadge: { display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
  ratingBox: { textAlign: 'center' },
  ratingNum: { fontSize: '28px', fontWeight: 'bold', color: '#f59e0b', margin: 0 },
  ratingLbl: { fontSize: '13px', color: '#666', margin: '4px 0 0 0' },
  bioBox: { marginBottom: '20px' },
  bioLabel: { fontSize: '13px', fontWeight: 'bold', color: '#999', textTransform: 'uppercase', margin: '0 0 8px 0' },
  bioInput: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', resize: 'vertical', boxSizing: 'border-box' },
  bioText: { fontSize: '15px', color: '#444', lineHeight: '1.6', margin: 0 },
  skillsSection: { marginBottom: '20px' },
  skillsLabel: { fontSize: '13px', fontWeight: 'bold', color: '#999', textTransform: 'uppercase', margin: '0 0 10px 0' },
  skillsGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  skillToggle: { border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  skillsRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  skillTag: { backgroundColor: '#ede9fe', color: '#4f46e5', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' },
  detailsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' },
  detailBox: { backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px' },
  detailLbl: { fontSize: '11px', color: '#999', textTransform: 'uppercase', fontWeight: 'bold', margin: '0 0 4px 0' },
  detailVal: { fontSize: '15px', fontWeight: 'bold', color: '#333', margin: 0 },
  detailInput: { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  editBtns: { display: 'flex', gap: '12px' },
  btnEdit: { backgroundColor: '#ede9fe', color: '#4f46e5', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' },
  btnSave: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' },
  btnDisabled: { backgroundColor: '#a5b4fc', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'not-allowed', fontSize: '15px' },
  btnCancel: { backgroundColor: '#f3f4f6', color: '#333', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' },
  statsRow: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: '100px', borderRadius: '12px', padding: '20px', textAlign: 'center' },
  statNum: { fontSize: '26px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 },
  statLbl: { fontSize: '13px', color: '#666', margin: '4px 0 0 0' },
  locationSection: { padding: '0 30px 20px 30px' },
  locationCard: { backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  locationTitle: { fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 4px 0' },
  locationSub: { fontSize: '13px', color: '#666', margin: 0 },
  btnDetect: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  btnShare: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  btnStop: { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  locErrorBox: { backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '12px' },
  locActiveBar: { backgroundColor: '#d1fae5', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' },
  livePulse: { width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', flexShrink: 0 },
  coordRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' },
  coordBadge: { backgroundColor: '#ede9fe', color: '#4f46e5', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', fontFamily: 'monospace' },
  noLocBox: { textAlign: 'center', padding: '32px', color: '#666' },
  noLocTitle: { fontSize: '16px', fontWeight: 'bold', color: '#333', margin: '0 0 6px 0' },
  noLocText: { fontSize: '13px', color: '#999', margin: 0 },
  portfolioSection: { padding: '0 30px 30px 30px' },
  portfolioTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '16px' },
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' },
  portfolioPhoto: { width: '100%', height: '160px', objectFit: 'cover', borderRadius: '10px' },
  emptyPortfolio: { backgroundColor: '#fff', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  emptyTitle: { fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e', margin: '12px 0 6px 0' },
  emptyText: { color: '#666', fontSize: '14px' },
};

export default WorkerProfilePage;