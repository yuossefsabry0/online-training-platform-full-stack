import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import {
  GuestRoute,
  ProtectedRoute,
  CoachRoute,
  SuperAdminRoute,
} from './auth/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import HomePage from './pages/HomePage.jsx';
import CoachesPage from './pages/CoachesPage.jsx';
import CoachDetailPage from './pages/CoachDetailPage.jsx';
import SubscriptionsPage from './pages/SubscriptionsPage.jsx';
import ConfirmSubscriptionPage from './pages/ConfirmSubscriptionPage.jsx';
import PaymentPage from './pages/PaymentPage.jsx';
import PaymentPendingPage from './pages/PaymentPendingPage.jsx';
import MySubscriptionPage from './pages/MySubscriptionPage.jsx';
import SubscriptionHistoryPage from './pages/SubscriptionHistoryPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import CoachDashboardPage from './pages/coach/CoachDashboardPage.jsx';
import CoachMembersPage from './pages/coach/CoachMembersPage.jsx';
import CoachMemberDetailPage from './pages/coach/CoachMemberDetailPage.jsx';
import CoachPaymentRequestsPage from './pages/coach/CoachPaymentRequestsPage.jsx';
import CoachPaymentDetailPage from './pages/coach/CoachPaymentDetailPage.jsx';
import CoachPaymentsLogPage from './pages/coach/CoachPaymentsLogPage.jsx';
import CoachHistoryHubPage from './pages/coach/CoachHistoryHubPage.jsx';
import SuperAdminDashboardPage from './pages/superadmin/SuperAdminDashboardPage.jsx';
import SuperAdminCoachesPage from './pages/superadmin/SuperAdminCoachesPage.jsx';
import SuperAdminPaymentsPage from './pages/superadmin/SuperAdminPaymentsPage.jsx';
import SuperAdminDeletedAccountsPage from './pages/superadmin/SuperAdminDeletedAccountsPage.jsx';
import SuperAdminAuditLogsPage from './pages/superadmin/SuperAdminAuditLogsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// TASK 1 routing foundation (auth, guest-only) + TASK 2 BASIC/MEMBER
// experience (protected) + TASK 3 coach areas (ADMIN-gated UX) +
// TASK 4 super-admin areas (SUPER_ADMIN-gated UX).
// Backend authorization stays authoritative; guards are navigation only.
function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

function Coach({ children }) {
  return (
    <ProtectedRoute>
      <CoachRoute>{children}</CoachRoute>
    </ProtectedRoute>
  );
}

function SuperAdmin({ children }) {
  return (
    <ProtectedRoute>
      <SuperAdminRoute>{children}</SuperAdminRoute>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />
        <Route
          path="/verify-email"
          element={
            <GuestRoute>
              <VerifyEmailPage />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPasswordPage />
            </GuestRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <GuestRoute>
              <ResetPasswordPage />
            </GuestRoute>
          }
        />
        <Route
          path="/home"
          element={
            <Protected>
              <HomePage />
            </Protected>
          }
        />
        <Route
          path="/coaches"
          element={
            <Protected>
              <CoachesPage />
            </Protected>
          }
        />
        <Route
          path="/coaches/:coachId"
          element={
            <Protected>
              <CoachDetailPage />
            </Protected>
          }
        />
        <Route
          path="/subscriptions"
          element={
            <Protected>
              <SubscriptionsPage />
            </Protected>
          }
        />
        <Route
          path="/subscriptions/confirm"
          element={
            <Protected>
              <ConfirmSubscriptionPage />
            </Protected>
          }
        />
        <Route
          path="/payment"
          element={
            <Protected>
              <PaymentPage />
            </Protected>
          }
        />
        <Route
          path="/payment/pending"
          element={
            <Protected>
              <PaymentPendingPage />
            </Protected>
          }
        />
        <Route
          path="/my-subscription"
          element={
            <Protected>
              <MySubscriptionPage />
            </Protected>
          }
        />
        <Route
          path="/subscription-history"
          element={
            <Protected>
              <SubscriptionHistoryPage />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <ProfilePage />
            </Protected>
          }
        />
        <Route
          path="/contact"
          element={
            <Protected>
              <ContactPage />
            </Protected>
          }
        />
        <Route
          path="/coach/dashboard"
          element={
            <Coach>
              <CoachDashboardPage />
            </Coach>
          }
        />
        <Route
          path="/coach/members"
          element={
            <Coach>
              <CoachMembersPage />
            </Coach>
          }
        />
        <Route
          path="/coach/members/:memberId"
          element={
            <Coach>
              <CoachMemberDetailPage />
            </Coach>
          }
        />
        <Route
          path="/coach/payment-requests"
          element={
            <Coach>
              <CoachPaymentRequestsPage />
            </Coach>
          }
        />
        <Route
          path="/coach/payment-requests/:paymentId"
          element={
            <Coach>
              <CoachPaymentDetailPage />
            </Coach>
          }
        />
        <Route
          path="/coach/payments"
          element={
            <Coach>
              <CoachPaymentsLogPage />
            </Coach>
          }
        />
        <Route
          path="/coach/subscription-history"
          element={
            <Coach>
              <CoachHistoryHubPage />
            </Coach>
          }
        />
        <Route
          path="/super-admin/dashboard"
          element={
            <SuperAdmin>
              <SuperAdminDashboardPage />
            </SuperAdmin>
          }
        />
        <Route
          path="/super-admin/coaches"
          element={
            <SuperAdmin>
              <SuperAdminCoachesPage />
            </SuperAdmin>
          }
        />
        <Route
          path="/super-admin/payments"
          element={
            <SuperAdmin>
              <SuperAdminPaymentsPage />
            </SuperAdmin>
          }
        />
        <Route
          path="/super-admin/deleted-accounts"
          element={
            <SuperAdmin>
              <SuperAdminDeletedAccountsPage />
            </SuperAdmin>
          }
        />
        <Route
          path="/super-admin/audit-logs"
          element={
            <SuperAdmin>
              <SuperAdminAuditLogsPage />
            </SuperAdmin>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
