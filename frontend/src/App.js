import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/Home/HomePage';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import WorkerProfile from './pages/WorkerProfile/WorkerProfile';
import PostJob from './pages/Jobs/PostJob';
import JobDetail from './pages/Jobs/JobDetail';
import EditJob from './pages/Jobs/EditJob';
import JobManage from './pages/Jobs/JobManage';
import WorkerJob from './pages/Jobs/WorkerJob';
import JobSuggestions from './pages/Jobs/JobSuggestions';
import BondStatus from './pages/Jobs/BondStatus';
import ActiveJob from './pages/Jobs/ActiveJob';
import Chat from './pages/Chat/Chat';
import Chatbot from './pages/Chat/Chatbot';
import TrackWorker from './pages/Map/TrackWorker';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminCustomerProfile from './pages/Admin/AdminCustomerProfile';
import CustomerDashboard from './pages/Dashboard/CustomerDashboard';
import WorkerDashboard from './pages/Dashboard/WorkerDashboard';
import CustomerProfile from './pages/Profile/CustomerProfile';
import WorkerProfilePage from './pages/Profile/WorkerProfilePage';
import DisputeChat from './pages/Disputes/DisputeChat';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/worker/:userId" element={<WorkerProfile />} />
          <Route path="/post-job" element={<PostJob />} />
          <Route path="/job/:jobId" element={<JobDetail />} />
          <Route path="/job-manage/:jobId" element={<JobManage />} />
          <Route path="/worker-job/:jobId" element={<WorkerJob />} />
          <Route path="/edit-job/:jobId" element={<EditJob />} />
          <Route path="/active-job/:jobId" element={<ActiveJob />} />
          <Route path="/suggestions" element={<JobSuggestions />} />
          <Route path="/bond/:jobId" element={<BondStatus />} />
          <Route path="/chat/:jobId" element={<Chat />} />
          <Route path="/track/:jobId" element={<TrackWorker />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/customer/:userId" element={<AdminCustomerProfile />} />
          <Route path="/customer-dashboard" element={<CustomerDashboard />} />
          <Route path="/worker-dashboard" element={<WorkerDashboard />} />
          <Route path="/customer-profile" element={<CustomerProfile />} />
          <Route path="/worker-profile" element={<WorkerProfilePage />} />
          {/* Dispute Chat — accessible by customers, workers, and admin */}
          <Route path="/dispute-chat/:disputeId" element={<DisputeChat />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Chatbot />
      </Router>
    </AuthProvider>
  );
}

export default App;