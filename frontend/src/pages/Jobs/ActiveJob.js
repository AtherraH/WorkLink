import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ActiveJob = () => {
  const { jobId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [otp, setOtp] = useState(null);
  const [payment, setPayment] = useState(null);
  const [noShowStatus, setNoShowStatus] = useState(null);
  const [emergencyBackups, setEmergencyBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingReview, setRatingReview] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [timerDisplay, setTimerDisplay] = useState('');
  const [completionPhoto, setCompletionPhoto] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [exitTime, setExitTime] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      // Fetch job - required
      const jobRes = await axios.get(
        `http://localhost:5000/api/jobs/${jobId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setJob(jobRes.data.job);

      // Fetch OTP - optional, don't crash if fails
      try {
        const otpRes = await axios.get(
          `http://localhost:5000/api/otp/${jobId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setOtp(otpRes.data.otp);
      } catch (e) {
        console.log('OTP not available yet');
      }

      // Fetch payment - optional
      try {
        const payRes = await axios.get(
          `http://localhost:5000/api/payments/${jobId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPayment(payRes.data.payment);
      } catch (e) {
        console.log('Payment not available yet');
      }

      // Fetch no-show status - optional
      try {
        const noShowRes = await axios.get(
          `http://localhost:5000/api/emergency/check/${jobId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNoShowStatus(noShowRes.data);
      } catch (e) {
        console.log('No-show check not available');
      }

      // Fetch emergency backups - optional
      try {
        const backupRes = await axios.get(
          `http://localhost:5000/api/emergency/${jobId}/backups`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setEmergencyBackups(backupRes.data.backup_workers || []);
      } catch (e) {
        console.log('No emergency backups');
      }

    } catch (err) {
      console.error('Failed to fetch job:', err.message);
      setError('Job not found or you do not have access.');
    } finally {
      setLoading(false);
    }
  }, [jobId, token]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Live countdown timer
  useEffect(() => {
    if (!noShowStatus || noShowStatus.is_late) return;
    const minutesLeft = noShowStatus.minutes_left || 0;
    setTimerDisplay(`${minutesLeft} min`);

    const timer = setInterval(() => {
      setTimerDisplay((prev) => {
        const mins = parseInt(prev);
        if (isNaN(mins) || mins <= 0) {
          clearInterval(timer);
          return '0 min';
        }
        return `${mins - 1} min`;
      });
    }, 60000);

    return () => clearInterval(timer);
  }, [noShowStatus]);

  const triggerEmergency = async () => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/emergency/trigger/${jobId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to trigger emergency.');
    }
  };

  const chooseBackup = async (workerId, workerName) => {
    if (!window.confirm(`Assign ${workerName} as your new worker?`)) return;
    try {
      const res = await axios.put(
        `http://localhost:5000/api/emergency/${jobId}/choose/${workerId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`${workerName} assigned! New OTP: ${res.data.new_otp}`);
      fetchAll();
    } catch (err) {
      alert('Failed to assign backup worker.');
    }
  };

  const payWorker = async () => {
    if (!window.confirm(`Mark Rs.${job.rate} as sent to the worker? Do this after you have actually paid them.`)) return;
    try {
      // Single call — auto-creates payment record and marks as sent
      await axios.put(
        `http://localhost:5000/api/payments/${jobId}/sent`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('✅ Payment marked as sent! Worker will confirm receipt.');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark payment.');
    }
  };

  const confirmPaymentReceived = async () => {
    try {
      await axios.put(
        `http://localhost:5000/api/payments/${jobId}/received`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Payment confirmed received!');
      fetchAll();
    } catch (err) {
      alert('Failed to confirm payment.');
    }
  };

  const rateWorker = async () => {
    try {
      await axios.post(
        `http://localhost:5000/api/ratings/${jobId}`,
        { score: ratingScore, review: ratingReview },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Rating submitted! Thank you.');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit rating.');
    }
  };

  if (loading) return (
    <div style={styles.center}>
      <p>Loading active job...</p>
    </div>
  );

  if (error) return (
    <div style={styles.center}>
      <p style={{ color: '#ef4444', fontSize: '18px' }}>{error}</p>
      <button style={styles.btnBack} onClick={() => navigate(-1)}>← Go Back</button>
    </div>
  );

  if (!job) return (
    <div style={styles.center}>
      <p>Job not found.</p>
      <button style={styles.btnBack} onClick={() => navigate(-1)}>← Go Back</button>
    </div>
  );

  const isCustomer = user && user.role === 'customer';
  const isWorker = user && user.role === 'worker';

  const completeJobWithPhoto = async () => {
    if (!completionPhoto) {
      alert('Please select a completion photo first. This marks your exit time and updates your portfolio.');
      return;
    }
    if (!window.confirm('Upload photo and mark job as complete? This will record your exit time.')) return;
    setCompleting(true);
    const now = new Date();
    try {
      // Upload completion photo
      const formData = new FormData();
      formData.append('photo', completionPhoto);
      try {
        await axios.post(
          `http://localhost:5000/api/completion/${jobId}/upload`,
          formData,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
        );
      } catch (e) {
        console.warn('Photo upload failed, continuing with job completion:', e.message);
      }
      // Mark job complete (records exit_time on backend)
      await axios.put(
        `http://localhost:5000/api/jobs/${jobId}/complete`,
        { exit_time: now.toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setExitTime(now);
      alert('✅ Job completed! Exit time recorded. Your portfolio has been updated.');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete job.');
    } finally {
      setCompleting(false);
    }
  };
  const jobStatus = job.status;
  const minutesElapsed = noShowStatus?.minutes_elapsed || 0;
  const minutesLeft = noShowStatus?.minutes_left ?? 30;
  const timerPercent = Math.max(0, (minutesLeft / 30) * 100);
  const timerColor = minutesLeft <= 5 ? '#ef4444' : minutesLeft <= 10 ? '#f59e0b' : '#10b981';
  const workerArrived = otp?.is_used;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>← Back</button>
        <div style={styles.headerCenter}>
          <h2 style={styles.headerTitle}>{job.title}</h2>
          <span style={getStatusStyle(jobStatus)}>
            {jobStatus.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <div style={styles.headerRate}>
          <p style={styles.rate}>Rs.{job.rate}</p>
          <p style={styles.rateLabel}>{job.urgency.toUpperCase()}</p>
        </div>
      </div>

      {/* 30-min Countdown Timer */}
      {noShowStatus && !workerArrived && !noShowStatus.is_late && (
        <div style={styles.timerBox}>
          <div style={styles.timerTop}>
            <div>
              <p style={styles.timerTitle}>
                ⏱ Worker Arrival Timer
                <span style={styles.timerBadge}>
                  {job.urgency === 'scheduled' ? 'SCHEDULED' : 'URGENT'}
                </span>
              </p>
              <p style={styles.timerSub}>
                {job.urgency === 'scheduled' && job.scheduled_time
                  ? `Scheduled: ${new Date(job.scheduled_time).toLocaleString([], { hour12: true })}`
                  : 'Worker has 30 minutes to arrive after assignment'}
              </p>
            </div>
            <div style={styles.timerCountdown}>
              <p style={{ ...styles.timerBig, color: timerColor }}>
                {timerDisplay || `${minutesLeft} min`}
              </p>
              <p style={styles.timerRemaining}>remaining</p>
            </div>
          </div>
          <div style={styles.timerBarBg}>
            <div style={{
              ...styles.timerBarFill,
              width: `${timerPercent}%`,
              backgroundColor: timerColor,
            }} />
          </div>
          <p style={styles.timerElapsed}>
            {minutesElapsed} of 30 minutes elapsed
          </p>
        </div>
      )}

      {/* Worker Arrived Banner */}
      {workerArrived && (
        <div style={styles.arrivedBanner}>
          ✅ Worker has arrived and verified OTP — Job is in progress!
        </div>
      )}

      {/* LATE Alert */}
      {noShowStatus?.is_late && !workerArrived && (
        <div style={styles.lateAlert}>
          <div>
            <p style={styles.lateTitle}>⚠️ Worker is LATE!</p>
            <p style={styles.lateText}>{noShowStatus.message}</p>
          </div>
          {isCustomer && emergencyBackups.length === 0 && (
            <button style={styles.btnEmergency} onClick={triggerEmergency}>
              🚨 Trigger Emergency Backup
            </button>
          )}
        </div>
      )}

      {/* Emergency Backup Workers */}
      {emergencyBackups.length > 0 && (
        <div style={styles.emergencySection}>
          <h3 style={styles.emergencyTitle}>🚨 Emergency Backup Workers</h3>
          <p style={styles.emergencySub}>
            {isCustomer
              ? 'Choose a backup worker to replace the current one:'
              : 'Backup workers have been notified for this job:'}
          </p>
          <div style={styles.backupsGrid}>
            {emergencyBackups.map((worker) => (
              <div key={worker.worker_id} style={styles.backupCard}>
                <div style={styles.backupAvatar}>{worker.full_name.charAt(0)}</div>
                <h4 style={styles.backupName}>{worker.full_name}</h4>
                <p style={styles.backupMeta}>⭐ {parseFloat(worker.rating).toFixed(1)}</p>
                <p style={styles.backupMeta}>📞 {worker.phone}</p>
                <div style={styles.skillsRow}>
                  {(worker.skills || []).map((skill) => (
                    <span key={skill} style={styles.skillBadge}>{skill}</span>
                  ))}
                </div>
                <span style={{
                  ...styles.backupStatusBadge,
                  backgroundColor: worker.status === 'assigned' ? '#d1fae5' : '#fef3c7',
                  color: worker.status === 'assigned' ? '#065f46' : '#92400e',
                }}>
                  {worker.status.toUpperCase()}
                </span>
                {isCustomer && worker.status === 'notified' && (
                  <button
                    style={styles.btnChoose}
                    onClick={() => chooseBackup(worker.worker_id, worker.full_name)}
                  >
                    Choose This Worker
                  </button>
                )}
              </div>
            ))}
          </div>
          {isCustomer && (
            <div style={styles.optionsBox}>
              <p style={styles.optionsTitle}>Your Options:</p>
              <p style={styles.optionItem}>✅ Choose one of the backup workers above</p>
              <p style={styles.optionItem}>⏳ Wait if map shows worker is close</p>
              <p style={styles.optionItem}>❌ Cancel the job entirely</p>
              <button style={styles.btnTrack} onClick={() => navigate(`/track/${jobId}`)}>
                📍 Check Worker on Map
              </button>
            </div>
          )}
        </div>
      )}

      {/* Section Tabs */}
      <div style={styles.sectionsNav}>
        {['overview', 'otp', 'track', 'chat', 'payment'].map((s) => (
          <button
            key={s}
            style={activeSection === s ? styles.sectionBtnActive : styles.sectionBtn}
            onClick={() => setActiveSection(s)}
          >
            {s === 'overview' && '📋 Overview'}
            {s === 'otp' && '🔑 OTP'}
            {s === 'track' && '📍 Track'}
            {s === 'chat' && '💬 Chat'}
            {s === 'payment' && '💰 Payment'}
          </button>
        ))}
      </div>

      <div style={styles.content}>

        {/* Overview */}
        {activeSection === 'overview' && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Job Details</h3>
            <div style={styles.detailsGrid}>
              {[
                ['Labor Type', job.labor_type],
                ['Location', job.location],
                ['Urgency', job.urgency.toUpperCase()],
                ['Workers Needed', job.workers_needed],
                ['Posted By', job.customer_name],
                ['Contact', job.customer_phone],
                ['Rate', `Rs.${job.rate}`],
                ['Status', jobStatus.replace('_', ' ').toUpperCase()],
              ].map(([label, value]) => (
                <div key={label} style={styles.detailItem}>
                  <p style={styles.detailLabel}>{label}</p>
                  <p style={styles.detailValue}>{value}</p>
                </div>
              ))}
            </div>
            {job.scheduled_time && (
              <div style={styles.scheduledBox}>
                <p style={styles.scheduledLabel}>📅 Scheduled Time</p>
                <p style={styles.scheduledValue}>
                  {new Date(job.scheduled_time).toLocaleString([], { hour12: true })}
                </p>
              </div>
            )}
            <div style={styles.descBox}>
              <p style={styles.detailLabel}>Description</p>
              <p style={styles.descText}>{job.description}</p>
            </div>
            {job.photo_url && (
              <img src={job.photo_url} alt="job" style={styles.jobPhoto} />
            )}
          </div>
        )}

        {/* OTP */}
        {activeSection === 'otp' && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>OTP Verification</h3>
            {otp ? (
              <div style={styles.otpBox}>
                <p style={styles.otpLabel}>
                  {isCustomer
                    ? 'Share this OTP with your worker on arrival:'
                    : 'Enter this OTP to verify your arrival:'}
                </p>
                <div style={styles.otpCode}>{otp.otp_code}</div>
                <p style={styles.otpStatus}>
                  {otp.is_used
                    ? '✅ OTP verified — Worker has arrived'
                    : '⏳ Waiting for worker to verify...'}
                </p>
                {otp.expires_at && (
                  <p style={styles.otpExpiry}>
                    Expires: {new Date(otp.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                )}
              </div>
            ) : (
              <p style={styles.emptyText}>
                OTP will appear once a worker is assigned.
              </p>
            )}
          </div>
        )}

        {/* Track */}
        {activeSection === 'track' && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Live Worker Tracking</h3>
            <p style={styles.emptyText}>
              Track your worker's real-time location on the map.
            </p>
            <button
              style={styles.btnPrimary}
              onClick={() => navigate(`/track/${jobId}`)}
            >
              📍 Open Live Map
            </button>
          </div>
        )}

        {/* Chat */}
        {activeSection === 'chat' && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Chat</h3>
            <p style={styles.emptyText}>
              Chat in real-time with the {isCustomer ? 'worker' : 'customer'}.
            </p>
            <button
              style={styles.btnPrimary}
              onClick={() => navigate(`/chat/${jobId}`)}
            >
              💬 Open Chat
            </button>

          </div>
        )}

        {/* Completion Photo — Worker marks exit time */}
        {activeSection === 'payment' && isWorker && job?.status === 'in_progress' && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📸 Complete Job — Mark Exit Time</h3>
            <p style={{ color: '#555', fontSize: '14px', marginBottom: '20px', lineHeight: '1.6' }}>
              Upload a photo of the completed work. This records your <strong>exit time</strong>, updates your <strong>portfolio</strong> automatically, and notifies the customer that the job is done.
            </p>
            {exitTime ? (
              <div style={{ backgroundColor: '#d1fae5', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', margin: '0 0 8px 0' }}>✅</p>
                <p style={{ fontWeight: 'bold', color: '#065f46', fontSize: '16px', margin: '0 0 4px 0' }}>Job Completed!</p>
                <p style={{ color: '#065f46', fontSize: '13px', margin: 0 }}>Exit time: {exitTime.toLocaleString([], { hour12: true })}</p>
              </div>
            ) : (
              <div style={{ backgroundColor: '#f0fdf4', border: '2px solid #10b981', borderRadius: '12px', padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontWeight: 'bold', color: '#065f46', margin: '0 0 8px 0' }}>Step 1: Select completion photo</p>
                  <input
                    type="file" accept="image/*"
                    onChange={(e) => setCompletionPhoto(e.target.files[0])}
                    style={{ display: 'block', marginBottom: '8px' }}
                  />
                  {completionPhoto && (
                    <p style={{ color: '#10b981', fontSize: '13px', margin: 0 }}>
                      ✅ Ready: {completionPhoto.name}
                    </p>
                  )}
                </div>
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>
                    ⚠️ Once submitted, your exit time is recorded and the photo is added to your public portfolio for future customers to see.
                  </p>
                </div>
                <button
                  style={{ ...styles.btnPrimary, backgroundColor: completing ? '#9ca3af' : '#10b981', cursor: completing ? 'not-allowed' : 'pointer', width: '100%', padding: '14px', fontSize: '16px' }}
                  onClick={completeJobWithPhoto}
                  disabled={completing}
                >
                  {completing ? '⏳ Uploading...' : '📸 Upload Photo & Complete Job'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Payment */}
        {activeSection === 'payment' && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Payment & Rating</h3>

            {/* Steps */}
            <div style={styles.paySteps}>
              <div style={styles.payStep}>
                <div style={jobStatus === 'completed' ? styles.stepDone : styles.stepPending}>
                  {jobStatus === 'completed' ? '✅' : '1'}
                </div>
                <p style={styles.stepLabel}>Job Done</p>
              </div>
              <div style={styles.stepLine} />
              <div style={styles.payStep}>
                <div style={payment?.payment_sent ? styles.stepDone : styles.stepPending}>
                  {payment?.payment_sent ? '✅' : '2'}
                </div>
                <p style={styles.stepLabel}>Payment Sent</p>
              </div>
              <div style={styles.stepLine} />
              <div style={styles.payStep}>
                <div style={payment?.payment_received ? styles.stepDone : styles.stepPending}>
                  {payment?.payment_received ? '✅' : '3'}
                </div>
                <p style={styles.stepLabel}>Confirmed</p>
              </div>
              <div style={styles.stepLine} />
              <div style={styles.payStep}>
                <div style={styles.stepPending}>4</div>
                <p style={styles.stepLabel}>Rate</p>
              </div>
            </div>

            {isCustomer && jobStatus === 'completed' && !payment?.payment_sent && (
              <button style={styles.btnSuccess} onClick={payWorker}>
                💰 Pay Worker Rs.{job.rate}
              </button>
            )}

            {isWorker && payment?.payment_sent && !payment?.payment_received && (
              <div style={styles.infoBox}>
                <p style={{ margin: '0 0 10px 0' }}>
                  Customer has sent payment. Confirm receipt.
                </p>
                <button style={styles.btnSuccess} onClick={confirmPaymentReceived}>
                  ✅ Confirm Payment Received
                </button>
              </div>
            )}

            {isCustomer && payment?.payment_received && (
              <div style={styles.ratingBox}>
                <h4 style={styles.ratingTitle}>Rate the Worker</h4>
                <div style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      style={{
                        ...styles.starBtn,
                        color: star <= ratingScore ? '#f59e0b' : '#ddd',
                      }}
                      onClick={() => setRatingScore(star)}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <p style={{ color: '#666', fontSize: '14px' }}>{ratingScore}/5 stars</p>
                <textarea
                  style={styles.reviewInput}
                  placeholder="Write a review (optional)..."
                  value={ratingReview}
                  onChange={(e) => setRatingReview(e.target.value)}
                  rows={3}
                />
                <button style={styles.btnPrimary} onClick={rateWorker}>
                  Submit Rating
                </button>
              </div>
            )}

            {!payment && jobStatus !== 'completed' && (
              <p style={styles.emptyText}>
                Payment options appear after job completion.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const getStatusStyle = (status) => ({
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: 'bold',
  marginLeft: '10px',
  backgroundColor:
    status === 'completed' ? '#d1fae5' :
    status === 'in_progress' ? '#dbeafe' :
    status === 'assigned' ? '#fef3c7' : '#f3f4f6',
  color:
    status === 'completed' ? '#065f46' :
    status === 'in_progress' ? '#1d4ed8' :
    status === 'assigned' ? '#92400e' : '#333',
});

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666', padding: '20px' },
  btnBack: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', marginTop: '16px',
  },
  header: {
    backgroundColor: '#1a1a2e', padding: '20px 30px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff',
  },
  backBtn: {
    backgroundColor: 'transparent', color: '#a5b4fc', border: '1px solid #a5b4fc',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
  },
  headerCenter: { textAlign: 'center' },
  headerTitle: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 6px 0' },
  headerRate: { textAlign: 'right' },
  rate: { fontSize: '22px', fontWeight: 'bold', color: '#a5b4fc', margin: 0 },
  rateLabel: { fontSize: '11px', color: '#666', margin: '2px 0 0 0' },
  timerBox: {
    backgroundColor: '#fff', padding: '20px 30px', borderBottom: '3px solid #e5e7eb',
  },
  timerTop: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '12px',
  },
  timerTitle: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 4px 0' },
  timerBadge: {
    marginLeft: '10px', backgroundColor: '#ede9fe', color: '#4f46e5',
    padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
  },
  timerSub: { fontSize: '13px', color: '#666', margin: 0 },
  timerCountdown: { textAlign: 'right' },
  timerBig: { fontSize: '32px', fontWeight: 'bold', margin: 0 },
  timerRemaining: { fontSize: '12px', color: '#999', margin: 0 },
  timerBarBg: {
    height: '10px', backgroundColor: '#f3f4f6',
    borderRadius: '5px', overflow: 'hidden', marginBottom: '6px',
  },
  timerBarFill: { height: '100%', borderRadius: '5px', transition: 'width 0.5s' },
  timerElapsed: { fontSize: '12px', color: '#999', margin: 0 },
  arrivedBanner: {
    backgroundColor: '#d1fae5', color: '#065f46', padding: '14px 30px',
    fontWeight: 'bold', fontSize: '15px', textAlign: 'center',
  },
  lateAlert: {
    backgroundColor: '#fee2e2', padding: '16px 30px',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: '12px',
  },
  lateTitle: { fontSize: '16px', fontWeight: 'bold', color: '#991b1b', margin: '0 0 4px 0' },
  lateText: { fontSize: '14px', color: '#7f1d1d', margin: 0 },
  btnEmergency: {
    backgroundColor: '#ef4444', color: '#fff', border: 'none',
    padding: '12px 20px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '14px', fontWeight: 'bold',
  },
  emergencySection: {
    backgroundColor: '#fff7ed', padding: '24px 30px', borderBottom: '1px solid #fed7aa',
  },
  emergencyTitle: { fontSize: '18px', fontWeight: 'bold', color: '#c2410c', margin: '0 0 4px 0' },
  emergencySub: { color: '#666', fontSize: '14px', marginBottom: '16px' },
  backupsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px', marginBottom: '16px',
  },
  backupCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '16px',
    textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  backupAvatar: {
    width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#4f46e5',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '20px', fontWeight: 'bold', margin: '0 auto 10px auto',
  },
  backupName: { fontSize: '15px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 4px 0' },
  backupMeta: { fontSize: '13px', color: '#666', margin: '3px 0' },
  skillsRow: {
    display: 'flex', flexWrap: 'wrap', gap: '4px',
    justifyContent: 'center', margin: '8px 0',
  },
  skillBadge: {
    backgroundColor: '#ede9fe', color: '#4f46e5',
    padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
  },
  backupStatusBadge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
    fontSize: '11px', fontWeight: 'bold', marginBottom: '8px',
  },
  btnChoose: {
    backgroundColor: '#10b981', color: '#fff', border: 'none',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '13px', width: '100%', marginTop: '4px',
  },
  optionsBox: {
    backgroundColor: '#fff', padding: '16px', borderRadius: '8px',
    border: '1px solid #fed7aa',
  },
  optionsTitle: { fontWeight: 'bold', color: '#c2410c', margin: '0 0 8px 0' },
  optionItem: { fontSize: '14px', color: '#555', margin: '4px 0' },
  btnTrack: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '13px', marginTop: '12px',
  },
  sectionsNav: {
    display: 'flex', backgroundColor: '#fff', borderBottom: '1px solid #eee',
    padding: '0 30px', overflowX: 'auto',
  },
  sectionBtn: {
    padding: '14px 20px', border: 'none', backgroundColor: 'transparent',
    cursor: 'pointer', fontSize: '14px', color: '#666', whiteSpace: 'nowrap',
  },
  sectionBtnActive: {
    padding: '14px 20px', border: 'none', backgroundColor: 'transparent',
    cursor: 'pointer', fontSize: '14px', color: '#4f46e5',
    borderBottom: '3px solid #4f46e5', fontWeight: 'bold', whiteSpace: 'nowrap',
  },
  content: { padding: '30px', maxWidth: '800px', margin: '0 auto' },
  card: {
    backgroundColor: '#fff', borderRadius: '12px',
    padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  cardTitle: { fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '16px' },
  detailsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px', marginBottom: '16px',
  },
  detailItem: { backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '8px' },
  detailLabel: { fontSize: '11px', color: '#999', margin: '0 0 4px 0', textTransform: 'uppercase' },
  detailValue: { fontSize: '15px', fontWeight: 'bold', color: '#333', margin: 0 },
  scheduledBox: {
    backgroundColor: '#ede9fe', padding: '14px', borderRadius: '8px', marginBottom: '16px',
  },
  scheduledLabel: { fontSize: '12px', color: '#4f46e5', margin: '0 0 4px 0', fontWeight: 'bold' },
  scheduledValue: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 },
  descBox: {
    backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '16px',
  },
  descText: { fontSize: '15px', color: '#444', lineHeight: '1.6', margin: '8px 0 0 0' },
  jobPhoto: { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' },
  otpBox: { textAlign: 'center', padding: '20px' },
  otpLabel: { fontSize: '16px', color: '#666', marginBottom: '16px' },
  otpCode: {
    fontSize: '52px', fontWeight: 'bold', color: '#4f46e5',
    letterSpacing: '12px', margin: '16px 0',
  },
  otpStatus: { fontSize: '15px', color: '#333', margin: '8px 0' },
  otpExpiry: { fontSize: '13px', color: '#999' },
  emptyText: { color: '#666', textAlign: 'center', padding: '20px', fontSize: '15px' },
  btnPrimary: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '12px 24px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '15px', fontWeight: 'bold', display: 'block', width: '100%', marginTop: '16px',
  },

  paySteps: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '24px', flexWrap: 'wrap', gap: '4px',
  },
  payStep: { textAlign: 'center', minWidth: '60px' },
  stepLine: {
    height: '2px', backgroundColor: '#e5e7eb', flex: 1,
    minWidth: '20px', marginBottom: '20px',
  },
  stepDone: {
    width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#10b981',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '18px', margin: '0 auto 8px auto',
  },
  stepPending: {
    width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e5e7eb',
    color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', fontWeight: 'bold', margin: '0 auto 8px auto',
  },
  stepLabel: { fontSize: '11px', color: '#666', margin: 0 },
  btnSuccess: {
    backgroundColor: '#10b981', color: '#fff', border: 'none',
    padding: '12px 24px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '15px', fontWeight: 'bold', width: '100%', marginTop: '12px',
  },
  infoBox: { backgroundColor: '#d1fae5', padding: '16px', borderRadius: '8px' },
  ratingBox: { marginTop: '24px', borderTop: '1px solid #eee', paddingTop: '24px' },
  ratingTitle: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '12px' },
  starsRow: { display: 'flex', gap: '8px', marginBottom: '8px' },
  starBtn: { fontSize: '36px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  reviewInput: {
    width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
    fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box', resize: 'vertical',
  },
};

export default ActiveJob;