import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/clerk-react';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './layouts/DashboardLayout';
import OverviewPage from './pages/dashboard/OverviewPage';
import SitesPage from './pages/dashboard/SitesPage';
import AnalysisPage from './pages/dashboard/AnalysisPage';
import ResearchPage from './pages/dashboard/ResearchPage';
import ArticlesPage from './pages/dashboard/ArticlesPage';
import SchedulerPage from './pages/dashboard/SchedulerPage';
import CronSchedulerPage from './pages/dashboard/CronSchedulerPage';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import NotificationsPage from './pages/dashboard/NotificationsPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import DocumentationPage from './pages/dashboard/DocumentationPage';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth Pages */}
        <Route
          path="/sign-in/*"
          element={
            <div className="flex items-center justify-center min-h-screen bg-rakubun-bg">
              <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/dashboard" />
            </div>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <div className="flex items-center justify-center min-h-screen bg-rakubun-bg">
              <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" afterSignUpUrl="/dashboard" />
            </div>
          }
        />

        {/* Dashboard (protected) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route path="scheduler" element={<SchedulerPage />} />
          <Route path="cron-scheduler" element={<CronSchedulerPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="docs" element={<DocumentationPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
