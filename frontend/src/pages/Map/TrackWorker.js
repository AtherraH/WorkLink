import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { io } from 'socket.io-client';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Moves map center whenever coords change
const MapUpdater = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 16); }, [lat, lng, map]);
  return null;
};

const TrackWorker = () => {
  const { jobId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [workerLocation, setWorkerLocation] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchJobAndLocation();
    // Poll every 5s as fallback
    const interval = setInterval(fetchJobAndLocation, 5000);

    // Real-time via socket.io
    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('join_room', jobId);
    socketRef.current.on('worker_location_update', (data) => {
      console.log('[GPS Customer] received:', data.latitude, data.longitude);
      if (data.latitude && data.longitude) {
        setWorkerLocation({ latitude: data.latitude, longitude: data.longitude });
        setLastUpdated(new Date());
      }
    });

    return () => {
      clearInterval(interval);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [jobId]);

  const fetchJobAndLocation = async () => {
    try {
      const jobRes = await axios.get(`http://localhost:5000/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJob(jobRes.data.job);
      try {
        const locRes = await axios.get(`http://localhost:5000/api/workers/location/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (locRes.data.location) {
          console.log('[GPS DB] lat=', locRes.data.location.latitude, 'lng=', locRes.data.location.longitude);
          setWorkerLocation(locRes.data.location);
          setLastUpdated(new Date());
        }
      } catch (e) {}
    } catch (err) {
      console.error('Error fetching location:', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={s.center}>Loading map...</div>;

  const lat = workerLocation ? parseFloat(workerLocation.latitude) : null;
  const lng = workerLocation ? parseFloat(workerLocation.longitude) : null;
  const hasLocation = lat && lng && !isNaN(lat) && !isNaN(lng);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>← Back</button>
        <h2 style={s.title}>Track Worker</h2>
        <div />
      </div>

      {job && (
        <div style={s.jobBar}>
          <p style={s.jobTitle}>{job.title}</p>
          <p style={s.jobMeta}>📍 {job.location}</p>
        </div>
      )}

      <div style={s.mapArea}>
        {hasLocation ? (
          <MapContainer
            center={[lat, lng]}
            zoom={16}
            style={{ height: '500px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            <MapUpdater lat={lat} lng={lng} />
            <Marker position={[lat, lng]}>
              <Popup>
                <strong>{workerLocation?.worker_name || 'Worker'}</strong><br />
                {lat.toFixed(6)}, {lng.toFixed(6)}<br />
                {lastUpdated && <span style={{ fontSize: '11px', color: '#888' }}>Updated: {lastUpdated.toLocaleTimeString()}</span>}
              </Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div style={s.noLocation}>
            <p style={{ fontSize: '48px', margin: 0 }}>📍</p>
            <p style={s.noLocTitle}>Worker location not available yet</p>
            <p style={s.noLocSub}>Worker needs to start sharing location from their app.</p>
            <button style={s.refreshBtn} onClick={fetchJobAndLocation}>🔄 Refresh</button>
          </div>
        )}
      </div>

      {hasLocation && (
        <div style={s.locInfo}>
          <p style={s.locText}>
            🟢 Live: {lat.toFixed(6)}, {lng.toFixed(6)}
            {lastUpdated && ` · ${lastUpdated.toLocaleTimeString()}`}
          </p>
          <button style={s.refreshBtn} onClick={fetchJobAndLocation}>🔄 Refresh</button>
        </div>
      )}
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', backgroundColor: '#1a1a2e', display: 'flex', flexDirection: 'column' },
  center: { textAlign: 'center', marginTop: '100px', color: '#fff', fontSize: '18px' },
  header: { backgroundColor: '#16213e', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { backgroundColor: 'transparent', color: '#a5b4fc', border: '1px solid #a5b4fc', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  title: { color: '#fff', fontSize: '20px', fontWeight: 'bold', margin: 0 },
  jobBar: { backgroundColor: '#16213e', padding: '12px 24px', borderBottom: '1px solid #333' },
  jobTitle: { color: '#fff', fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0' },
  jobMeta: { color: '#a5b4fc', fontSize: '13px', margin: 0 },
  mapArea: { flex: 1 },
  noLocation: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: '#fff', padding: '20px' },
  noLocTitle: { fontSize: '20px', fontWeight: 'bold', margin: '16px 0 8px 0' },
  noLocSub: { color: '#a5b4fc', fontSize: '14px', textAlign: 'center', maxWidth: '300px', marginBottom: '20px' },
  refreshBtn: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  locInfo: { backgroundColor: '#16213e', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  locText: { color: '#10b981', fontSize: '14px', margin: 0 },
};

export default TrackWorker;