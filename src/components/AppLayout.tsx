import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ChangePasswordModal } from '../auth/AuthPages'
import { usePendingApprovalsCount } from '../hooks/useAdminApprovals'
import {
  Upload,
  ListFilter,
  LayoutDashboard,
  ClipboardCheck,
  UserCheck,
  FileText,
  History,
  Users,
  Calendar,
  LogOut,
  KeyRound,
  Menu,
  X,
  Wallet,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  badge?: number
}

const studentNav: NavItem[] = [
  { to: '/student/upload', label: 'Upload Bill', icon: <Upload className="h-4 w-4" /> },
  { to: '/student/expenses', label: 'My Expenses', icon: <ListFilter className="h-4 w-4" /> },
]

const linkBase =
  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150'
const linkActive = 'bg-accent-50 text-accent-700'
const linkInactive = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'

function NavLinks({ items, onClick }: { items: NavItem[]; onClick?: () => void }) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/admin'} // exact match for dashboard
          className={({ isActive }) =>
            [linkBase, isActive ? linkActive : linkInactive].join(' ')
          }
          onClick={onClick}
        >
          {item.icon}
          <span>{item.label}</span>
          {Boolean(item.badge && item.badge > 0) && (
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              {item.badge}
            </span>
          )}
        </NavLink>
      ))}
    </>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const { data: pendingApprovalsCount } = usePendingApprovalsCount()

  const adminNav: NavItem[] = [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: '/admin/review', label: 'Review Queue', icon: <ClipboardCheck className="h-4 w-4" /> },
    {
      to: '/admin/approvals',
      label: 'Member Approvals',
      icon: <UserCheck className="h-4 w-4" />,
      badge: pendingApprovalsCount || undefined,
    },
    { to: '/admin/bills', label: 'All Bills', icon: <FileText className="h-4 w-4" /> },
    { to: '/admin/history', label: 'History', icon: <History className="h-4 w-4" /> },
    { to: '/admin/students', label: 'Students', icon: <Users className="h-4 w-4" /> },
    { to: '/admin/events', label: 'Events', icon: <Calendar className="h-4 w-4" /> },
  ]

  const navItems = profile?.role === 'admin' ? adminNav : studentNav

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const roleBadge =
    profile?.role === 'admin' ? (
      <span className="inline-flex items-center rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-800">
        Admin
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
        Student
      </span>
    )

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
          <Wallet className="h-6 w-6 text-accent-600" />
          <div>
            <span className="text-base font-bold text-gray-900">Budget Tracker</span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-accent-600">
              By Digital VJTI
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4" aria-label="Sidebar">
          <NavLinks items={navItems} />
        </nav>

        {/* User Profile Footer */}
        <div className="border-t border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {profile?.full_name || 'Loading…'}
              </p>
              <p className="truncate text-xs text-gray-500">{profile?.email}</p>
            </div>
            {roleBadge}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setChangePasswordOpen(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              title="Change password"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Password
            </button>
            <button
              onClick={handleSignOut}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header + Content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-accent-600" />
            <div>
              <span className="text-sm font-bold text-gray-900">Budget Tracker</span>
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-accent-600">
                Digital VJTI
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Mobile Dropdown Menu */}
        {mobileOpen && (
          <div className="border-b border-gray-200 bg-white p-4 md:hidden">
            <nav className="space-y-1" aria-label="Mobile navigation">
              <NavLinks items={navItems} onClick={() => setMobileOpen(false)} />
            </nav>
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                  <p className="text-xs text-gray-500">{profile?.email}</p>
                </div>
                {roleBadge}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setMobileOpen(false)
                    setChangePasswordOpen(true)
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Password
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  )
}
