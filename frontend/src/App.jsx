import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { PipelineProvider } from './context/PipelineContext';

// Pages
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import Playbooks from './pages/Playbooks';
import Pipeline from './pages/Pipeline';
import ThreatGraph from './pages/ThreatGraph';
import MitreMapping from './pages/MitreMapping';
import Reasoning from './pages/Reasoning';
import LLMReasoning from './pages/LLMReasoning';
import Admin from './pages/Admin';


// Layout
import Layout from './layout/Layout';

// ─── Guard Components ──────────────────────────────────────────

// Requires authentication only (for onboarding route)
const AuthOnlyRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Full protected route: must be authenticated AND onboarded
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isOnboarded } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isOnboarded) return <Navigate to="/onboarding" replace />;
  return children;
};

// Redirect already-logged-in users away from login
const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, isOnboarded } = useAuth();
  if (isAuthenticated && !isOnboarded) return <Navigate to="/onboarding" replace />;
  if (isAuthenticated && isOnboarded) return <Navigate to="/dashboard" replace />;
  return children;
};

// ─── App ──────────────────────────────────────────────────────

const App = () => {
  return (
    <PipelineProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={
          <PublicOnlyRoute><Login /></PublicOnlyRoute>
        } />

        {/* Onboarding: auth required, but NOT onboarded yet */}
        <Route path="/onboarding" element={
          <AuthOnlyRoute><Onboarding /></AuthOnlyRoute>
        } />

        {/* Protected app shell — requires auth + onboarding */}
        <Route path="/" element={
          <ProtectedRoute><Layout /></ProtectedRoute>
        }>
          {/* Index → dashboard */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="incidents/:id" element={<IncidentDetail />} />
          <Route path="playbooks" element={<Playbooks />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="threat-graph" element={<ThreatGraph />} />
          <Route path="mitre/:id" element={<MitreMapping />} />
          <Route path="reasoning" element={<Reasoning />} />
          <Route path="llm-reasoning" element={<LLMReasoning />} />
          <Route path="admin" element={<Admin />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </PipelineProvider>
  );
};

export default App;
