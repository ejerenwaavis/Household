import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import IncomePage from './pages/IncomePage';
import ExpensesPage from './pages/ExpensesPage';
import FixedExpensesPage from './pages/FixedExpensesPage';
import GoalsPage from './pages/GoalsPage';
import CreditCardsPage from './pages/CreditCardsPage';
import CardStatementsPage from './pages/CardStatementsPage';
import DebtPaymentsPage from './pages/DebtPaymentsPage';
import MonthlyOverviewPage from './pages/MonthlyOverviewPage';
import InviteAcceptPage from './pages/InviteAcceptPage';
import MemberManagementPage from './pages/MemberManagementPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import LinkedAccountsPage from './pages/LinkedAccountsPage';
import TransactionReviewPage from './pages/TransactionReviewPage';
import PricingPage from './pages/PricingPage';
import SubscriptionPage from './pages/SubscriptionPage';
import InsightsPage from './pages/InsightsPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import ProtectedRoute from './components/ProtectedRoute';

console.log('[App] Rendering App component');

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <ThemeProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/register/:inviteToken" element={<RegisterPage />} />
                <Route path="/invite/:token" element={<InviteAcceptPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/dashboard/income" element={<IncomePage />} />
                  <Route path="/income" element={<IncomePage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/fixed-expenses" element={<FixedExpensesPage />} />
                  <Route path="/goals" element={<GoalsPage />} />
                  <Route path="/credit-cards" element={<CreditCardsPage />} />
                  <Route path="/card-statements" element={<CardStatementsPage />} />
                  <Route path="/debt-payments" element={<DebtPaymentsPage />} />
                  <Route path="/monthly-overview" element={<MonthlyOverviewPage />} />
                  <Route path="/members" element={<MemberManagementPage />} />
                  <Route path="/linked-accounts" element={<LinkedAccountsPage />} />
                  <Route path="/transactions/review" element={<TransactionReviewPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/subscription" element={<SubscriptionPage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/settings/profile" element={<ProfileSettingsPage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Routes>
            </Router>
          </ThemeProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
