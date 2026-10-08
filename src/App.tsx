import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { ToastProvider } from './components/Toast'
import {
  LoginPage,
  SignupPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from './auth/AuthPages'
import { UploadBillPage, MyExpensesPage } from './student/StudentPages'
import {
  DashboardPage,
  ReviewQueuePage,
  AllBillsPage,
  HistoryPage,
  StudentsPage,
  StudentDetailPage,
  EventsPage,
} from './admin/AdminPages'

function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="student">
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public (F1 Auth) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Student */}
            <Route
              path="/student/upload"
              element={<StudentLayout><UploadBillPage /></StudentLayout>}
            />
            <Route
              path="/student/expenses"
              element={<StudentLayout><MyExpensesPage /></StudentLayout>}
            />

            {/* Admin (F5 Order: Dashboard, Review Queue, All Bills, History, Students, Events) */}
            <Route path="/admin" element={<AdminLayout><DashboardPage /></AdminLayout>} />
            <Route path="/admin/review" element={<AdminLayout><ReviewQueuePage /></AdminLayout>} />
            <Route path="/admin/bills" element={<AdminLayout><AllBillsPage /></AdminLayout>} />
            <Route path="/admin/history" element={<AdminLayout><HistoryPage /></AdminLayout>} />
            <Route path="/admin/students" element={<AdminLayout><StudentsPage /></AdminLayout>} />
            <Route
              path="/admin/students/:id"
              element={<AdminLayout><StudentDetailPage /></AdminLayout>}
            />
            <Route path="/admin/events" element={<AdminLayout><EventsPage /></AdminLayout>} />

            {/* Default */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  )
}
