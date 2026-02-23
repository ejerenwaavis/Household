import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import IncomePage from './pages/IncomePage';
import ExpensesPage from './pages/ExpensesPage';
import FixedExpensesPage from './pages/FixedExpensesPage';
import GoalsPage from './pages/GoalsPage';
import InviteAcceptPage from './pages/InviteAcceptPage';
import MemberManagementPage from './pages/MemberManagementPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/income" element={<IncomePage />} />
              <Route path="/income" element={<IncomePage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/fixed-expenses" element={<FixedExpensesPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/members" element={<MemberManagementPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
