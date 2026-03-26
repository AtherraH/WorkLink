import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { io } from 'socket.io-client';

// Auto-centers map when coords update
const MapRecenter = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 16); }, [lat, lng, map]);
  return null;
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const WorkerJob = () => {
  const { jobId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [otp, setOtp] = useState(null);
  const [payment, setPayment] = useState(null);
  const [bond, setBond] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [locationSharing, setLocationSharing] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);
  const watchRef = useRef(null);
  const socketRef = useRef(null);
  const [completionPhoto, setCompletionPhoto] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    fetchAll();
    // Connect socket and join job room
    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('join_room', jobId);
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [jobId]);

  const fetchAll = async () => {
    try {
      const jobRes = await axios.get(`http://localhost:5000/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJob(jobRes.data.job);

      try {
        const otpRes = await axios.get(`http://localhost:5000/api/otp/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOtp(otpRes.data.otp);
      } catch (e) {}

      try {
        const payRes = await axios.get(`http://localhost:5000/api/payments/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPayment(payRes.data.payment);
      } catch (e) {}

      try {
        const bondRes = await axios.get(`http://localhost:5000/api/bonds/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBond(bondRes.data.bond);
      } catch (e) {}

    } catch (err) {
      console.error('Failed to fetch job:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpInput || otpInput.length < 4) {
      alert('Please enter the OTP given by the customer.');
      return;
    }
    try {
      const res = await axios.post(
        `http://localhost:5000/api/otp/${jobId}/verify`,
        { otp_code: otpInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message || 'OTP verified! Job started.');
      setOtpInput('');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Invalid OTP.');
    }
  };

  const completeJob = async () => {
    if (!completionPhoto) {
      alert('Please select a completion photo first.');
      return;
    }
    if (!window.confirm('Submit photo and mark job as complete?')) return;
    setCompleting(true);
    try {
      const formData = new FormData();
      formData.append('photo', completionPhoto);
      await axios.post(
        `http://localhost:5000/api/completion/${jobId}`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      alert('✅ Job completed! Photo added to your portfolio.');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete job.');
    } finally {
      setCompleting(false);
    }
  };

  const confirmPayment = async () => {
    try {
      await axios.put(
        `http://localhost:5000/api/payments/${jobId}/received`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Payment confirmed!');
      fetchAll();
    } catch (err) {
      alert('Failed to confirm payment.');
    }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); return; }
    if (watchRef.current !== null) return;
    setLocationSharing(true);
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        console.log('[GPS Worker] lat=', latitude, 'lng=', longitude, 'accuracy=', accuracy + 'm');
        setCurrentCoords({ latitude, longitude, accuracy });
        // Emit via socket for real-time customer update
        if (socketRef.current) {
          socketRef.current.emit('update_location', { jobId, latitude, longitude, workerId: user?.id });
        }
        // Also persist to DB
        try {
          await axios.put(
            'http://localhost:5000/api/workers/location',
            { latitude, longitude },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (e) {}
      },
      (err) => { console.error('Location error:', err); setLocationSharing(false); watchRef.current = null; },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const stopSharing = () => {
    if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
    setLocationSharing(false);
  };

  if (loading) return <div style={s.center}>Loading job...</div>;
  if (!job) return (
    <div style={s.center}>
      <p>Job not found.</p>
      <button style={s.btnBack} onClick={() => navigate(-1)}>← Go Back</button>
    </div>
  );

  const status = job.status;
  const workerArrived = otp?.is_used;

  // arrival_deadline: urgent=job.created_at+30min, scheduled=scheduled_time+30min
  const arrivalDeadline = job.arrival_deadline ? new Date(job.arrival_deadline) : null;
  const now = new Date();
  const minsLeft = arrivalDeadline ? Math.floor((arrivalDeadline - now) / 60000) : null;
  const deadlineIsLate = minsLeft !== null && minsLeft < 0;
  const deadlineUrgent = minsLeft !== null && minsLeft <= 10 && minsLeft >= 0;

  const tabs = ['details'];
  if (['assigned', 'in_progress'].includes(status)) tabs.push('otp', 'location', 'chat');
  if (['assigned', 'in_progress', 'completed'].includes(status)) tabs.push('payment');
  if (bond) tabs.push('bond');

  return (
    <div style={s.page}>
      {/* Header */}
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

      {workerArrived && (
        <div style={s.arrivedBanner}>✅ Arrival verified — Job is in progress!</div>
      )}

      {status === 'assigned' && !workerArrived && arrivalDeadline && (
        <div style={{
          margin: '0',
          padding: '16px 24px',
          backgroundColor: deadlineIsLate ? '#fee2e2' : deadlineUrgent ? '#fef3c7' : '#ede9fe',
          borderBottom: `3px solid ${deadlineIsLate ? '#ef4444' : deadlineUrgent ? '#f59e0b' : '#4f46e5'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <div>
              <p style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 4px 0',
                color: deadlineIsLate ? '#991b1b' : deadlineUrgent ? '#92400e' : '#3730a3' }}>
                {deadlineIsLate ? '🚨 You are LATE! Customer may trigger emergency backup.' :
                 deadlineUrgent ? '⚠️ Arrive soon! Running low on time.' :
                 '⏱ Arrival Deadline'}
              </p>
              <p style={{ fontSize: '13px', margin: 0, color: '#555' }}>
                {job.urgency === 'scheduled'
                  ? `Scheduled arrival: ${arrivalDeadline.toLocaleString()}`
                  : `You must arrive by: ${arrivalDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — 30 min from when you were selected`}
              </p>
            </div>
            <div style={{ textAlign: 'center', minWidth: '80px' }}>
              <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0,
                color: deadlineIsLate ? '#ef4444' : deadlineUrgent ? '#f59e0b' : '#4f46e5' }}>
                {deadlineIsLate ? `+${Math.abs(minsLeft)}m` : `${minsLeft}m`}
              </p>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                {deadlineIsLate ? 'overdue' : 'remaining'}
              </p>
            </div>
          </div>
        </div>
      )}

      {status === 'assigned' && !workerArrived && !arrivalDeadline && (
        <div style={s.actionBanner}>
          ⚠️ Go to the customer's location and verify OTP to start the job!
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t}
            style={activeTab === t ? s.tabActive : s.tab}
            onClick={() => setActiveTab(t)}
          >
            {t === 'details' && '📋 Details'}
            {t === 'otp' && '🔑 Verify OTP'}
            {t === 'location' && '📍 Location'}
            {t === 'chat' && '💬 Chat'}
            {t === 'payment' && '💰 Payment'}
            {t === 'bond' && '🔒 Bond'}
          </button>
        ))}
      </div>

      <div style={s.content}>

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Job Details</h3>
            <div style={s.detailGrid}>
              {[
                ['Title', job.title],
                ['Labor Type', job.labor_type],
                ['Location', job.location],
                ['Rate', `Rs.${job.rate}`],
                ['Urgency', job.urgency.toUpperCase()],
                ['Workers Needed', job.workers_needed],
                ['Customer', job.customer_name],
                ['Contact', job.customer_phone],
                ['Status', status.replace('_', ' ').toUpperCase()],
                ['Posted', new Date(job.created_at).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={k} style={s.dItem}>
                  <p style={s.dKey}>{k}</p>
                  <p style={s.dVal}>{v}</p>
                </div>
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
                  <button style={s.btnChatBtn} onClick={() => navigate(`/chat/${jobId}`)}>
                    💬 Chat
                  </button>
                )}
              </div>
            </div>

            {/* Completion Photo + Complete Button */}
            {status === 'in_progress' && (
              <div style={s.completeBox}>
                <p style={s.completeLbl}>📸 Upload completion photo to mark job done:</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCompletionPhoto(e.target.files[0])}
                  style={{ display: 'block', marginBottom: '12px' }}
                />
                {completionPhoto && (
                  <p style={{ color: '#10b981', fontSize: '13px', marginBottom: '10px' }}>
                    ✅ Selected: {completionPhoto.name}
                  </p>
                )}
                <button
                  style={completing ? { ...s.btnComplete, backgroundColor: '#9ca3af', cursor: 'not-allowed' } : s.btnComplete}
                  onClick={completeJob}
                  disabled={completing}
                >
                  {completing ? 'Uploading...' : '✅ Submit Photo & Complete Job'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* OTP Tab */}
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
                <p style={s.otpInstruct}>
                  Ask the customer for their OTP and enter it below:
                </p>
                <input
                  style={s.otpInput}
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  maxLength={6}
                />
                <button style={s.btnVerify} onClick={verifyOtp}>
                  ✅ Verify & Start Job
                </button>
              </div>
            )}
          </div>
        )}

     

{/* Location Tab */}
{activeTab === 'location' && (
  <div style={s.card}>
    <h3 style={s.cardTitle}>Share Your Location</h3>
    <p style={s.locText}>Share your real-time GPS location so the customer can track you live.</p>
    <div style={s.locStatus}>
      <span style={{ ...s.locDot, backgroundColor: locationSharing ? '#10b981' : '#9ca3af' }} />
      <span style={s.locLabel}>
        {locationSharing ? '🟢 Location sharing is active' : '⚫ Location sharing inactive'}
      </span>
    </div>
    {currentCoords && (
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
        📍 {currentCoords.latitude.toFixed(6)}, {currentCoords.longitude.toFixed(6)}
        {currentCoords.accuracy && ` · ±${Math.round(currentCoords.accuracy)}m accuracy`}
      </div>
    )}
    {!locationSharing ? (
      <button style={s.btnLocation} onClick={shareLocation}>
        📍 Start Sharing Location
      </button>
    ) : (
      <div>
        <div style={s.locActive}>
          <p style={s.locActiveText}>✅ Your location is being sent to the customer in real-time.</p>
          <p style={{ color: '#065f46', fontSize: '13px', margin: '4px 0 12px 0' }}>
            Customer can see your exact position on their map.
          </p>
        </div>
        <button style={{ ...s.btnLocation, backgroundColor: '#ef4444', marginBottom: '12px' }} onClick={stopSharing}>
          🔴 Stop Sharing
        </button>
        {currentCoords && (
          <div style={{ borderRadius: '10px', overflow: 'hidden', height: '300px' }}
               key={`${currentCoords.latitude}-${currentCoords.longitude}`}>
            <MapContainer
              center={[currentCoords.latitude, currentCoords.longitude]}
              zoom={16}
              style={{ height: '300px', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              <MapRecenter lat={currentCoords.latitude} lng={currentCoords.longitude} />
              <Marker position={[currentCoords.latitude, currentCoords.longitude]}>
                <Popup>📍 Your current location<br/>{currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)}</Popup>
              </Marker>
            </MapContainer>
          </div>
        )}
      </div>
    )}
  </div>
)}




        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Chat with Customer</h3>
            <p style={s.locText}>Chat directly with the customer about this job.</p>
            <button style={s.btnPrimary} onClick={() => navigate(`/chat/${jobId}`)}>
              💬 Open Chat
            </button>
          </div>
        )}

        {/* Payment Tab */}
        {activeTab === 'payment' && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Payment Status</h3>
            <div style={s.steps}>
              {[
                { label: 'Job Done', done: status === 'completed' },
                { label: 'Payment Sent', done: payment?.payment_sent },
                { label: 'You Confirmed', done: payment?.payment_received },
              ].map((step, i) => (
                <React.Fragment key={i}>
                  <div style={s.step}>
                    <div style={step.done ? s.stepDone : s.stepPend}>
                      {step.done ? '✓' : i + 1}
                    </div>
                    <p style={s.stepLbl}>{step.label}</p>
                  </div>
                  {i < 2 && <div style={s.stepLine} />}
                </React.Fragment>
              ))}
            </div>
            {payment?.payment_sent && !payment?.payment_received && (
              <div style={s.payAlert}>
                <p style={s.payAlertText}>💰 Customer has sent payment of Rs.{job.rate}!</p>
                <p style={s.payAlertSub}>Please confirm you received it.</p>
                <button style={s.btnConfirm} onClick={confirmPayment}>
                  ✅ Confirm Payment Received
                </button>
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
                <p style={s.payWaitText}>
                  {status === 'completed'
                    ? 'Waiting for customer to send payment...'
                    : 'Payment available after job completion.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bond Tab */}
        {activeTab === 'bond' && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>🔒 Commitment Bond</h3>
            {bond ? (
              <div>
                <div style={s.detailGrid}>
                  {[
                    ['Job', bond.job_title],
                    ['Bond Amount', `Rs.${bond.bond_amount || 'N/A'}`],
                    ['No-Show Risk', `${bond.no_show_probability}%`],
                    ['Status', bond.status?.toUpperCase()],
                  ].map(([k, v]) => (
                    <div key={k} style={s.dItem}>
                      <p style={s.dKey}>{k}</p>
                      <p style={s.dVal}>{v}</p>
                    </div>
                  ))}
                </div>
                <div style={s.bondInfo}>
                  <p style={s.bondInfoText}>
                    💡 This bond ensures you commit to the job. Your reliability score is based on your arrival history.
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ color: '#666' }}>No bond data available for this job.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const getStatusBg = (s) => ({ open: '#d1fae5', assigned: '#fef3c7', in_progress: '#dbeafe', completed: '#ede9fe', cancelled: '#fee2e2' }[s] || '#f3f4f6');
const getStatusTxt = (s) => ({ open: '#065f46', assigned: '#92400e', in_progress: '#1d4ed8', completed: '#4f46e5', cancelled: '#991b1b' }[s] || '#333');

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666', padding: '20px' },
  btnBack: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', marginTop: '16px' },
  header: { backgroundColor: '#1a1a2e', padding: '16px 30px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { backgroundColor: 'transparent', color: '#a5b4fc', border: '1px solid #a5b4fc', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  headerMid: { textAlign: 'center' },
  headerTitle: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 6px 0' },
  badges: { display: 'flex', gap: '8px', justifyContent: 'center' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' },
  headerRate: { fontSize: '24px', fontWeight: 'bold', color: '#a5b4fc' },
  arrivedBanner: { backgroundColor: '#d1fae5', color: '#065f46', padding: '14px 30px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' },
  actionBanner: { backgroundColor: '#fef3c7', color: '#92400e', padding: '14px 30px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' },
  tabs: { display: 'flex', backgroundColor: '#fff', borderBottom: '1px solid #eee', padding: '0 30px', overflowX: 'auto' },
  tab: { padding: '14px 18px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '14px', color: '#666', whiteSpace: 'nowrap' },
  tabActive: { padding: '14px 18px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '14px', color: '#4f46e5', borderBottom: '3px solid #4f46e5', fontWeight: 'bold', whiteSpace: 'nowrap' },
  content: { padding: '30px', maxWidth: '800px', margin: '0 auto' },
  card: { backgroundColor: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  cardTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 20px 0' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' },
  dItem: { backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px' },
  dKey: { fontSize: '11px', color: '#999', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 'bold' },
  dVal: { fontSize: '15px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 },
  scheduledBox: { backgroundColor: '#fef3c7', padding: '16px', borderRadius: '10px', marginBottom: '16px', border: '2px solid #f59e0b' },
  scheduledLbl: { fontSize: '13px', color: '#92400e', fontWeight: 'bold', margin: '0 0 6px 0' },
  scheduledVal: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 },
  descBox: { backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '16px' },
  descText: { fontSize: '15px', color: '#444', lineHeight: '1.7', margin: '8px 0 0 0' },
  jobImg: { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px', marginBottom: '16px' },
  contactBox: { backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '12px', marginTop: '16px' },
  contactTitle: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  contactName: { fontSize: '18px', fontWeight: 'bold', color: '#333', margin: '0 0 12px 0' },
  contactBtns: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  btnCall: { backgroundColor: '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' },
  btnChatBtn: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  completeBox: { backgroundColor: '#f0fdf4', border: '2px solid #10b981', padding: '20px', borderRadius: '12px', marginTop: '20px' },
  completeLbl: { fontWeight: 'bold', color: '#065f46', marginBottom: '12px', fontSize: '15px' },
  btnComplete: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', width: '100%' },
  otpDone: { textAlign: 'center', padding: '40px' },
  otpDoneText: { fontSize: '20px', fontWeight: 'bold', color: '#065f46', margin: '0 0 8px 0' },
  otpDoneSub: { color: '#666', fontSize: '15px' },
  otpForm: { textAlign: 'center', padding: '20px' },
  otpInstruct: { fontSize: '15px', color: '#555', marginBottom: '24px', lineHeight: '1.6' },
  otpInput: { display: 'block', margin: '0 auto 16px auto', padding: '16px', fontSize: '28px', textAlign: 'center', letterSpacing: '12px', borderRadius: '10px', border: '2px solid #4f46e5', width: '240px', fontWeight: 'bold', color: '#4f46e5' },
  btnVerify: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
  locText: { color: '#555', fontSize: '15px', marginBottom: '20px' },
  locStatus: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' },
  locDot: { width: '12px', height: '12px', borderRadius: '50%' },
  locLabel: { fontSize: '14px', color: '#333' },
  btnLocation: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', width: '100%' },
  locActive: { backgroundColor: '#d1fae5', padding: '16px', borderRadius: '10px' },
  locActiveText: { color: '#065f46', fontWeight: 'bold', marginBottom: '12px' },
  btnPrimary: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', width: '100%' },
  steps: { display: 'flex', alignItems: 'center', marginBottom: '28px' },
  step: { textAlign: 'center', minWidth: '80px' },
  stepDone: { width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', margin: '0 auto 8px auto' },
  stepPend: { width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#e5e7eb', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', margin: '0 auto 8px auto' },
  stepLine: { flex: 1, height: '2px', backgroundColor: '#e5e7eb', marginBottom: '24px' },
  stepLbl: { fontSize: '11px', color: '#666', margin: 0 },
  payAlert: { backgroundColor: '#d1fae5', padding: '24px', borderRadius: '12px', textAlign: 'center' },
  payAlertText: { fontSize: '18px', fontWeight: 'bold', color: '#065f46', margin: '0 0 8px 0' },
  payAlertSub: { color: '#555', marginBottom: '16px' },
  btnConfirm: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
  payDone: { textAlign: 'center', padding: '30px' },
  payDoneText: { fontSize: '18px', fontWeight: 'bold', color: '#065f46' },
  payWait: { backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', textAlign: 'center' },
  payWaitText: { color: '#666', fontSize: '15px', margin: 0 },
  bondInfo: { backgroundColor: '#ede9fe', padding: '16px', borderRadius: '10px', marginTop: '12px' },
  bondInfoText: { color: '#4f46e5', fontSize: '14px', margin: 0, lineHeight: '1.6' },
};

export default WorkerJob;