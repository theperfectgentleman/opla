import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrgProvider } from './contexts/OrgContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Welcome from './pages/Welcome';
import FormBuilder from './pages/FormBuilder';
import FormSimulator from './pages/FormSimulator';
import PublicForm from './pages/PublicForm';
import ProjectWorkspace from './pages/ProjectWorkspace';
import ProjectHub from './pages/ProjectHub';
import AiSurveyWizard from './pages/AiSurveyWizard';
import InvitationAccept from './pages/InvitationAccept';
import ReportDetail from './pages/ReportDetail';

function App() {
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', storedTheme);
    }
    const storedFont = localStorage.getItem('font-profile');
    if (storedFont === 'modern' || storedFont === 'warm' || storedFont === 'editorial' || storedFont === 'developer') {
      document.documentElement.setAttribute('data-font-profile', storedFont);
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
          <ToastProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/s/:slug" element={<PublicForm />} />

              {/* Protected routes */}
              <Route
                path="/welcome"
                element={
                  <ProtectedRoute>
                    <Welcome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/hub"
                element={
                  <ProtectedRoute>
                    <ProjectHub />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pdemo"
                element={<Navigate to="/dashboard?tab=projects" replace />}
              />
              <Route
                path="/projects/:projectId"
                element={
                  <ProtectedRoute>
                    <ProjectWorkspace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/ai-survey"
                element={
                  <ProtectedRoute>
                    <AiSurveyWizard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invitations/accept"
                element={
                  <ProtectedRoute>
                    <InvitationAccept />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/reports/:reportId"
                element={
                  <ProtectedRoute>
                    <ReportDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/builder/:formId"
                element={
                  <ProtectedRoute>
                    <FormBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/simulator/:formId"
                element={
                  <ProtectedRoute>
                    <FormSimulator />
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ToastProvider>
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
