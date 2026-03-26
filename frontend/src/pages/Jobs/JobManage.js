import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const JobManage = () => {
  const { jobId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [otp, setOtp] = useState(null);
  const [payment, setPayment] = useState(null);
  const [noShow, setNoShow] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingReview, setRatingReview] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [waitChosen, setWaitChosen] = useState(false);

  useEffect(() => {
    setJob(null); setApplicants([]); setOtp(null); setPayment(null);
    setNoShow(null); setBackups([]); setActiveTab('details'); setLoading(true);
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [jobId]);

  const fetchAll = async () => {
    try {
      const jobRes = await axios.get(`http://localhost:5000/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJob(jobRes.data.job);

      const status = jobRes.data.job.status;

      if (status === 'open') {
        try {
          const appRes = await axios.get(
            `http://localhost:5000/api/applications/${jobId}/applicants`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setApplicants(appRes.data.applicants || []);
        } catch (e) {}
      }

      if (['assigned', 'in_progress', 'completed'].includes(status)) {
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
      }

      if (['assigned', 'in_progress'].includes(status)) {
        let noShowData = null;
        try {
          const nsRes = await axios.get(`http://localhost:5000/api/emergency/check/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          noShowData = nsRes.data;
          setNoShow(nsRes.data);
        } catch (e) {}

        let currentBackups = [];
        try {
          const bkRes = await axios.get(`http://localhost:5000/api/emergency/${jobId}/backups`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          currentBackups = bkRes.data.backup_workers || [];
          setBackups(currentBackups);
        } catch (e) {}

        if (noShowData?.is_late && !noShowData?.is_waiting && !noShowData?.auto_cancelled && currentBackups.length === 0) {
          try {
            await axios.post(`http://localhost:5000/api/emergency/trigger/${jobId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            const reloadBk = await axios.get(`http://localhost:5000/api/emergency/${jobId}/backups`, { headers: { Authorization: `Bearer ${token}` } });
            setBackups(reloadBk.data.backup_workers || []);
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('Failed to fetch job:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshOtp = async () => {
    try {
      const otpRes = await axios.get(`http://localhost:5000/api/otp/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOtp(otpRes.data.otp);
      if (!otpRes.data.otp) alert('No OTP found yet. Select a worker first.');
    } catch (e) {
      alert('Failed to refresh OTP: ' + (e.response?.data?.message || e.message));
    }
  };

  const selectWorker = async (workerId, workerName) => {
    if (!window.confirm(`Select ${workerName} for this job?`)) return;
    try {
      const res = await axios.post(
        `http://localhost:5000/api/applications/${jobId}/select/${workerId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message);
      fetchAll();
      setActiveTab('details');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to select worker.');
    }
  };

  const deleteJob = async () => {
    if (!window.confirm('Delete this job?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Job deleted!');
      navigate('/customer-dashboard');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete.');
    }
  };

  const triggerEmergency = async () => {
    try {
      await axios.post(
        `http://localhost:5000/api/emergency/trigger/${jobId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Always reload from getEmergencyBackups for correct worker_id + status fields
      const res = await axios.get(
        `http://localhost:5000/api/emergency/${jobId}/backups`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to trigger emergency.');
    }
  };

  const chooseBackup = async (workerId, workerName) => {
    if (!window.confirm(`Assign ${workerName} as backup worker?`)) return;
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

  const cancelJob = async () => {
    if (!window.confirm('Are you sure you want to cancel this job?')) return;
    try {
      await axios.post(
        `http://localhost:5000/api/emergency/${jobId}/cancel`,
        {}, { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Job cancelled.');
      navigate('/customer-dashboard');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel.');
    }
  };

  const chooseWait = async () => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/emergency/${jobId}/wait`,
        {}, { headers: { Authorization: `Bearer ${token}` } }
      );
      setWaitChosen(true);
      setNoShow(prev => ({
        ...prev,
        is_waiting: true,
        wait_mins_left: res.data.wait_mins_left,
        wait_until: res.data.wait_until,
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to set wait.');
    }
  };

  const payWorker = async () => {
    try {
      try {
        await axios.post('http://localhost:5000/api/payments/initiate',
          { job_id: jobId, amount: job.rate },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (e) {}
      await axios.put(`http://localhost:5000/api/payments/${jobId}/sent`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Payment marked as sent!');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Payment failed.');
    }
  };

  const rateWorker = async () => {
    try {
      await axios.post(`http://localhost:5000/api/ratings/${jobId}`,
        { score: ratingScore, review: ratingReview },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRatingSubmitted(true);
      fetchAll();
    } catch (err) {
      // If already rated, still mark as submitted
      if (err.response?.data?.message?.toLowerCase().includes('already')) {
        setRatingSubmitted(true);
      } else {
        alert(err.response?.data?.message || 'Rating failed.');
      }
    }
  };

  if (loading) return <div style={s.center}>Loading...</div>;
  if (!job) return <div style={s.center}>Job not found. <button onClick={() => navigate(-1)}>Go Back</button></div>;

  const status = job.status;
  const isWorkerAssigned = ['assigned', 'in_progress'].includes(status);
  const deadlineMs = job?.arrival_deadline ? new Date(job.arrival_deadline).getTime() : null;
  const deadlineAlreadyPassed = deadlineMs && Date.now() > deadlineMs;
  const minutesLeft = noShow?.minutes_left ?? (deadlineAlreadyPassed ? 0 : 30);
  const minutesElapsed = noShow?.minutes_elapsed ?? (deadlineAlreadyPassed ? 30 : 0);
  const timerPct = Math.max(0, Math.min(100, (minutesLeft / 30) * 100));
  const isEffectivelyLate = isWorkerAssigned && (noShow?.is_late || (deadlineAlreadyPassed && !noShow));
  const timerColor = isEffectivelyLate ? '#ef4444' : minutesLeft <= 5 ? '#ef4444' : minutesLeft <= 10 ? '#f59e0b' : '#10b981';
  const workerArrived = otp?.is_used;
  // Arrival deadline: urgent = job posted + 30min, scheduled = scheduled_time + 30min
  const arrivalDeadlineStr = job?.arrival_deadline
    ? new Date(job.arrival_deadline).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
    : null;

  // Build tabs based on job status
  const tabs = ['details'];
  if (status === 'open') tabs.push('applicants', 'edit');
  if (['assigned', 'in_progress'].includes(status)) tabs.push('otp', 'track', 'chat', 'payment');
  if (status === 'completed') tabs.push('payment');

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/customer-dashboard')}>← Dashboard</button>
        <div style={s.headerMid}>
          <h2 style={s.headerTitle}>{job.title}</h2>
          <div style={s.headerBadges}>
            <span style={{ ...s.badge, backgroundColor: getStatusBg(status), color: getStatusText(status) }}>
              {status.replace('_', ' ').toUpperCase()}
            </span>
            <span style={{ ...s.badge, backgroundColor: job.urgency === 'urgent' ? '#fee2e2' : '#dbeafe', color: job.urgency === 'urgent' ? '#991b1b' : '#1d4ed8' }}>
              {job.urgency === 'urgent' ? '🔴 URGENT' : '🔵 SCHEDULED'}
            </span>
          </div>
        </div>
        <div style={s.headerRate}>Rs.{job.rate}</div>
      </div>

      {/* Timer — only for assigned/in_progress */}
      {['assigned', 'in_progress'].includes(status) && noShow && !workerArrived && !noShow.is_late && !isEffectivelyLate && (
        <div style={s.timerBox}>
          <div style={s.timerRow}>
            <div>
              <p style={s.timerTitle}>⏱ Waiting for Worker to Arrive</p>
              <p style={s.timerSub}>
                {job.arrival_deadline
                  ? job.urgency === 'scheduled'
                    ? `Must arrive by: ${new Date(job.arrival_deadline).toLocaleString()} (30 min after scheduled time)`
                    : `Must arrive by: ${new Date(job.arrival_deadline).toLocaleString()} (30 min from selection)`
                  : 'Worker has 30 minutes to arrive'}
              </p>
              <p style={s.timerElapsed}>Worker selected {minutesElapsed} min ago — {minutesLeft} min remaining to arrive</p>
              {arrivalDeadlineStr && (
                <p style={{ fontSize: '13px', color: '#4f46e5', fontWeight: '600', margin: '4px 0 0 0' }}>
                  📅 Deadline: {arrivalDeadlineStr}
                </p>
              )}
            </div>
            <div style={s.timerRight}>
              <p style={{ ...s.timerBig, color: timerColor }}>{minutesLeft} min</p>
              <p style={s.timerLabel}>remaining</p>
            </div>
          </div>
          <div style={s.timerBg}>
            <div style={{ ...s.timerFill, width: `${timerPct}%`, backgroundColor: timerColor }} />
          </div>
        </div>
      )}

      {/* Worker Arrived */}
      {workerArrived && (
        <div style={s.arrivedBanner}>✅ Worker has arrived and verified OTP!</div>
      )}

      {/* Worker Late — 3 Options Panel */}
      {(noShow?.is_late || isEffectivelyLate) && !workerArrived && !noShow?.auto_cancelled && (
        <div style={{
          margin: '16px 0', borderRadius: '16px', overflow: 'hidden',
          border: '2px solid #fca5a5', boxShadow: '0 4px 24px rgba(239,68,68,0.15)',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span style={{ fontSize: '28px' }}>⏰</span>
            <div>
              <p style={{ margin: 0, color: '#fff', fontWeight: '700', fontSize: '18px' }}>
                Worker Has Not Arrived
              </p>
              <p style={{ margin: '2px 0 0 0', color: '#fecaca', fontSize: '13px' }}>
                {job.urgency === 'urgent'
                  ? `Worker was due 30 min after selection (by ${arrivalDeadlineStr})`
                  : `Worker was due 30 min after scheduled time (by ${arrivalDeadlineStr})`}
                {' '}· {minutesElapsed} minutes overdue
              </p>
            </div>
          </div>

          <div style={{ background: '#fff9f9', padding: '20px 24px' }}>

            {/* Waiting countdown — shown after customer clicks Wait */}
            {noShow?.is_waiting && (
              <div style={{
                marginBottom: '16px', padding: '14px 18px', borderRadius: '12px',
                background: '#eff6ff', border: '1.5px solid #93c5fd',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <span style={{ fontSize: '28px' }}>⏳</span>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: '#1e3a5f', fontSize: '15px' }}>
                    Waiting {noShow.wait_mins_left ?? 10} more minute{noShow.wait_mins_left !== 1 ? 's' : ''}...
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    If the worker does not arrive by {noShow.wait_until ? new Date(noShow.wait_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}, the job will be <strong>cancelled automatically</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Auto-cancelled notice */}
            {noShow?.auto_cancelled && (
              <div style={{
                marginBottom: '16px', padding: '14px 18px', borderRadius: '12px',
                background: '#fee2e2', border: '1.5px solid #fca5a5',
              }}>
                <p style={{ margin: 0, fontWeight: '700', color: '#991b1b' }}>
                  ❌ Job Auto-Cancelled
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  The worker did not arrive within the extra 10 minutes. The job has been cancelled.
                </p>
              </div>
            )}

            {!noShow?.is_waiting && !noShow?.auto_cancelled && (
              <>
                <p style={{ margin: '0 0 16px 0', fontWeight: '700', fontSize: '15px', color: '#1a1a2e' }}>
                  What would you like to do?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  {/* Option 1 — Wait 10 min */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderRadius: '12px',
                    background: '#eff6ff', border: '1.5px solid #93c5fd',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: '#3b82f6', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '700', fontSize: '16px', flexShrink: 0,
                      }}>1</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>
                          Wait 10 More Minutes
                        </p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                          Give the worker 10 more minutes. If they still don't arrive, the job will be cancelled automatically.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={chooseWait}
                      style={{
                        padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        background: '#3b82f6', color: '#fff', fontWeight: '600', fontSize: '13px',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                      ⏳ Wait
                    </button>
                  </div>

                  {/* Option 2 — Cancel */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderRadius: '12px',
                    background: '#fff1f2', border: '1.5px solid #fca5a5',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: '#ef4444', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '700', fontSize: '16px', flexShrink: 0,
                      }}>2</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: '600', color: '#7f1d1d', fontSize: '14px' }}>Cancel Job</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                          Cancel this job entirely and release the worker.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={cancelJob}
                      style={{
                        padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        background: '#ef4444', color: '#fff', fontWeight: '600', fontSize: '13px',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                      ❌ Cancel
                    </button>
                  </div>

                  {/* Option 3 — Choose Backup Worker */}
                  <div style={{
                    padding: '14px 18px', borderRadius: '12px',
                    background: '#f5f3ff', border: '1.5px solid #a78bfa',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: backups.length > 0 ? '16px' : '0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: '#7c3aed', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '16px', flexShrink: 0,
                        }}>3</span>
                        <div>
                          <p style={{ margin: 0, fontWeight: '600', color: '#3b0764', fontSize: '14px' }}>Choose Backup Worker</p>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                            {backups.length === 0
                              ? '3 nearby workers will be notified immediately — pick one to replace your current worker'
                              : `${backups.length} backup worker${backups.length > 1 ? 's' : ''} notified — choose one below`}
                          </p>
                        </div>
                      </div>
                      {backups.length === 0 && (
                        <button
                          onClick={triggerEmergency}
                          style={{
                            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: '#7c3aed', color: '#fff', fontWeight: '600', fontSize: '13px',
                            whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                          🚨 Notify Backups
                        </button>
                      )}
                    </div>

                    {/* Backup worker cards — sorted by proximity */}
                    {backups.length > 0 && (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {backups.map((w, idx) => {
                          const wId = w.worker_id || w.id;
                          const isAssigned = w.status === 'assigned';
                          return (
                            <div key={wId || idx} style={{
                              flex: '1', minWidth: '160px', background: '#fff', borderRadius: '12px',
                              padding: '16px', textAlign: 'center',
                              border: isAssigned ? '2px solid #6ee7b7' : '1.5px solid #ddd8fe',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                            }}>
                              {/* Proximity badge */}
                              <div style={{
                                fontSize: '10px', fontWeight: '700', marginBottom: '8px',
                                color: '#7c3aed', background: '#ede9fe',
                                borderRadius: '999px', padding: '2px 10px', display: 'inline-block',
                              }}>
                                #{idx + 1} NEARBY
                              </div>
                              <div style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: '700', fontSize: '22px', margin: '0 auto 10px auto',
                              }}>
                                {(w.full_name || '?').charAt(0).toUpperCase()}
                              </div>
                              <p style={{ margin: '0 0 4px 0', fontWeight: '700', fontSize: '14px', color: '#1a1a2e' }}>
                                {w.full_name}
                              </p>
                              <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#f59e0b' }}>
                                ⭐ {parseFloat(w.rating || 0).toFixed(1)}
                              </p>
                              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b' }}>
                                📞 {w.phone}
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginBottom: '12px' }}>
                                {(w.skills || []).slice(0, 3).map(sk => (
                                  <span key={sk} style={{
                                    fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
                                    background: '#ede9fe', color: '#4f46e5', fontWeight: '600',
                                  }}>{sk}</span>
                                ))}
                              </div>
                              {isAssigned ? (
                                <div style={{
                                  padding: '8px', borderRadius: '8px',
                                  background: '#d1fae5', color: '#065f46',
                                  fontWeight: '700', fontSize: '13px',
                                }}>
                                  ✅ CHOSEN
                                </div>
                              ) : (
                                <button
                                  onClick={() => chooseBackup(wId, w.full_name)}
                                  style={{
                                    width: '100%', padding: '10px 0', borderRadius: '8px',
                                    border: 'none', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                    color: '#fff', fontWeight: '700', fontSize: '13px',
                                  }}>
                                  ✅ Choose This Worker
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Auto-cancelled banner — job was cancelled because worker didn't arrive in wait window */}
      {noShow?.auto_cancelled && (
        <div style={{
          margin: '16px 0', padding: '20px 24px', borderRadius: '12px',
          background: '#fee2e2', border: '2px solid #fca5a5', textAlign: 'center',
        }}>
          <p style={{ fontSize: '24px', margin: '0 0 8px 0' }}>❌</p>
          <p style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: '#991b1b' }}>Job Auto-Cancelled</p>
          <p style={{ margin: '6px 0 16px 0', fontSize: '13px', color: '#64748b' }}>
            The worker did not arrive within the extra 10 minutes. This job has been cancelled automatically.
          </p>
          <button
            onClick={() => navigate('/customer-dashboard')}
            style={{
              padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: '#ef4444', color: '#fff', fontWeight: '700', fontSize: '14px',
            }}>
            Back to Dashboard
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabs}>
        {tabs.map((t) => (
          <button
            key={t}
            style={activeTab === t ? s.tabActive : s.tab}
            onClick={() => { setActiveTab(t); if (t === 'applicants') fetchAll(); }}
          >
            {t === 'details' && '📋 Details'}
            {t === 'applicants' && `👥 Applicants (${applicants.length})`}
            {t === 'edit' && '✏️ Edit'}
            {t === 'otp' && '🔑 OTP'}
            {t === 'track' && '📍 Track'}
            {t === 'chat' && '💬 Chat'}
            {t === 'payment' && '💰 Payment'}
          </button>
        ))}
      </div>

      <div style={s.content}>

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div style={s.card}>
            <div style={s.detailGrid}>
              {[
                ['Title', job.title],
                ['Labor Type', job.labor_type],
                ['Location', job.location],
                ['Rate', `Rs.${job.rate}`],
                ['Urgency', job.urgency.toUpperCase()],
                ['Workers Needed', job.workers_needed],
                ['Status', status.replace('_', ' ').toUpperCase()],
                ['Posted', new Date(job.created_at).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={k} style={s.detailItem}>
                  <p style={s.detailKey}>{k}</p>
                  <p style={s.detailVal}>{v}</p>
                </div>
              ))}
            </div>

            {job.scheduled_time && (
              <div style={s.scheduledBox}>
                <p style={s.scheduledLabel}>📅 Scheduled Arrival Time</p>
                <p style={s.scheduledVal}>{new Date(job.scheduled_time).toLocaleString()}</p>
              </div>
            )}

            <div style={s.descBox}>
              <p style={s.detailKey}>Description</p>
              <p style={s.descText}>{job.description}</p>
            </div>

            {job.photo_url && (
              <img src={job.photo_url} alt="job" style={s.jobImg} />
            )}

            {status === 'open' && (
              <div style={s.actionRow}>
                <button style={s.btnEdit} onClick={() => navigate(`/edit-job/${jobId}`)}>
                  ✏️ Edit Job
                </button>
                <button style={s.btnDelete} onClick={deleteJob}>
                  🗑️ Delete Job
                </button>
              </div>
            )}

            {['assigned', 'in_progress'].includes(status) && (
              <div style={s.actionRow}>
                <button style={s.btnPrimary} onClick={() => navigate(`/track/${jobId}`)}>
                  📍 Live Track Worker
                </button>
                <button style={s.btnSecondary} onClick={() => navigate(`/chat/${jobId}`)}>
                  💬 Chat with Worker
                </button>
              </div>
            )}
          </div>
        )}

        {/* Applicants Tab */}
        {activeTab === 'applicants' && (
          <div>
            <h3 style={s.tabTitle}>Job Applicants ({applicants.length})</h3>
            {applicants.length === 0 ? (
              <div style={s.emptyCard}>
                <p style={{ fontSize: '40px' }}>👥</p>
                <p style={s.emptyTitle}>No applicants yet</p>
                <p style={s.emptyText}>Workers will apply soon. Check back later!</p>
              </div>
            ) : (
              <div style={s.applicantsList}>
                {applicants.map((a) => (
                  <div key={a.worker_id} style={s.applicantCard}>
                    <div style={s.appLeft}>
                      <div style={s.appAvatar}>{a.full_name.charAt(0)}</div>
                      <div>
                        <h4 style={s.appName}>{a.full_name}</h4>
                        <p style={s.appMeta}>⭐ {parseFloat(a.rating || 0).toFixed(1)} ({a.total_ratings || 0} reviews)</p>
                        <p style={s.appMeta}>📞 {a.phone}</p>
                        <div style={s.skillsRow}>
                          {(a.skills || []).map(sk => (
                            <span key={sk} style={s.skillTag}>{sk}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={s.appActions}>
                      <button style={s.btnSelect} onClick={() => selectWorker(a.worker_id, a.full_name)}>
                        ✅ Select Worker
                      </button>
                      <button style={s.btnViewProfile} onClick={() => navigate(`/worker/${a.worker_id}`)}>
                        View Profile
                      </button>
                      <a href={`tel:${a.phone}`} style={s.btnCall}>📞 Call</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit Tab */}
        {activeTab === 'edit' && (
          <div style={s.card}>
            <h3 style={s.tabTitle}>Edit Job</h3>
            <p style={s.editNote}>
              This will take you to the edit page where you can update all job details.
            </p>
            <button style={s.btnPrimary} onClick={() => navigate(`/edit-job/${jobId}`)}>
              ✏️ Open Edit Page
            </button>
          </div>
        )}

        {/* OTP Tab */}
        {activeTab === 'otp' && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ ...s.tabTitle, margin: 0 }}>OTP Verification</h3>
              <button style={s.btnRefreshOtp} onClick={refreshOtp}>🔄 Refresh Status</button>
            </div>

            {/* Scheduled time reminder */}
            {job.scheduled_time && (
              <div style={s.scheduledReminder}>
                <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>📅 Scheduled Arrival Time</p>
                <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                  {new Date(job.scheduled_time).toLocaleString()}
                </p>
              </div>
            )}

            {otp ? (
              <div style={s.otpBox}>
                <p style={s.otpLabel}>Share this code with your worker when they arrive:</p>
                <div style={s.otpCode}>{otp.otp_code}</div>
                <div style={{
                  ...s.otpStatus,
                  backgroundColor: otp.is_used ? '#d1fae5' : '#fef3c7',
                  color: otp.is_used ? '#065f46' : '#92400e',
                }}>
                  {otp.is_used ? '✅ OTP Verified — Worker has arrived!' : '⏳ Waiting for worker to verify...'}
                </div>
              </div>
            ) : (
              <div style={s.otpMissing}>
                <p style={{ color: '#92400e', fontWeight: 'bold', margin: '0 0 8px 0' }}>⚠️ No OTP generated yet</p>
                <p style={{ color: '#666', fontSize: '14px', margin: '0 0 12px 0' }}>OTP is created when you select a worker. Click Refresh Status to check.</p>
                <button style={s.btnRefreshOtp} onClick={refreshOtp}>🔄 Refresh Status</button>
              </div>
            )}


          </div>
        )}

        {/* Track Tab */}
        {activeTab === 'track' && (
          <div style={s.card}>
            <h3 style={s.tabTitle}>Live Worker Tracking</h3>
            <p style={s.emptyText}>See exactly where your worker is in real-time.</p>
            <button style={s.btnPrimary} onClick={() => navigate(`/track/${jobId}`)}>
              📍 Open Live Map
            </button>
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div style={s.card}>
            <h3 style={s.tabTitle}>Chat with Worker</h3>
            <p style={s.emptyText}>Chat directly with your assigned worker.</p>
            <button style={s.btnPrimary} onClick={() => navigate(`/chat/${jobId}`)}>
              💬 Open Chat
            </button>
          </div>
        )}

        {/* Payment Tab */}
        {activeTab === 'payment' && (
          <div style={s.card}>
            <h3 style={s.tabTitle}>Payment & Rating</h3>

            {/* Steps */}
            <div style={s.steps}>
              {[
                { label: 'Job Done', done: status === 'completed' || !!payment },
                { label: 'Payment Sent', done: payment?.payment_sent },
                { label: 'Payment Confirmed', done: payment?.payment_received },
                { label: 'Worker Rated', done: ratingSubmitted },
              ].map((step, i) => (
                <React.Fragment key={i}>
                  <div style={s.step}>
                    <div style={step.done ? s.stepDone : s.stepPend}>
                      {step.done ? '✓' : i + 1}
                    </div>
                    <p style={s.stepLbl}>{step.label}</p>
                  </div>
                  {i < 3 && <div style={s.stepLine} />}
                </React.Fragment>
              ))}
            </div>

            {status === 'completed' && !payment?.payment_sent && (
              <div style={s.payBox}>
                <p style={s.payInfo}>Job is complete! Pay your worker Rs.{job.rate}</p>
                <button style={s.btnPay} onClick={payWorker}>
                  💰 Pay Worker Rs.{job.rate}
                </button>
              </div>
            )}

            {payment?.payment_sent && !payment?.payment_received && (
              <div style={s.payBox}>
                <p style={s.payInfo}>✅ Payment sent! Waiting for worker to confirm receipt.</p>
              </div>
            )}

            {payment?.payment_received && (
              <div style={s.ratingBox}>
                {ratingSubmitted ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ fontSize: '40px', margin: '0 0 10px 0' }}>🎉</p>
                    <h4 style={{ color: '#065f46', fontWeight: 'bold', margin: '0 0 6px 0' }}>Rating Submitted!</h4>
                    <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                      {'★'.repeat(ratingScore)}{'☆'.repeat(5 - ratingScore)} {ratingScore}/5 stars
                    </p>
                    <p style={{ color: '#666', fontSize: '13px', margin: '8px 0 0 0' }}>
                      Job cycle complete. Thank you!
                    </p>
                  </div>
                ) : (
                  <>
                    <h4 style={s.ratingTitle}>⭐ Rate Your Worker</h4>
                    <div style={s.starsRow}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} style={{ ...s.star, color: star <= ratingScore ? '#f59e0b' : '#ddd' }}
                          onClick={() => setRatingScore(star)}>★</button>
                      ))}
                    </div>
                    <p style={{ color: '#666', marginBottom: '12px' }}>{ratingScore}/5 stars</p>
                    <textarea
                      style={s.reviewInput}
                      placeholder="Write a review (optional)..."
                      value={ratingReview}
                      onChange={(e) => setRatingReview(e.target.value)}
                      rows={3}
                    />
                    <button style={s.btnPrimary} onClick={rateWorker}>Submit Rating</button>
                  </>
                )}
              </div>
            )}

            {!payment && status !== 'completed' && (
              <p style={s.emptyText}>Payment options appear after job completion.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const getStatusBg = (s) => ({ open: '#d1fae5', assigned: '#fef3c7', in_progress: '#dbeafe', completed: '#ede9fe', cancelled: '#fee2e2' }[s] || '#f3f4f6');
const getStatusText = (s) => ({ open: '#065f46', assigned: '#92400e', in_progress: '#1d4ed8', completed: '#4f46e5', cancelled: '#991b1b' }[s] || '#333');

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  center: { textAlign: 'center', marginTop: '100px', fontSize: '18px', color: '#666', padding: '20px' },
  header: {
    backgroundColor: '#1a1a2e', padding: '16px 30px', color: '#fff',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: {
    backgroundColor: 'transparent', color: '#a5b4fc', border: '1px solid #a5b4fc',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
  },
  headerMid: { textAlign: 'center' },
  headerTitle: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 6px 0' },
  headerBadges: { display: 'flex', gap: '8px', justifyContent: 'center' },
  headerRate: { fontSize: '24px', fontWeight: 'bold', color: '#a5b4fc' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' },
  timerBox: { backgroundColor: '#fff', padding: '20px 30px', borderBottom: '3px solid #e5e7eb' },
  timerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  timerTitle: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 4px 0' },
  timerSub: { fontSize: '13px', color: '#666', margin: '0 0 4px 0' },
  timerElapsed: { fontSize: '12px', color: '#999', margin: 0 },
  timerRight: { textAlign: 'right' },
  timerBig: { fontSize: '36px', fontWeight: 'bold', margin: 0 },
  timerLabel: { fontSize: '12px', color: '#999', margin: 0 },
  timerBg: { height: '12px', backgroundColor: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: '6px', transition: 'width 0.5s' },
  arrivedBanner: { backgroundColor: '#d1fae5', color: '#065f46', padding: '14px 30px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' },
  lateBanner: { backgroundColor: '#fee2e2', padding: '16px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  lateTitle: { fontSize: '16px', fontWeight: 'bold', color: '#991b1b', margin: '0 0 4px 0' },
  lateSub: { fontSize: '13px', color: '#7f1d1d', margin: 0 },
  btnEmergency: { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  backupSection: { backgroundColor: '#fff7ed', padding: '24px 30px', borderBottom: '1px solid #fed7aa' },
  backupTitle: { fontSize: '20px', fontWeight: 'bold', color: '#c2410c', margin: '0 0 6px 0' },
  backupSub: { color: '#555', marginBottom: '20px' },
  backupGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' },
  backupCard: { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  backupAvatar: { width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 'bold', margin: '0 auto 10px auto' },
  backupName: { fontSize: '15px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 4px 0' },
  backupMeta: { fontSize: '13px', color: '#666', margin: '3px 0' },
  btnChoose: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', width: '100%', marginTop: '8px', fontWeight: 'bold' },
  optionsBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #fed7aa' },
  optionsTitle: { fontWeight: 'bold', color: '#c2410c', margin: '0 0 14px 0', fontSize: '16px' },
  optionItemSimple: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', fontSize: '14px', color: '#333' },
  btnSmall: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginLeft: 'auto' },
  tabs: { display: 'flex', backgroundColor: '#fff', borderBottom: '1px solid #eee', padding: '0 30px', overflowX: 'auto' },
  tab: { padding: '14px 18px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '14px', color: '#666', whiteSpace: 'nowrap' },
  tabActive: { padding: '14px 18px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '14px', color: '#4f46e5', borderBottom: '3px solid #4f46e5', fontWeight: 'bold', whiteSpace: 'nowrap' },
  content: { padding: '30px', maxWidth: '900px', margin: '0 auto' },
  card: { backgroundColor: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  tabTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 20px 0' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' },
  detailItem: { backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px' },
  detailKey: { fontSize: '11px', color: '#999', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 'bold' },
  detailVal: { fontSize: '15px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 },
  scheduledBox: { backgroundColor: '#ede9fe', padding: '16px', borderRadius: '10px', marginBottom: '16px' },
  scheduledLabel: { fontSize: '13px', color: '#4f46e5', fontWeight: 'bold', margin: '0 0 6px 0' },
  scheduledVal: { fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e', margin: 0 },
  descBox: { backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '16px' },
  descText: { fontSize: '15px', color: '#444', lineHeight: '1.7', margin: '8px 0 0 0' },
  jobImg: { width: '100%', height: '220px', objectFit: 'cover', borderRadius: '10px', marginBottom: '16px' },
  actionRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' },
  btnPrimary: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' },
  btnSecondary: { backgroundColor: '#f3f4f6', color: '#333', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' },
  btnEdit: { backgroundColor: '#fef3c7', color: '#92400e', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' },
  btnDelete: { backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' },
  emptyCard: { backgroundColor: '#fff', borderRadius: '16px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  emptyTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', margin: '8px 0' },
  emptyText: { color: '#666', fontSize: '15px', textAlign: 'center', padding: '20px 0' },
  applicantsList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  applicantCard: { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' },
  appLeft: { display: 'flex', gap: '16px', alignItems: 'flex-start' },
  appAvatar: { width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', flexShrink: 0 },
  appName: { fontSize: '17px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 4px 0' },
  appMeta: { fontSize: '13px', color: '#666', margin: '3px 0' },
  skillsRow: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' },
  skillTag: { backgroundColor: '#ede9fe', color: '#4f46e5', padding: '2px 8px', borderRadius: '20px', fontSize: '11px' },
  appActions: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '140px' },
  btnSelect: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  btnViewProfile: { backgroundColor: '#ede9fe', color: '#4f46e5', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  btnCall: { backgroundColor: '#f3f4f6', color: '#333', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', textDecoration: 'none', textAlign: 'center' },
  editNote: { color: '#666', marginBottom: '16px' },
  otpBox: { textAlign: 'center', padding: '20px' },
  otpLabel: { fontSize: '16px', color: '#666', marginBottom: '16px' },
  otpCode: { fontSize: '56px', fontWeight: 'bold', color: '#4f46e5', letterSpacing: '14px', margin: '16px 0' },
  otpStatus: { padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', display: 'inline-block' },
  otpExpiry: { fontSize: '13px', color: '#999', marginTop: '10px' },
  steps: { display: 'flex', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap' },
  step: { textAlign: 'center', minWidth: '80px' },
  stepDone: { width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', margin: '0 auto 8px auto' },
  stepPend: { width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#e5e7eb', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', margin: '0 auto 8px auto' },
  stepLine: { flex: 1, height: '2px', backgroundColor: '#e5e7eb', marginBottom: '24px', minWidth: '20px' },
  stepLbl: { fontSize: '11px', color: '#666', margin: 0 },
  payBox: { backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '12px', marginBottom: '16px' },
  payInfo: { fontSize: '15px', color: '#333', marginBottom: '12px' },
  btnPay: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
  ratingBox: { marginTop: '20px', padding: '20px', backgroundColor: '#fffbeb', borderRadius: '12px' },
  btnRefreshOtp: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  scheduledReminder: { backgroundColor: '#ede9fe', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '2px solid #4f46e5' },
  otpMissing: { backgroundColor: '#fef3c7', padding: '20px', borderRadius: '10px', marginBottom: '20px', textAlign: 'center' },
  autoAssignBox: { backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginTop: '24px' },
  autoAssignTitle: { fontWeight: 'bold', color: '#1a1a2e', fontSize: '15px', margin: '0 0 16px 0' },
  optionItem: { display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px', padding: '12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' },
  optionNum: { backgroundColor: '#4f46e5', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' },
  optionText: { fontSize: '14px', color: '#333', margin: '0 0 8px 0' },
  btnOptionAction: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  ratingTitle: { fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '14px' },
  starsRow: { display: 'flex', gap: '8px', marginBottom: '8px' },
  star: { fontSize: '40px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  reviewInput: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box', resize: 'vertical' },
};

export default JobManage;