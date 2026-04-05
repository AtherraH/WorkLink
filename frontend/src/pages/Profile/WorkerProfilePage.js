import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const allSkills = ['plumbing','electrical','cleaning','gardening','painting','carpentry','moving','cooking','driving','security','tutoring','other'];

const WorkerProfilePage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile]         = useState(null);
  const [ratings, setRatings]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors]           = useState({});
  const [form, setForm] = useState({ full_name:'', phone:'', bio:'', hourly_rate:'', skills:[] });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/workers/profile', {
        headers: { Authorization: 'Bearer ' + token },
      });
      const p = res.data.profile;
      setProfile(p);
      setForm({ full_name: p.full_name||'', phone: p.phone||'', bio: p.bio||'', hourly_rate: p.hourly_rate||'', skills: Array.isArray(p.skills)?p.skills:[] });
      const wid = p.user_id || user?.id;
      try {
        const rat = await axios.get('http://localhost:5000/api/ratings/worker/' + wid, { headers: { Authorization: 'Bearer ' + token } });
        setRatings(rat.data.ratings || []);
      } catch(e) {}
    } catch(err) { console.error(err.message); }
    finally { setLoading(false); }
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Name is required.';
    if (!form.phone.trim()) e.phone = 'Phone is required.';
    else if (!/^\d{10,15}$/.test(form.phone.replace(/\s+/g,''))) e.phone = 'Enter a valid phone number.';
    if (form.hourly_rate !== '' && isNaN(Number(form.hourly_rate))) e.hourly_rate = 'Must be a number.';
    if (form.skills.length === 0) e.skills = 'Select at least one skill.';
    return e;
  };

  const saveProfile = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      await axios.put('http://localhost:5000/api/workers/profile',
        { full_name: form.full_name, phone: form.phone, bio: form.bio, hourly_rate: form.hourly_rate===''?null:Number(form.hourly_rate), skills: form.skills },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      setSaveSuccess(true);
      setEditing(false);
      fetchAll();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch(err) { alert(err.response?.data?.message || 'Failed to update profile.'); }
    finally { setSaving(false); }
  };

  const cancelEdit = () => {
    setEditing(false); setErrors({});
    setForm({ full_name: profile.full_name||'', phone: profile.phone||'', bio: profile.bio||'', hourly_rate: profile.hourly_rate||'', skills: Array.isArray(profile.skills)?profile.skills:[] });
  };

  const toggleSkill = (sk) => {
    setForm(prev => ({ ...prev, skills: prev.skills.includes(sk)?prev.skills.filter(s=>s!==sk):[...prev.skills,sk] }));
    if (errors.skills) setErrors(p => ({ ...p, skills: null }));
  };

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => ({ ...p, [k]: null })); };

  if (loading) return <div style={s.center}>Loading profile...</div>;
  if (!profile) return <div style={s.center}>Profile not found.</div>;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/worker-dashboard')}>← Dashboard</button>
        <h2 style={s.headerTitle}>My Profile</h2>
        {!editing
          ? <button style={s.btnEditHeader} onClick={() => setEditing(true)}>✏️ Edit Profile</button>
          : <div style={{display:'flex',gap:'8px'}}>
              <button style={saving?s.btnSaveHDis:s.btnSaveH} onClick={saveProfile} disabled={saving}>{saving?'Saving...':'💾 Save'}</button>
              <button style={s.btnCancelH} onClick={cancelEdit}>Cancel</button>
            </div>
        }
      </div>

      {saveSuccess && <div style={s.successBanner}>✅ Profile updated successfully!</div>}

      <div style={s.body}>
        {/* VIEW MODE */}
        {!editing && <>
          <div style={s.heroCard}>
            <div style={s.heroLeft}>
              <div style={s.avatarWrap}>
                <div style={s.avatar}>{profile.full_name?.charAt(0).toUpperCase()}</div>
                <span style={{...s.onlineDot, backgroundColor: profile.is_online?'#10b981':'#9ca3af'}} />
              </div>
              <div style={s.heroInfo}>
                <h2 style={s.heroName}>{profile.full_name}</h2>
                <div style={s.heroBadges}>
                  <span style={s.badgeWorker}>WORKER</span>
                  <span style={{...s.badgeOnline, backgroundColor: profile.is_online?'#d1fae5':'#f3f4f6', color: profile.is_online?'#065f46':'#6b7280'}}>{profile.is_online?'🟢 Online':'⚫ Offline'}</span>
                </div>
                <p style={s.heroContact}>📞 {profile.phone}</p>
                <p style={s.heroContact}>✉️ {profile.email}</p>
              </div>
            </div>
            <div style={s.heroStats}>
              <div style={s.heroStat}><p style={{...s.heroStatNum,color:'#f59e0b'}}>⭐ {parseFloat(profile.rating||0).toFixed(1)}</p><p style={s.heroStatLbl}>{profile.total_ratings||0} reviews</p></div>
              <div style={s.heroStat}><p style={s.heroStatNum}>{(profile.skills||[]).length}</p><p style={s.heroStatLbl}>Skills</p></div>
              <div style={s.heroStat}><p style={s.heroStatNum}>{profile.hourly_rate?'Rs.'+profile.hourly_rate:'—'}</p><p style={s.heroStatLbl}>Hourly Rate</p></div>
            </div>
          </div>

          <div style={s.infoRow}>
            <div style={s.infoCard}>
              <p style={s.infoLabel}>About Me</p>
              {profile.bio?<p style={s.infoText}>{profile.bio}</p>:<p style={s.infoEmpty}>No bio added yet. Click Edit Profile to add one.</p>}
            </div>
            <div style={s.infoCard}>
              <p style={s.infoLabel}>Skills</p>
              <div style={s.skillsRow}>
                {(profile.skills||[]).length>0?(profile.skills||[]).map(sk=><span key={sk} style={s.skillTag}>{sk}</span>):<p style={s.infoEmpty}>No skills added yet.</p>}
              </div>
            </div>
          </div>

          <div style={{...s.infoCard, alignSelf:'flex-start'}}>
            <p style={s.infoLabel}>Member Since</p>
            <p style={s.infoText}>{new Date(profile.created_at).toLocaleDateString([],{day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
        </>}

        {/* EDIT MODE */}
        {editing && (
          <div style={s.editCard}>
            <h3 style={s.editCardTitle}>✏️ Edit Profile</h3>
            <p style={s.editCardSub}>Update your personal details, skills, and rate.</p>
            <div style={s.formGrid}>
              <div style={s.fg}>
                <label style={s.fl}>Full Name <span style={s.req}>*</span></label>
                <input style={{...s.fi,...(errors.full_name?s.fie:{})}} value={form.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="Your full name" />
                {errors.full_name&&<p style={s.em}>{errors.full_name}</p>}
              </div>
              <div style={s.fg}>
                <label style={s.fl}>Phone <span style={s.req}>*</span></label>
                <input style={{...s.fi,...(errors.phone?s.fie:{})}} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="e.g. 9876543210" type="tel" />
                {errors.phone&&<p style={s.em}>{errors.phone}</p>}
              </div>
              <div style={s.fg}>
                <label style={s.fl}>Hourly Rate (Rs.)</label>
                <input style={{...s.fi,...(errors.hourly_rate?s.fie:{})}} value={form.hourly_rate} onChange={e=>set('hourly_rate',e.target.value)} placeholder="e.g. 200" type="number" min="0" />
                {errors.hourly_rate&&<p style={s.em}>{errors.hourly_rate}</p>}
              </div>
              <div style={s.fg}>
                <label style={s.fl}>Email <span style={s.ron}>(cannot be changed)</span></label>
                <input style={{...s.fi,...s.fro}} value={profile.email} readOnly />
              </div>
            </div>
            <div style={s.fg}>
              <label style={s.fl}>About Me</label>
              <textarea style={{...s.fi,height:'100px',resize:'vertical'}} value={form.bio} onChange={e=>set('bio',e.target.value)} placeholder="Tell customers about your experience..." />
              <p style={s.fh}>{form.bio.length} characters</p>
            </div>
            <div style={{...s.fg,marginTop:'12px'}}>
              <label style={s.fl}>Skills <span style={s.req}>*</span> <span style={s.ron}>— tap to select/deselect</span></label>
              <div style={s.skillsGrid}>
                {allSkills.map(sk=>{
                  const sel=form.skills.includes(sk);
                  return <button key={sk} type="button" style={{...s.skillToggle,backgroundColor:sel?'#4f46e5':'#f3f4f6',color:sel?'#fff':'#374151',borderColor:sel?'#4f46e5':'#e5e7eb'}} onClick={()=>toggleSkill(sk)}>{sel?'✓ ':''}{sk}</button>;
                })}
              </div>
              {errors.skills&&<p style={s.em}>{errors.skills}</p>}
              <p style={s.fh}>{form.skills.length} skill{form.skills.length!==1?'s':''} selected</p>
            </div>
            <div style={s.editActions}>
              <button style={saving?s.btnSaveDis:s.btnSave} onClick={saveProfile} disabled={saving}>{saving?'⏳ Saving...':'💾 Save Changes'}</button>
              <button style={s.btnCancel} onClick={cancelEdit}>Cancel</button>
            </div>
          </div>
        )}

        {/* CUSTOMER REVIEWS */}
        <div style={s.section}>
          <h3 style={s.sectionTitle}>⭐ Customer Reviews ({ratings.length})</h3>
          {ratings.length === 0
            ? <div style={s.emptyBox}><p style={{fontSize:'32px',margin:'0 0 8px 0'}}>⭐</p><p style={s.emptyTitle}>No reviews yet</p><p style={s.emptyText}>Reviews from customers will appear here after completed jobs.</p></div>
            : <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {ratings.map((r,i) => (
                  <div key={i} style={s.reviewCard}>
                    <div style={s.reviewTop}>
                      <div style={s.reviewLeft}>
                        <div style={s.reviewAvatar}>{r.customer_name?.charAt(0).toUpperCase()}</div>
                        <div><p style={s.reviewCustomer}>{r.customer_name}</p><p style={s.reviewJob}>{r.job_title}</p></div>
                      </div>
                      <div style={s.reviewRight}>
                        <p style={s.reviewStars}>{'★'.repeat(r.score)}<span style={{color:'#d1d5db'}}>{'★'.repeat(5-r.score)}</span></p>
                        <p style={s.reviewDate}>{new Date(r.created_at).toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'})}</p>
                      </div>
                    </div>
                    {r.review&&<p style={s.reviewText}>"{r.review}"</p>}
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
};

const s = {
  page:{minHeight:'100vh',backgroundColor:'#f0f4f8'},
  center:{textAlign:'center',marginTop:'100px',fontSize:'18px',color:'#666'},
  header:{backgroundColor:'#1a1a2e',padding:'16px 30px',display:'flex',justifyContent:'space-between',alignItems:'center'},
  backBtn:{backgroundColor:'transparent',color:'#a5b4fc',border:'1px solid #a5b4fc',padding:'8px 16px',borderRadius:'8px',cursor:'pointer',fontSize:'14px'},
  headerTitle:{color:'#fff',fontSize:'20px',fontWeight:'bold',margin:0},
  btnEditHeader:{backgroundColor:'#4f46e5',color:'#fff',border:'none',padding:'9px 20px',borderRadius:'8px',cursor:'pointer',fontSize:'14px',fontWeight:'600'},
  btnSaveH:{backgroundColor:'#10b981',color:'#fff',border:'none',padding:'9px 20px',borderRadius:'8px',cursor:'pointer',fontSize:'14px',fontWeight:'600'},
  btnSaveHDis:{backgroundColor:'#6ee7b7',color:'#fff',border:'none',padding:'9px 20px',borderRadius:'8px',cursor:'not-allowed',fontSize:'14px',fontWeight:'600'},
  btnCancelH:{backgroundColor:'rgba(255,255,255,0.15)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',padding:'9px 16px',borderRadius:'8px',cursor:'pointer',fontSize:'14px'},
  successBanner:{backgroundColor:'#d1fae5',color:'#065f46',padding:'12px 30px',fontWeight:'600',fontSize:'14px',textAlign:'center',borderBottom:'1px solid #a7f3d0'},
  body:{padding:'30px',maxWidth:'900px',margin:'0 auto',display:'flex',flexDirection:'column',gap:'20px'},
  heroCard:{backgroundColor:'#fff',borderRadius:'16px',padding:'28px',boxShadow:'0 2px 12px rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'24px'},
  heroLeft:{display:'flex',gap:'20px',alignItems:'flex-start'},
  avatarWrap:{position:'relative',flexShrink:0},
  avatar:{width:'80px',height:'80px',borderRadius:'50%',backgroundColor:'#4f46e5',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:'bold'},
  onlineDot:{position:'absolute',bottom:'4px',right:'4px',width:'16px',height:'16px',borderRadius:'50%',border:'2px solid #fff'},
  heroInfo:{display:'flex',flexDirection:'column',gap:'6px'},
  heroName:{fontSize:'26px',fontWeight:'bold',color:'#1a1a2e',margin:0},
  heroBadges:{display:'flex',gap:'8px',flexWrap:'wrap'},
  badgeWorker:{backgroundColor:'#dbeafe',color:'#1d4ed8',padding:'3px 12px',borderRadius:'20px',fontSize:'11px',fontWeight:'bold'},
  badgeOnline:{padding:'3px 12px',borderRadius:'20px',fontSize:'11px',fontWeight:'bold'},
  heroContact:{fontSize:'14px',color:'#555',margin:0},
  heroStats:{display:'flex',gap:'28px',flexWrap:'wrap',alignItems:'center'},
  heroStat:{textAlign:'center',minWidth:'60px'},
  heroStatNum:{fontSize:'22px',fontWeight:'bold',color:'#1a1a2e',margin:0},
  heroStatLbl:{fontSize:'11px',color:'#9ca3af',margin:'4px 0 0 0',textTransform:'uppercase'},
  infoRow:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'},
  infoCard:{backgroundColor:'#fff',borderRadius:'12px',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'},
  infoLabel:{fontSize:'11px',fontWeight:'bold',color:'#9ca3af',textTransform:'uppercase',margin:'0 0 10px 0'},
  infoText:{fontSize:'15px',color:'#374151',lineHeight:'1.6',margin:0},
  infoEmpty:{fontSize:'14px',color:'#9ca3af',fontStyle:'italic',margin:0},
  skillsRow:{display:'flex',flexWrap:'wrap',gap:'8px'},
  skillTag:{backgroundColor:'#ede9fe',color:'#4f46e5',padding:'5px 14px',borderRadius:'20px',fontSize:'13px',fontWeight:'600'},
  editCard:{backgroundColor:'#fff',borderRadius:'16px',padding:'32px',boxShadow:'0 2px 12px rgba(0,0,0,0.08)'},
  editCardTitle:{fontSize:'20px',fontWeight:'bold',color:'#1a1a2e',margin:'0 0 4px 0'},
  editCardSub:{fontSize:'14px',color:'#6b7280',margin:'0 0 28px 0'},
  formGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'20px'},
  fg:{display:'flex',flexDirection:'column',gap:'6px'},
  fl:{fontSize:'13px',fontWeight:'600',color:'#374151'},
  req:{color:'#ef4444'},
  ron:{fontSize:'11px',color:'#9ca3af',fontWeight:'normal'},
  fi:{padding:'11px 14px',borderRadius:'8px',border:'1.5px solid #e5e7eb',fontSize:'14px',outline:'none',boxSizing:'border-box',width:'100%',fontFamily:'inherit'},
  fie:{borderColor:'#ef4444',backgroundColor:'#fff5f5'},
  fro:{backgroundColor:'#f9fafb',color:'#9ca3af',cursor:'not-allowed'},
  fh:{fontSize:'11px',color:'#9ca3af',margin:0},
  em:{fontSize:'12px',color:'#ef4444',margin:0},
  skillsGrid:{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'4px'},
  skillToggle:{padding:'8px 16px',borderRadius:'20px',cursor:'pointer',fontSize:'13px',fontWeight:'600',border:'1.5px solid'},
  editActions:{display:'flex',gap:'12px',marginTop:'28px',paddingTop:'24px',borderTop:'1px solid #f3f4f6'},
  btnSave:{backgroundColor:'#4f46e5',color:'#fff',border:'none',padding:'13px 32px',borderRadius:'10px',cursor:'pointer',fontSize:'15px',fontWeight:'bold'},
  btnSaveDis:{backgroundColor:'#a5b4fc',color:'#fff',border:'none',padding:'13px 32px',borderRadius:'10px',cursor:'not-allowed',fontSize:'15px',fontWeight:'bold'},
  btnCancel:{backgroundColor:'#f3f4f6',color:'#374151',border:'none',padding:'13px 24px',borderRadius:'10px',cursor:'pointer',fontSize:'15px'},
  section:{backgroundColor:'#fff',borderRadius:'16px',padding:'28px',boxShadow:'0 2px 12px rgba(0,0,0,0.08)'},
  sectionTitle:{fontSize:'18px',fontWeight:'bold',color:'#1a1a2e',margin:'0 0 20px 0'},
  reviewCard:{backgroundColor:'#f8faff',borderRadius:'12px',padding:'16px 20px',border:'1px solid #e5e7eb'},
  reviewTop:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'},
  reviewLeft:{display:'flex',alignItems:'center',gap:'12px'},
  reviewAvatar:{width:'40px',height:'40px',borderRadius:'50%',background:'linear-gradient(135deg,#4f46e5,#7c3aed)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',fontSize:'16px',flexShrink:0},
  reviewCustomer:{margin:0,fontWeight:'700',fontSize:'14px',color:'#1a1a2e'},
  reviewJob:{margin:'2px 0 0 0',fontSize:'12px',color:'#9ca3af'},
  reviewRight:{textAlign:'right'},
  reviewStars:{margin:0,fontSize:'18px',color:'#f59e0b'},
  reviewDate:{margin:'2px 0 0 0',fontSize:'12px',color:'#9ca3af'},
  reviewText:{margin:0,fontSize:'14px',color:'#374151',fontStyle:'italic',lineHeight:'1.5'},
  emptyBox:{textAlign:'center',padding:'40px 20px'},
  emptyTitle:{fontSize:'18px',fontWeight:'bold',color:'#1a1a2e',margin:'12px 0 6px 0'},
  emptyText:{color:'#9ca3af',fontSize:'14px',margin:0},
};

export default WorkerProfilePage;