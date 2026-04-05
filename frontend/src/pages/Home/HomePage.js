import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const categories = [
  { name: 'Plumbing', icon: '🔧', color: '#dbeafe' },
  { name: 'Electrical', icon: '⚡', color: '#fef3c7' },
  { name: 'Cleaning', icon: '🧹', color: '#d1fae5' },
  { name: 'Gardening', icon: '🌿', color: '#dcfce7' },
  { name: 'Painting', icon: '🎨', color: '#ede9fe' },
  { name: 'Carpentry', icon: '🪚', color: '#ffedd5' },
  { name: 'Moving', icon: '📦', color: '#fce7f3' },
  { name: 'Cooking', icon: '🍳', color: '#fef9c3' },
  { name: 'Driving', icon: '🚗', color: '#e0f2fe' },
  { name: 'Security', icon: '🛡️', color: '#fee2e2' },
  { name: 'Tutoring', icon: '📚', color: '#f3e8ff' },
  { name: 'Other', icon: '⚙️', color: '#f1f5f9' },
];

const HomePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // If already logged in, redirect to their dashboard
    if (user) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'worker') navigate('/worker-dashboard');
      else navigate('/customer-dashboard');
      return;
    }
    fetchJobs();
  }, [user]);

  const fetchJobs = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/jobs');
      setJobs(res.data.jobs);
    } catch (err) {
      console.error('Failed to fetch jobs:', err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'worker') return '/worker-dashboard';
    return '/customer-dashboard';
  };

  const filteredJobs = jobs.filter((job) => {
    const matchSearch =
      !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.location.toLowerCase().includes(search.toLowerCase()) ||
      job.description?.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      !selectedCategory ||
      (job.labor_type || '').toLowerCase().includes(selectedCategory.toLowerCase()) ||
      selectedCategory.toLowerCase().includes((job.labor_type || '').toLowerCase());
    return matchSearch && matchCategory;
  });

  return (
    <div style={styles.page}>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navLeft}>
          <h1 style={styles.logo} onClick={() => navigate('/')}>WorkLink</h1>
        </div>
        <div style={styles.navRight}>
          {user ? (
            <>
              <span style={styles.navGreeting}>Hi, {user.full_name.split(' ')[0]}</span>
              <button style={styles.btnNavOutline} onClick={() => navigate(getDashboardPath())}>
                Dashboard
              </button>
              <button style={styles.btnNavSolid} onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button style={styles.btnNavOutline} onClick={() => navigate('/login')}>
                Login
              </button>
              <button style={styles.btnNavSolid} onClick={() => navigate('/register')}>
                Register
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <h2 style={styles.heroTitle}>Find Skilled Workers Near You</h2>
          <p style={styles.heroSubtitle}>
            WorkLink connects you directly with trusted semi-skilled and unskilled workers — no middlemen, no delays.
          </p>
          <div style={styles.searchRow}>
            <input
              style={styles.searchInput}
              placeholder="Search by job title, location or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button style={styles.btnSearch}>Search</button>
          </div>
          <div style={styles.heroBtns}>
            {user ? (
              <button style={styles.btnHeroPrimary} onClick={() => navigate('/post-job')}>
                Post a Job
              </button>
            ) : (
              <button style={styles.btnHeroPrimary} onClick={() => navigate('/register')}>
                Get Started Free
              </button>
            )}
            <button style={styles.btnHeroSecondary} onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsBar}>
        {[
          { number: '500+', label: 'Workers Available' },
          { number: '1000+', label: 'Jobs Completed' },
          { number: '12', label: 'Service Categories' },
          { number: '4.8★', label: 'Average Rating' },
        ].map((s) => (
          <div key={s.label} style={styles.statItem}>
            <p style={styles.statNumber}>{s.number}</p>
            <p style={styles.statLabel}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Categories */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Browse by Category</h3>
        <p style={styles.sectionSub}>Click a category to filter jobs</p>
        <div style={styles.categoriesGrid}>
          {categories.map((cat) => (
            <div
              key={cat.name}
              style={{
                ...styles.categoryCard,
                backgroundColor:
                  selectedCategory === cat.name ? '#4f46e5' : cat.color,
                color: selectedCategory === cat.name ? '#fff' : '#333',
                transform: selectedCategory === cat.name ? 'scale(1.05)' : 'scale(1)',
              }}
              onClick={() =>
                setSelectedCategory(selectedCategory === cat.name ? null : cat.name)
              }
            >
              <span style={styles.categoryIcon}>{cat.icon}</span>
              <span style={styles.categoryName}>{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Jobs */}
      <div style={styles.section}>
        <div style={styles.jobsHeader}>
          <h3 style={styles.sectionTitle}>
            {selectedCategory ? `${selectedCategory} Jobs` : 'Recent Jobs'}
            <span style={styles.jobsCount}>({filteredJobs.length})</span>
          </h3>
          {selectedCategory && (
            <button style={styles.btnClear} onClick={() => setSelectedCategory(null)}>
              Clear Filter
            </button>
          )}
        </div>

        {filteredJobs.length === 0 ? (
          <div style={styles.emptyJobs}>
            <p style={{ fontSize: '48px', margin: 0 }}>🔍</p>
            <p style={styles.emptyTitle}>No jobs found</p>
            <p style={styles.emptyText}>Try a different category or search term</p>
          </div>
        ) : (
          <div style={styles.jobsGrid}>
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                style={styles.jobCard}
                onClick={() => navigate(`/job/${job.id}`)}
              >
                {job.photo_url && (
                  <img src={job.photo_url} alt="job" style={styles.jobPhoto} />
                )}
                <div style={styles.jobCardBody}>
                  <div style={styles.jobCardTop}>
                    <span style={
                      job.urgency === 'urgent' ? styles.urgentBadge : styles.scheduledBadge
                    }>
                      {job.urgency === 'urgent' ? '🔴 URGENT' : '🔵 SCHEDULED'}
                    </span>
                    <span style={styles.jobRate}>Rs.{job.rate}</span>
                  </div>
                  <h4 style={styles.jobTitle}>{job.title}</h4>
                  <p style={styles.jobMeta}>🔧 {job.labor_type}</p>
                  <p style={styles.jobMeta}>📍 {job.location}</p>
                  <p style={styles.jobMeta}>👤 {job.customer_name}</p>
                  <button style={styles.btnViewJob}>View Details →</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div style={styles.howSection}>
        <h3 style={styles.sectionTitle}>How It Works</h3>
        <div style={styles.stepsRow}>
          {[
            { step: '1', title: 'Post a Job', desc: 'Describe what you need done and set your rate', icon: '📋' },
            { step: '2', title: 'Choose a Worker', desc: 'Review applicants and pick the best one', icon: '👷' },
            { step: '3', title: 'Track & Verify', desc: 'Track worker arrival with OTP verification', icon: '📍' },
            { step: '4', title: 'Pay & Rate', desc: 'Pay securely and leave a review', icon: '⭐' },
          ].map((s) => (
            <div key={s.step} style={styles.stepCard}>
              <div style={styles.stepIcon}>{s.icon}</div>
              <div style={styles.stepBadge}>{s.step}</div>
              <h4 style={styles.stepTitle}>{s.title}</h4>
              <p style={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      {!user && (
        <div style={styles.ctaSection}>
          <h3 style={styles.ctaTitle}>Ready to get started?</h3>
          <p style={styles.ctaText}>Join thousands of customers and workers on WorkLink</p>
          <div style={styles.ctaBtns}>
            <button style={styles.btnCtaPrimary} onClick={() => navigate('/register')}>
              Create Account
            </button>
            <button style={styles.btnCtaSecondary} onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>© 2025 WorkLink. Connecting workers and customers.</p>
      </footer>
    </div>
  );
};

const styles = {
  page: { minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' },
  navbar: {
    position: 'sticky', top: 0, zIndex: 100,
    backgroundColor: '#1a1a2e', padding: '0 40px', height: '64px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  navLeft: { display: 'flex', alignItems: 'center' },
  logo: {
    color: '#fff', fontSize: '24px', fontWeight: 'bold', margin: 0,
    cursor: 'pointer', letterSpacing: '1px',
  },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  navGreeting: { color: '#a5b4fc', fontSize: '14px' },
  btnNavOutline: {
    backgroundColor: 'transparent', color: '#fff', border: '1px solid #fff',
    padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
  },
  btnNavSolid: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
  },
  hero: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #4f46e5 100%)',
    padding: '80px 40px', textAlign: 'center',
  },
  heroContent: { maxWidth: '700px', margin: '0 auto' },
  heroTitle: { fontSize: '48px', fontWeight: 'bold', color: '#fff', margin: '0 0 16px 0' },
  heroSubtitle: { fontSize: '18px', color: '#c7d2fe', marginBottom: '32px', lineHeight: '1.6' },
  searchRow: { display: 'flex', gap: '0', marginBottom: '24px', maxWidth: '600px', margin: '0 auto 24px auto' },
  searchInput: {
    flex: 1, padding: '14px 20px', fontSize: '16px',
    border: 'none', borderRadius: '8px 0 0 8px', outline: 'none',
  },
  btnSearch: {
    backgroundColor: '#10b981', color: '#fff', border: 'none',
    padding: '14px 28px', borderRadius: '0 8px 8px 0', cursor: 'pointer',
    fontSize: '16px', fontWeight: 'bold',
  },
  heroBtns: { display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' },
  btnHeroPrimary: {
    backgroundColor: '#10b981', color: '#fff', border: 'none',
    padding: '14px 32px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '16px', fontWeight: 'bold',
  },
  btnHeroSecondary: {
    backgroundColor: 'transparent', color: '#fff', border: '2px solid #fff',
    padding: '14px 32px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px',
  },
  statsBar: {
    display: 'flex', justifyContent: 'center', gap: '60px',
    padding: '40px', backgroundColor: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flexWrap: 'wrap',
  },
  statItem: { textAlign: 'center' },
  statNumber: { fontSize: '36px', fontWeight: 'bold', color: '#4f46e5', margin: '0 0 4px 0' },
  statLabel: { fontSize: '14px', color: '#666', margin: 0 },
  section: { padding: '60px 40px', maxWidth: '1200px', margin: '0 auto' },
  sectionTitle: { fontSize: '28px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  sectionSub: { color: '#666', fontSize: '15px', marginBottom: '32px' },
  categoriesGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px',
  },
  categoryCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '20px 12px', borderRadius: '12px', cursor: 'pointer',
    transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  categoryIcon: { fontSize: '32px', marginBottom: '8px' },
  categoryName: { fontSize: '14px', fontWeight: 'bold' },
  jobsHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '24px',
  },
  jobsCount: { fontSize: '18px', color: '#666', marginLeft: '8px', fontWeight: 'normal' },
  btnClear: {
    backgroundColor: '#fee2e2', color: '#991b1b', border: 'none',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
  },
  jobsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px',
  },
  jobCard: {
    backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  jobPhoto: { width: '100%', height: '160px', objectFit: 'cover' },
  jobCardBody: { padding: '16px' },
  jobCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  urgentBadge: {
    backgroundColor: '#fee2e2', color: '#991b1b',
    padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
  },
  scheduledBadge: {
    backgroundColor: '#dbeafe', color: '#1d4ed8',
    padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
  },
  jobRate: { fontSize: '18px', fontWeight: 'bold', color: '#4f46e5' },
  jobTitle: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  jobMeta: { fontSize: '13px', color: '#666', margin: '4px 0' },
  btnViewJob: {
    backgroundColor: '#4f46e5', color: '#fff', border: 'none',
    padding: '10px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '14px', width: '100%', marginTop: '12px', fontWeight: 'bold',
  },
  emptyJobs: {
    textAlign: 'center', padding: '60px',
    backgroundColor: '#fff', borderRadius: '16px',
  },
  emptyTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e' },
  emptyText: { color: '#666' },
  howSection: {
    backgroundColor: '#1a1a2e', padding: '60px 40px', textAlign: 'center',
  },
  stepsRow: {
    display: 'flex', justifyContent: 'center', gap: '24px',
    flexWrap: 'wrap', marginTop: '32px', maxWidth: '900px', margin: '32px auto 0 auto',
  },
  stepCard: {
    backgroundColor: '#fff', borderRadius: '16px', padding: '28px 20px',
    width: '180px', position: 'relative',
  },
  stepIcon: { fontSize: '36px', marginBottom: '12px' },
  stepBadge: {
    position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
    backgroundColor: '#4f46e5', color: '#fff', width: '28px', height: '28px',
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px', fontWeight: 'bold',
  },
  stepTitle: { fontSize: '16px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px 0' },
  stepDesc: { fontSize: '13px', color: '#666', lineHeight: '1.5', margin: 0 },
  ctaSection: {
    background: 'linear-gradient(135deg, #4f46e5, #10b981)',
    padding: '60px 40px', textAlign: 'center',
  },
  ctaTitle: { fontSize: '32px', fontWeight: 'bold', color: '#fff', margin: '0 0 12px 0' },
  ctaText: { color: '#d1fae5', fontSize: '16px', marginBottom: '28px' },
  ctaBtns: { display: 'flex', gap: '16px', justifyContent: 'center' },
  btnCtaPrimary: {
    backgroundColor: '#fff', color: '#4f46e5', border: 'none',
    padding: '14px 32px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '16px', fontWeight: 'bold',
  },
  btnCtaSecondary: {
    backgroundColor: 'transparent', color: '#fff', border: '2px solid #fff',
    padding: '14px 32px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px',
  },
  footer: {
    backgroundColor: '#1a1a2e', padding: '24px', textAlign: 'center',
  },
  footerText: { color: '#666', margin: 0, fontSize: '14px' },
};

export default HomePage;