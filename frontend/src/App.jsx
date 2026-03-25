import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { PipelineProvider } from './context/PipelineContext';
import { ThemeProvider } from './context/ThemeContext';
import { RoleProvider } from './context/RoleContext';

// Pages
import Landing from './pages/Landing';
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
import MyActivity from './pages/MyActivity';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';

// Layout
import Layout from './layout/Layout';

// ─── Guard Components ──────────────────────────────────────────

const AuthOnlyRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
};

// ─── App ──────────────────────────────────────────────────────

const App = () => {
  return (
    <ThemeProvider>
      <PipelineProvider>
        <RoleProvider>
          <Routes>
            {/* Public Landing */}
            <Route path="/" element={
              <PublicOnlyRoute><Landing /></PublicOnlyRoute>
            } />

            {/* Public */}
            <Route path="/login" element={
              <PublicOnlyRoute><Login /></PublicOnlyRoute>
            } />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/services" element={<ServicesPage />} />

            {/* Protected app shell */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/incidents/:id" element={<IncidentDetail />} />
              <Route path="/playbooks" element={<Playbooks />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/threat-graph" element={<ThreatGraph />} />
              <Route path="/mitre/:id" element={<MitreMapping />} />
              <Route path="/reasoning" element={<Reasoning />} />
              <Route path="/llm-reasoning" element={<LLMReasoning />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/activity" element={<MyActivity />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RoleProvider>
      </PipelineProvider>
    </ThemeProvider>
  );
};

export default App;
