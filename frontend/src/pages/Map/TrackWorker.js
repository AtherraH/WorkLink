import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon paths (webpack strips them)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '© <a href="https://openstreetmap.org">OpenStreetMap</a>';

// Geocode via Nominatim (no API key needed)
const geocode = async (text) => {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ', Kerala, India')}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const d = await r.json();
    if (d.length) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  } catch (e) {}
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// TrackWorker — customer-facing live tracking page
// Uses npm-imported L (not window.L). Map div ALWAYS mounted.
// ─────────────────────────────────────────────────────────────────────────────
const TrackWorker = () => {
  const { jobId }  = useParams();
  const { token }  = useAuth();
  const navigate   = useNavigate();

  const [job,         setJob]         = useState(null);
  const [workerPos,   setWorkerPos]   = useState(null);  // {lat, lng}
  const [jobPos,      setJobPos]      = useState(null);  // {lat, lng}
  const [eta,         setEta]         = useState(null);  // {distKm, etaMins}
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [liveStatus,  setLiveStatus]  = useState('connecting'); // connecting|live|reconnecting

  const mapDivRef    = useRef(null);
  const mapRef       = useRef(null);
  const workerMarker = useRef(null);
  const jobMarker    = useRef(null);
  const routeLine    = useRef(null);
  const pathLine     = useRef(null);
  const pathPoints   = useRef([]);
  const socketRef    = useRef(null);
  const jobPosRef    = useRef(null); // mirror of jobPos for use inside callbacks

  // ── Fetch OSRM route ──────────────────────────────────────────────────────
  const fetchRoute = useCallback(async (wLat, wLng, jLat, jLng) => {
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${wLng},${wLat};${jLng},${jLat}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.routes?.[0]) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const distKm = (data.routes[0].distance / 1000).toFixed(2);
        const etaMins = Math.round(data.routes[0].duration / 60);
        setEta({ distKm, etaMins });
        return coords;
      }
    } catch (e) {
      return [[wLat, wLng], [jLat, jLng]]; // fallback straight line
    }
    return null;
  }, []);

  // ── Handle incoming location update (from socket OR initial DB fetch) ─────
  const handleLocationUpdate = useCallback(async (lat, lng) => {
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) return;

    setWorkerPos({ lat: numLat, lng: numLng });
    setLastUpdated(new Date());

    // Fetch route if job position is known
    const jPos = jobPosRef.current;
    if (jPos) {
      const coords = await fetchRoute(numLat, numLng, jPos.lat, jPos.lng);

      // Update map directly via refs (avoids waiting for React re-render)
      const map = mapRef.current;
      if (!map) return;

      // Worker marker
      const workerIcon = L.divIcon({
        className: '',
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#4f46e5;border:3px solid #fff;box-shadow:0 0 0 5px rgba(79,70,229,0.3);"></div>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      });
      if (workerMarker.current) {
        workerMarker.current.setLatLng([numLat, numLng]);
      } else {
        workerMarker.current = L.marker([numLat, numLng], { icon: workerIcon, zIndexOffset: 1000 })
          .addTo(map).bindPopup('<b>🔵 Worker</b><br>Live location');
      }

      // Breadcrumb trail
      pathPoints.current = [...pathPoints.current, [numLat, numLng]].slice(-300);
      if (pathLine.current) {
        pathLine.current.setLatLngs(pathPoints.current);
      } else {
        pathLine.current = L.polyline(pathPoints.current, {
          color: '#4f46e5', weight: 3, opacity: 0.45, dashArray: '6 4',
        }).addTo(map);
      }

      // Route line
      if (coords && coords.length >= 2) {
        if (routeLine.current) { routeLine.current.setLatLngs(coords); }
        else { routeLine.current = L.polyline(coords, { color: '#10b981', weight: 4, opacity: 0.85 }).addTo(map); }
      }

      // Fit both points
      map.fitBounds([[numLat, numLng], [jPos.lat, jPos.lng]], { padding: [60, 60], maxZoom: 16 });
      // Force Leaflet to recalculate its container size
      setTimeout(() => map.invalidateSize(), 50);
    } else {
      // Job position not yet known — just pan to worker
      const map = mapRef.current;
      if (map) map.setView([numLat, numLng], 15);
    }
  }, [fetchRoute]);

  // ── Init Leaflet map (npm L, always-mounted div) ──────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = L.map(mapDivRef.current, { zoomControl: true }).setView([10.0, 76.3], 10);
    L.tileLayer(TILE, { attribution: ATTR, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // ── Add job marker once jobPos is known ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !jobPos || jobMarker.current) return;

    const destIcon = L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;background:#ef4444;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(239,68,68,0.5);"></div>`,
      iconSize: [22, 22], iconAnchor: [11, 22],
    });
    jobMarker.current = L.marker([jobPos.lat, jobPos.lng], { icon: destIcon })
      .addTo(map)
      .bindPopup(`<b>📍 Job Location</b><br>${jobPos.label || 'Destination'}`);
    map.setView([jobPos.lat, jobPos.lng], 13);
  }, [jobPos]);

  // ── Fetch job info + geocode location + load last known worker pos ────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = res.data.job;
        setJob(j);

        // Resolve job position
        let jPos = null;
        if (j.latitude && j.longitude) {
          jPos = { lat: parseFloat(j.latitude), lng: parseFloat(j.longitude), label: j.location };
        } else if (j.location) {
          const geo = await geocode(j.location);
          if (geo) jPos = { ...geo, label: j.location };
        }
        if (jPos) { setJobPos(jPos); jobPosRef.current = jPos; }

        // Load last known worker location from DB (fallback for when page loads mid-job)
        try {
          const locRes = await axios.get(`http://localhost:5000/api/workers/location/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (locRes.data.location?.latitude && locRes.data.location?.longitude) {
            await handleLocationUpdate(locRes.data.location.latitude, locRes.data.location.longitude);
          }
        } catch (e) {}

      } catch (err) { console.error('TrackWorker init error:', err.message); }
      finally { setLoading(false); }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // ── Socket: subscribe to live location updates ────────────────────────────
  useEffect(() => {
    const socket = io('http://localhost:5000', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect',       () => setLiveStatus('live'));
    socket.on('disconnect',    () => setLiveStatus('reconnecting'));
    socket.on('connect_error', () => setLiveStatus('reconnecting'));

    // Join the job-specific room so we only get updates for this job
    socket.emit('join_room', jobId);

    // Worker emits 'update_location' — we receive it here in real time
    socket.on('worker_location_update', (data) => {
      if (data.latitude && data.longitude) {
        handleLocationUpdate(data.latitude, data.longitude);
      }
    });

    return () => socket.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div style={s.center}>Loading map...</div>;

  const statusColor = { live: '#10b981', reconnecting: '#f59e0b', connecting: '#9ca3af' }[liveStatus];
  const statusLabel = { live: '🟢 Live', reconnecting: '🟡 Reconnecting…', connecting: '⚪ Connecting…' }[liveStatus];

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>← Back</button>
        <h2 style={s.title}>📍 Live Worker Tracking</h2>
        <span style={{ ...s.badge, backgroundColor: statusColor }}>{statusLabel}</span>
      </div>

      {/* Job info bar */}
      {job && (
        <div style={s.jobBar}>
          <p style={s.jobTitle}>{job.title}</p>
          <p style={s.jobMeta}>📍 {job.location} &nbsp;·&nbsp; 🔧 {job.labor_type}</p>
        </div>
      )}

      {/* ETA / stats bar */}
      <div style={s.infoBar}>
        {workerPos ? (
          <div style={s.infoFlex}>
            <div style={s.infoItem}>
              <span style={s.infoIcon}>🔵</span>
              <div>
                <p style={s.infoLbl}>Worker</p>
                <p style={s.infoVal}>Live tracking active</p>
              </div>
            </div>
            {eta && (
              <>
                <div style={s.infoDivider} />
                <div style={s.infoItem}>
                  <span style={s.infoIcon}>📏</span>
                  <div><p style={s.infoLbl}>Distance</p><p style={s.infoVal}>{eta.distKm} km</p></div>
                </div>
                <div style={s.infoDivider} />
                <div style={s.infoItem}>
                  <span style={s.infoIcon}>⏱</span>
                  <div>
                    <p style={s.infoLbl}>ETA</p>
                    <p style={s.infoVal}>{eta.etaMins < 1 ? 'Arriving now' : `~${eta.etaMins} min`}</p>
                  </div>
                </div>
              </>
            )}
            {lastUpdated && (
              <>
                <div style={s.infoDivider} />
                <div style={s.infoItem}>
                  <span style={s.infoIcon}>🔄</span>
                  <div>
                    <p style={s.infoLbl}>Updated</p>
                    <p style={s.infoVal}>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={s.infoItem}>
            <span style={s.infoIcon}>⏳</span>
            <div>
              <p style={s.infoLbl}>Status</p>
              <p style={s.infoVal}>Waiting for worker to start sharing location…</p>
            </div>
          </div>
        )}
      </div>

      {/* Map container — map div ALWAYS in DOM */}
      <div style={s.mapContainer}>
        {!workerPos && (
          <div style={s.noLoc}>
            <p style={{ fontSize: '52px', margin: '0 0 16px 0' }}>📍</p>
            <p style={s.noLocTitle}>Waiting for worker's location</p>
            <p style={s.noLocSub}>
              Worker must tap <strong>"Start Sharing Location"</strong> in their app.
              <br />The map will update automatically.
            </p>
          </div>
        )}
        {/* Always rendered — placeholder sits on top until workerPos arrives */}
        <div ref={mapDivRef} style={{ width: '100%', height: 'calc(100vh - 200px)' }} />
      </div>

      {/* Legend */}
      <div style={s.legend}>
        <div style={s.legendItem}><div style={{ ...s.dot, background: '#4f46e5' }} /><span>Worker (live)</span></div>
        <div style={s.legendItem}><div style={{ ...s.dot, background: '#ef4444', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }} /><span>Job location</span></div>
        <div style={s.legendItem}><div style={{ width: '24px', height: '3px', background: '#4f46e5', borderRadius: '2px' }} /><span>Path taken</span></div>
        <div style={s.legendItem}><div style={{ width: '24px', height: '3px', background: '#10b981', borderRadius: '2px' }} /><span>Route to job</span></div>
      </div>

    </div>
  );
};

const s = {
  page:        { minHeight: '100vh', backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column' },
  center:      { textAlign: 'center', marginTop: '100px', color: '#fff', fontSize: '18px' },
  header:      { backgroundColor: '#1e293b', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', flexShrink: 0 },
  backBtn:     { backgroundColor: 'transparent', color: '#a5b4fc', border: '1px solid #a5b4fc', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  title:       { color: '#fff', fontSize: '18px', fontWeight: 'bold', margin: 0 },
  badge:       { color: '#fff', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  jobBar:      { backgroundColor: '#1e293b', padding: '10px 24px', borderBottom: '1px solid #334155', flexShrink: 0 },
  jobTitle:    { color: '#fff', fontWeight: 'bold', fontSize: '15px', margin: '0 0 2px 0' },
  jobMeta:     { color: '#94a3b8', fontSize: '12px', margin: 0 },
  infoBar:     { backgroundColor: '#1e293b', padding: '10px 24px', borderBottom: '1px solid #334155', flexShrink: 0 },
  infoFlex:    { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 },
  infoItem:    { display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 20px 4px 0' },
  infoIcon:    { fontSize: '18px' },
  infoLbl:     { margin: 0, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' },
  infoVal:     { margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#fff' },
  infoDivider: { width: '1px', height: '32px', backgroundColor: '#334155', margin: '0 16px 0 0' },
  mapContainer:{ height: 'calc(100vh - 200px)', position: 'relative', flexShrink: 0 },
  noLoc:       { position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '40px', textAlign: 'center', background: '#0f172a' },
  noLocTitle:  { fontSize: '22px', fontWeight: 'bold', margin: '0 0 12px 0' },
  noLocSub:    { color: '#94a3b8', fontSize: '14px', maxWidth: '360px', lineHeight: '1.7', margin: 0 },
  legend:      { backgroundColor: '#1e293b', padding: '10px 24px', borderTop: '1px solid #334155', display: 'flex', gap: '20px', flexWrap: 'wrap', flexShrink: 0 },
  legendItem:  { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8' },
  dot:         { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 },
};

export default TrackWorker;