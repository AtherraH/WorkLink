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

// ─────────────────────────────────────────────────────────────────────────────
// WorkerLocationMap
// Uses npm-imported L (not window.L). Map div is ALWAYS mounted so Leaflet
// never loses its DOM node. Overlay hides it until GPS fires.
// ─────────────────────────────────────────────────────────────────────────────
const WorkerLocationMap = ({ workerGPS, customerAddress }) => {
  const mapDivRef    = useRef(null);
  const mapRef       = useRef(null);
  const workerMarker = useRef(null);
  const destMarker   = useRef(null);
  const routeLine    = useRef(null);
  const pathLine     = useRef(null);
  const pathPoints   = useRef([]);
  const destCache    = useRef(null); // geocoded customer {lat,lng} — computed once

  // Init map on mount
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, { zoomControl: true }).setView([10.0, 76.3], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // Update worker position + trail + route on every GPS tick
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !workerGPS) return;

    // Worker blue dot
    const workerIcon = L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#4f46e5;border:3px solid #fff;box-shadow:0 0 0 4px rgba(79,70,229,0.35);"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    });
    if (workerMarker.current) {
      workerMarker.current.setLatLng([workerGPS.lat, workerGPS.lng]);
    } else {
      workerMarker.current = L.marker([workerGPS.lat, workerGPS.lng], { icon: workerIcon, zIndexOffset: 1000 })
        .addTo(map).bindPopup('📍 Your location');
    }

    // Breadcrumb trail
    pathPoints.current = [...pathPoints.current, [workerGPS.lat, workerGPS.lng]].slice(-300);
    if (pathLine.current) {
      pathLine.current.setLatLngs(pathPoints.current);
    } else {
      pathLine.current = L.polyline(pathPoints.current, {
        color: '#4f46e5', weight: 3, opacity: 0.45, dashArray: '6 4',
      }).addTo(map);
    }

    // Draw OSRM route from worker to customer
    const drawRoute = async (dLat, dLng) => {
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${workerGPS.lng},${workerGPS.lat};${dLng},${dLat}?overview=full&geometries=geojson`
        );
        const data = await res.json();
        if (data.routes?.[0]) {
          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          if (routeLine.current) { routeLine.current.setLatLngs(coords); }
          else { routeLine.current = L.polyline(coords, { color: '#10b981', weight: 4, opacity: 0.85 }).addTo(map); }
        }
      } catch (e) {}
      map.fitBounds([[workerGPS.lat, workerGPS.lng], [dLat, dLng]], { padding: [40, 40], maxZoom: 15 });
    };

    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 50);

    if (customerAddress?.address || customerAddress?.area) {
      if (destCache.current) {
        // Already geocoded — just refresh route
        drawRoute(destCache.current.lat, destCache.current.lng);
      } else {
        // Geocode customer address once
        const q = encodeURIComponent((customerAddress.address || customerAddress.area) + ', Kerala, India');
        fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`)
          .then(r => r.json())
          .then(results => {
            if (!results.length) return;
            const dLat = parseFloat(results[0].lat);
            const dLng = parseFloat(results[0].lon);
            destCache.current = { lat: dLat, lng: dLng };

            const destIcon = L.divIcon({
              className: '',
              html: `<div style="width:20px;height:20px;background:#ef4444;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(239,68,68,0.5);"></div>`,
              iconSize: [20, 20], iconAnchor: [10, 20],
            });
            destMarker.current = L.marker([dLat, dLng], { icon: destIcon })
              .addTo(map)
              .bindPopup(`<b>🏁 ${customerAddress.customer_name || 'Customer'}</b><br>${customerAddress.address || customerAddress.area}`);

            drawRoute(dLat, dLng);
          })
          .catch(() => map.setView([workerGPS.lat, workerGPS.lng], 15));
      }
    } else {
      map.setView([workerGPS.lat, workerGPS.lng], 15);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerGPS]);

  return (
    <div style={{ position: 'relative', height: '300px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb', marginTop: '16px' }}>
      {!workerGPS && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1000,
          background: '#f0f4f8', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '40px' }}>🗺️</span>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            Map appears once you start sharing location
          </p>
        </div>
      )}
      {/* ALWAYS mounted — Leaflet must have a real DOM node from the start */}
      <div ref={mapDivRef} style={{ width: '100%', height: '300px' }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WorkerJob
// ─────────────────────────────────────────────────────────────────────────────
const WorkerJob = () => {
  const { jobId } = useParams();
  const { token } = useAuth();
  const navigate  = useNavigate();

  const [job,             setJob]             = useState(null);
  const [otp,             setOtp]             = useState(null);
  const [payment,         setPayment]         = useState(null);
  const [bond,            setBond]            = useState(null);
  const [otpInput,        setOtpInput]        = useState('');
  const [loading,         setLoading]         = useState(true);
  const [activeTab,       setActiveTab]       = useState('details');
  const [locationSharing, setLocationSharing] = useState(false);
  const [completionPhoto, setCompletionPhoto] = useState(null);
  const [completing,      setCompleting]      = useState(false);
  const [customerAddress, setCustomerAddress] = useState(null);
  const [workerGPS,       setWorkerGPS]       = useState(null);

  const watchIdRef = useRef(null);
  const socketRef  = useRef(null);

  // Connect socket — lives for the lifetime of this page
  useEffect(() => {
    const socket = io('http://localhost:5000', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.emit('join_room', jobId);
    return () => socket.disconnect();
  }, [jobId]);

  // Fetch all job data
  const fetchAll = useCallback(async () => {
    try {
      const jobRes = await axios.get(`http://localhost:5000/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJob(jobRes.data.job);

      try {
        const r = await axios.get(`http://localhost:5000/api/otp/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
        setOtp(r.data.otp);
      } catch (e) {}

      try {
        const r = await axios.get(`http://localhost:5000/api/payments/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
        setPayment(r.data.payment);
      } catch (e) {}

      try {
        const r = await axios.get(`http://localhost:5000/api/bonds/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
        setBond(r.data.bond);
      } catch (e) {}

      // Customer address — server only returns this if the requesting worker is assigned
      try {
        const r = await axios.get(`http://localhost:5000/api/applications/${jobId}/customer-address`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCustomerAddress(r.data);
      } catch (e) {}

    } catch (err) {
      console.error('Failed to fetch job:', err.message);
    } finally {
      setLoading(false);
    }
  }, [jobId, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Start continuous GPS watch
  const shareLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported. Use Chrome on a real device.');
      return;
    }
    if (watchIdRef.current !== null) return; // already watching

    const onPosition = async (pos) => {
      const { latitude, longitude } = pos.coords;
      setWorkerGPS({ lat: latitude, lng: longitude });
      setLocationSharing(true);

      // Emit live update to socket room — customer's TrackWorker receives it instantly
      // workerId needed so server.js can update worker_profiles table
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        socketRef.current?.emit('update_location', { jobId, latitude, longitude, workerId: payload.id });
      } catch(e) {
        socketRef.current?.emit('update_location', { jobId, latitude, longitude });
      }

      // Also persist to DB so customer gets last-known on page load
      try {
        await axios.put('http://localhost:5000/api/workers/location',
          { latitude, longitude },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (e) {}
    };

    const onError = (err) => {
      const msgs = {
        1: 'Location permission denied. Allow it in browser settings.',
        2: 'GPS signal weak. Move to an open area.',
        3: 'GPS timed out. Try again.',
      };
      alert(msgs[err.code] || 'Could not get location.');
      setLocationSharing(false);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition, onError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  };

  const stopLocation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLocationSharing(false);
  };

  // Stop watch on unmount
  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  // ── Other actions ─────────────────────────────────────────────────────────
  const verifyOtp = async () => {
    if (!otpInput || otpInput.length < 4) { alert('Please enter the OTP given by the customer.'); return; }
    try {
      const res = await axios.post(`http://localhost:5000/api/otp/${jobId}/verify`,
        { otp_code: otpInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message || 'OTP verified! Job started.');
      setOtpInput('');
      fetchAll();
    } catch (err) { alert(err.response?.data?.message || 'Invalid OTP.'); }
  };

  const completeJob = async () => {
    if (!completionPhoto) { alert('Please select a completion photo first.'); return; }
    if (!window.confirm('Submit photo and mark job as complete?')) return;
    setCompleting(true);
    try {
      const fd = new FormData();
      fd.append('photo', completionPhoto);
      await axios.post(`http://localhost:5000/api/completion/${jobId}`, fd,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      alert('✅ Job completed! Photo added to your portfolio.');
      fetchAll();
    } catch (err) { alert(err.response?.data?.message || 'Failed to complete job.'); }
    finally { setCompleting(false); }
  };

  const confirmPayment = async () => {
    try {
      await axios.put(`http://localhost:5000/api/payments/${jobId}/received`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Payment confirmed!');
      fetchAll();
    } catch (err) { alert('Failed to confirm payment.'); }
  };

  const raiseDispute = async () => {
    const reason = prompt('Briefly describe the issue:');
    if (!reason) return;
    const description = prompt('More details (optional):') || reason;
    try {
      await axios.post(`http://localhost:5000/api/disputes/${jobId}`,
        { reason, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('✅ Dispute raised. Admin notified.');
      fetchAll();
    } catch (err) { alert(err.response?.data?.message || 'Failed to raise dispute.'); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div style={s.center}>Loading job...</div>;
  if (!job)    return (
    <div style={s.center}>
      <p>Job not found.</p>
      <button style={s.btnBack} onClick={() => navigate(-1)}>← Go Back</button>
    </div>
  );

  const status       = job.status;
  const workerArrived = otp?.is_used;
  const arrivalDeadline = job.arrival_deadline ? new Date(job.arrival_deadline) : null;
  const now = new Date();
  const minsLeft    = arrivalDeadline ? Math.floor((arrivalDeadline - now) / 60000) : null;
  const deadlineIsLate  = minsLeft !== null && minsLeft < 0;
  const deadlineUrgent  = minsLeft !== null && minsLeft <= 10 && minsLeft >= 0;

  const tabs = ['details'];
  if (['assigned', 'in_progress'].includes(status)) tabs.push('otp', 'location', 'chat');
  if (['assigned', 'in_progress', 'completed'].includes(status)) tabs.push('payment');
  if (bond) tabs.push('bond');

  return (
    <div style={s.page}>

      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/worker-dashboard')}>← Dashboard</button>
        <div style={s.headerMid}>
          <h2 style={s.headerTitle}>{job.title}</h2>
          <div style={s.badges}>
            <span style={{ ...s.badge, backgroundColor: getStatusBg(status), color: getStatusTxt(status) }}>
              {status.replace('_', ' ').toUpperCase()}
            </span>
            <span style={{ ...s.badge, backgroundColor: job.urgency === 'urgent' ? '#fee2e2' : '#dbeafe', color: job.urgency === 'urgent' ? '#991b1b' : '#1d4ed8' }}>
              {job.urgency === 'urgent' ? '🔴 URGENT' : '🔵 SCHEDULED'}
            </span>
          </div>
        </div>
        <div style={s.headerRate}>Rs.{job.rate}</div>
      </div>

      {workerArrived && <div style={s.arrivedBanner}>✅ Arrival verified — Job is in progress!</div>}

      {status === 'assigned' && !workerArrived && arrivalDeadline && (
        <div style={{ margin: 0, padding: '16px 24px', backgroundColor: deadlineIsLate ? '#fee2e2' : deadlineUrgent ? '#fef3c7' : '#ede9fe', borderBottom: `3px solid ${deadlineIsLate ? '#ef4444' : deadlineUrgent ? '#f59e0b' : '#4f46e5'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <div>
              <p style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 4px 0', color: deadlineIsLate ? '#991b1b' : deadlineUrgent ? '#92400e' : '#3730a3' }}>
                {deadlineIsLate ? '🚨 You are LATE!' : deadlineUrgent ? '⚠️ Arrive soon!' : '⏱ Arrival Deadline'}
              </p>
              <p style={{ fontSize: '13px', margin: 0, color: '#555' }}>
                {job.urgency === 'scheduled' ? `Scheduled: ${arrivalDeadline.toLocaleString()}` : `Arrive by: ${arrivalDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
            <div style={{ textAlign: 'center', minWidth: '80px' }}>
              <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: deadlineIsLate ? '#ef4444' : deadlineUrgent ? '#f59e0b' : '#4f46e5' }}>
                {deadlineIsLate ? `+${Math.abs(minsLeft)}m` : `${minsLeft}m`}
              </p>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{deadlineIsLate ? 'overdue' : 'remaining'}</p>
            </div>
          </div>
        </div>
      )}

      {status === 'assigned' && !workerArrived && !arrivalDeadline && (
        <div style={s.actionBanner}>⚠️ Go to the customer's location and verify OTP to start!</div>
      )}

      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t} style={activeTab === t ? s.tabActive : s.tab} onClick={() => setActiveTab(t)}>
            {t === 'details' && '📋 Details'}{t === 'otp' && '🔑 Verify OTP'}
            {t === 'location' && '📍 Location'}{t === 'chat' && '💬 Chat'}
            {t === 'payment' && '💰 Payment'}{t === 'bond' && '🔒 Bond'}
          </button>
        ))}
      </div>

      <div style={s.content}>

        {/* Details */}
        {activeTab === 'details' && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Job Details</h3>
            <div style={s.detailGrid}>
              {[['Title', job.title], ['Labor Type', job.labor_type], ['Location', job.location],
                ['Rate', `Rs.${job.rate}`], ['Urgency', job.urgency.toUpperCase()],
                ['Workers Needed', job.workers_needed], ['Customer', job.customer_name],
                ['Contact', job.customer_phone], ['Status', status.replace('_', ' ').toUpperCase()],
                ['Posted', new Date(job.created_at).toLocaleDateString()]
              ].map(([k, v]) => (
                <div key={k} style={s.dItem}><p style={s.dKey}>{k}</p><p style={s.dVal}>{v}</p></div>
              ))}
            </div>
            {job.scheduled_time && (
              <div style={s.scheduledBox}>
                <p style={s.scheduledLbl}>📅 Scheduled arrival time:</p>
                <p style={s.scheduledVal}>{new Date(job.scheduled_time).toLocaleString()}</p>
              </div>
            )}
            <div style={s.descBox}>
              <p style={s.dKey}>Description</p>
              <p style={s.descText}>{job.description}</p>
            </div>
            {job.photo_url && <img src={job.photo_url} alt="job" style={s.jobImg} />}
            <div style={s.contactBox}>
              <h4 style={s.contactTitle}>Customer Contact</h4>
              <p style={s.contactName}>{job.customer_name}</p>
              <div style={s.contactBtns}>
                <a href={`tel:${job.customer_phone}`} style={s.btnCall}>📞 Call Customer</a>
                {['assigned', 'in_progress'].includes(status) && (
                  <button style={s.btnChatBtn} onClick={() => navigate(`/chat/${jobId}`)}>💬 Chat</button>
                )}
              </div>
            </div>
            {status === 'in_progress' && (
              <div style={s.completeBox}>
                <p style={s.completeLbl}>📸 Upload completion photo to mark job done:</p>
                <input type="file" accept="image/*" onChange={e => setCompletionPhoto(e.target.files[0])} style={{ display: 'block', marginBottom: '12px' }} />
                {completionPhoto && <p style={{ color: '#10b981', fontSize: '13px', marginBottom: '10px' }}>✅ {completionPhoto.name}</p>}
                <button style={completing ? { ...s.btnComplete, backgroundColor: '#9ca3af', cursor: 'not-allowed' } : s.btnComplete} onClick={completeJob} disabled={completing}>
                  {completing ? 'Uploading...' : '✅ Submit Photo & Complete Job'}
                </button>
              </div>
            )}
            {['assigned', 'in_progress', 'completed'].includes(status) && (
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
                <button onClick={raiseDispute} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  ⚠️ Raise a Dispute
                </button>
              </div>
            )}
          </div>
        )}

        {/* OTP */}
        {activeTab === 'otp' && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Verify Your Arrival</h3>
            {otp?.is_used ? (
              <div style={s.otpDone}>
                <p style={{ fontSize: '48px', margin: '0 0 12px 0' }}>✅</p>
                <p style={s.otpDoneText}>OTP Verified! Arrival confirmed.</p>
                <p style={s.otpDoneSub}>Job is now in progress.</p>
              </div>
            ) : (
              <div style={s.otpForm}>
                <p style={s.otpInstruct}>Ask the customer for their OTP and enter it below:</p>
                <input style={s.otpInput} type="text" placeholder="Enter 6-digit OTP"
                  value={otpInput} onChange={e => setOtpInput(e.target.value)} maxLength={6} />
                <button style={s.btnVerify} onClick={verifyOtp}>✅ Verify & Start Job</button>
              </div>
            )}
          </div>
        )}

        {/* Location */}
        {activeTab === 'location' && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Share Your Location</h3>
            <p style={s.locText}>Share your real-time GPS so the customer can track you live on the map.</p>

            <div style={s.locStatus}>
              <span style={{ ...s.locDot, backgroundColor: locationSharing ? '#10b981' : '#9ca3af' }} />
              <span style={s.locLabel}>{locationSharing ? '🟢 Location sharing is active' : '⚫ Location sharing inactive'}</span>
            </div>

            {!locationSharing ? (
              <button style={s.btnLocation} onClick={shareLocation}>📍 Start Sharing Location</button>
            ) : (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'stretch' }}>
                <div style={{ ...s.locActive, flex: 1 }}>
                  <p style={s.locActiveText}>✅ Live GPS active — customer can see you.</p>
                  <p style={{ color: '#065f46', fontSize: '13px', margin: 0 }}>Updates every few seconds continuously.</p>
                </div>
                <button onClick={stopLocation} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '14px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  ⏹ Stop
                </button>
              </div>
            )}

            {customerAddress ? (
              <div style={{ padding: '14px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '4px' }}>
                <p style={{ margin: '0 0 6px 0', fontWeight: '700', fontSize: '13px', color: '#065f46' }}>🏁 Your Destination (Customer Address)</p>
                <p style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#1a1a2e', fontWeight: '600' }}>
                  {customerAddress.address || customerAddress.area}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                  👤 {customerAddress.customer_name} &nbsp;·&nbsp; 📞 {customerAddress.phone}
                </p>
              </div>
            ) : (
              <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '10px', border: '1px solid #fde68a', marginBottom: '4px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                  ⏳ Customer address will appear here once you are assigned to this job.
                </p>
              </div>
            )}

            <WorkerLocationMap workerGPS={workerGPS} customerAddress={customerAddress} />
          </div>
        )}

        {/* Chat */}
        {activeTab === 'chat' && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Chat with Customer</h3>
            <p style={s.locText}>Chat directly with the customer about this job.</p>
            <button style={s.btnPrimary} onClick={() => navigate(`/chat/${jobId}`)}>💬 Open Chat</button>
          </div>
        )}

        {/* Payment */}
        {activeTab === 'payment' && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Payment Status</h3>
            <div style={s.steps}>
              {[
                { label: 'Job Done',      done: status === 'completed' },
                { label: 'Payment Sent',  done: payment?.payment_sent },
                { label: 'You Confirmed', done: payment?.payment_received },
              ].map((step, i) => (
                <React.Fragment key={i}>
                  <div style={s.step}>
                    <div style={step.done ? s.stepDone : s.stepPend}>{step.done ? '✓' : i + 1}</div>
                    <p style={s.stepLbl}>{step.label}</p>
                  </div>
                  {i < 2 && <div style={s.stepLine} />}
                </React.Fragment>
              ))}
            </div>
            {payment?.payment_sent && !payment?.payment_received && (
              <div style={s.payAlert}>
                <p style={s.payAlertText}>💰 Customer sent Rs.{job.rate}!</p>
                <p style={s.payAlertSub}>Confirm you received it.</p>
                <button style={s.btnConfirm} onClick={confirmPayment}>✅ Confirm Payment Received</button>
              </div>
            )}
            {payment?.payment_received && (
              <div style={s.payDone}>
                <p style={{ fontSize: '40px', margin: '0 0 12px 0' }}>🎉</p>
                <p style={s.payDoneText}>Payment confirmed! Rs.{job.rate} received.</p>
              </div>
            )}
            {!payment?.payment_sent && (
              <div style={s.payWait}>
                <p style={s.payWaitText}>{status === 'completed' ? 'Waiting for customer to send payment...' : 'Payment available after job completion.'}</p>
              </div>
            )}
          </div>
        )}

        {/* Bond */}
        {activeTab === 'bond' && bond && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>🔒 Commitment Bond</h3>
            <div style={s.detailGrid}>
              {[['Job', bond.job_title], ['Bond Amount', `Rs.${bond.bond_amount || 'N/A'}`],
                ['No-Show Risk', `${bond.no_show_probability}%`], ['Status', bond.status?.toUpperCase()]
              ].map(([k, v]) => (
                <div key={k} style={s.dItem}><p style={s.dKey}>{k}</p><p style={s.dVal}>{v}</p></div>
              ))}
            </div>
            <div style={s.bondInfo}>
              <p style={s.bondInfoText}>💡 This bond ensures you commit to the job. Your reliability score is based on your arrival history.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const getStatusBg  = s => ({ open: '#d1fae5', assigned: '#fef3c7', in_progress: '#dbeafe', completed: '#ede9fe', cancelled: '#fee2e2' }[s] || '#f3f4f6');
const getStatusTxt = s => ({ open: '#065f46', assigned: '#92400e', in_progress: '#1d4ed8', completed: '#4f46e5', cancelled: '#991b1b' }[s] || '#333');

const s = {
  page:          { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  center:        { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666', padding: '20px' },
  btnBack:       { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', marginTop: '16px' },
  header:        { backgroundColor: '#1a1a2e', padding: '16px 30px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn:       { backgroundColor: 'transparent', color: '#a5b4fc', border: '1px solid #a5b4fc', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  headerMid:     { textAlign: 'center' },
  headerTitle:   { fontSize: '20px', fontWeight: 'bold', margin: '0 0 6px 0' },
  badges:        { display: 'flex', gap: '8px', justifyContent: 'center' },
  badge:         { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' },
  headerRate:    { fontSize: '24px', fontWeight: 'bold', color: '#a5b4fc' },
  arrivedBanner: { backgroundColor: '#d1fae5', color: '#065f46', padding: '14px 30px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' },
  actionBanner:  { backgroundColor: '#fef3c7', color: '#92400e', padding: '14px 30px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' },
  tabs:          { display: 'flex', backgroundColor: '#fff', borderBottom: '1px solid #eee', padding: '0 30px', overflowX: 'auto' },
  tab:           { padding: '14px 18px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '14px', color: '#666', whiteSpace: 'nowrap' },
  tabActive:     { padding: '14px 18px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '14px', color: '#4f46e5', borderBottom: '3px solid #4f46e5', fontWeight: 'bold', whiteSpace: 'nowrap' },
  content:       { padding: '30px', maxWidth: '800px', margin: '0 auto' },
  card:          { backgroundColor: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  cardTitle:     { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 20px 0' },
  detailGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' },
  dItem:         { backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px' },
  dKey:          { fontSize: '11px', color: '#999', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 'bold' },
  dVal:          { fontSize: '15px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 },
  scheduledBox:  { backgroundColor: '#fef3c7', padding: '16px', borderRadius: '10px', marginBottom: '16px', border: '2px solid #f59e0b' },
  scheduledLbl:  { fontSize: '13px', color: '#92400e', fontWeight: 'bold', margin: '0 0 6px 0' },
  scheduledVal:  { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 },
  descBox:       { backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '16px' },
  descText:      { fontSize: '15px', color: '#444', lineHeight: '1.7', margin: '8px 0 0 0' },
  jobImg:        { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px', marginBottom: '16px' },
  contactBox:    { backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '12px', marginTop: '16px' },
  contactTitle:  { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  contactName:   { fontSize: '18px', fontWeight: 'bold', color: '#333', margin: '0 0 12px 0' },
  contactBtns:   { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  btnCall:       { backgroundColor: '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' },
  btnChatBtn:    { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  completeBox:   { backgroundColor: '#f0fdf4', border: '2px solid #10b981', padding: '20px', borderRadius: '12px', marginTop: '20px' },
  completeLbl:   { fontWeight: 'bold', color: '#065f46', marginBottom: '12px', fontSize: '15px' },
  btnComplete:   { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', width: '100%' },
  otpDone:       { textAlign: 'center', padding: '40px' },
  otpDoneText:   { fontSize: '20px', fontWeight: 'bold', color: '#065f46', margin: '0 0 8px 0' },
  otpDoneSub:    { color: '#666', fontSize: '15px' },
  otpForm:       { textAlign: 'center', padding: '20px' },
  otpInstruct:   { fontSize: '15px', color: '#555', marginBottom: '24px', lineHeight: '1.6' },
  otpInput:      { display: 'block', margin: '0 auto 16px auto', padding: '16px', fontSize: '28px', textAlign: 'center', letterSpacing: '12px', borderRadius: '10px', border: '2px solid #4f46e5', width: '240px', fontWeight: 'bold', color: '#4f46e5' },
  btnVerify:     { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
  locText:       { color: '#555', fontSize: '15px', marginBottom: '20px' },
  locStatus:     { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' },
  locDot:        { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 },
  locLabel:      { fontSize: '14px', color: '#333' },
  btnLocation:   { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', width: '100%', marginBottom: '16px' },
  locActive:     { backgroundColor: '#d1fae5', padding: '16px', borderRadius: '10px' },
  locActiveText: { color: '#065f46', fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' },
  btnPrimary:    { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', width: '100%' },
  steps:         { display: 'flex', alignItems: 'center', marginBottom: '28px' },
  step:          { textAlign: 'center', minWidth: '80px' },
  stepDone:      { width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', margin: '0 auto 8px auto' },
  stepPend:      { width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#e5e7eb', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', margin: '0 auto 8px auto' },
  stepLine:      { flex: 1, height: '2px', backgroundColor: '#e5e7eb', marginBottom: '24px' },
  stepLbl:       { fontSize: '11px', color: '#666', margin: 0 },
  payAlert:      { backgroundColor: '#d1fae5', padding: '24px', borderRadius: '12px', textAlign: 'center' },
  payAlertText:  { fontSize: '18px', fontWeight: 'bold', color: '#065f46', margin: '0 0 8px 0' },
  payAlertSub:   { color: '#555', marginBottom: '16px' },
  btnConfirm:    { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
  payDone:       { textAlign: 'center', padding: '30px' },
  payDoneText:   { fontSize: '18px', fontWeight: 'bold', color: '#065f46' },
  payWait:       { backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', textAlign: 'center' },
  payWaitText:   { color: '#666', fontSize: '15px', margin: 0 },
  bondInfo:      { backgroundColor: '#ede9fe', padding: '16px', borderRadius: '10px', marginTop: '12px' },
  bondInfoText:  { color: '#4f46e5', fontSize: '14px', margin: 0, lineHeight: '1.6' },
};

export default WorkerJob;