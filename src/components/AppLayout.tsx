import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  Upload,
  ListFilter,
  LayoutDashboard,
  ClipboardCheck,
  Users,
  Calendar,
  LogOut,
  Menu,
  X,
  Wallet,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const studentNav: NavItem[] = [
  { to: '/student/upload', label: 'Upload Bill', icon: <Upload className="h-4 w-4" /> },
  { to: '/student/expenses', label: 'My Expenses', icon: <ListFilter className="h-4 w-4" /> },
]

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/admin/review', label: 'Review Queue', icon: <ClipboardCheck className="h-4 w-4" /> },
  { to: '/admin/students', label: 'Students', icon: <Users className="h-4 w-4" /> },
  { to: '/admin/events', label: 'Events', icon: <Calendar className="h-4 w-4" /> },
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
          {item.label}
        </NavLink>
      ))}
    </>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = profile?.role === 'admin' ? adminNav : studentNav

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          {/* Logo */}
          <Link
            to={profile?.role === 'admin' ? '/admin' : '/student/upload'}
            className="flex items-center gap-2 text-accent-700"
          >
            <Wallet className="h-6 w-6" />
            <span className="hidden font-bold sm:inline">Club Budget Tracker</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            <NavLinks items={navItems} />
          </nav>

          {/* Right: user info + logout */}
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-gray-500 sm:block">
              {profile?.full_name}
              <span className="ml-1 capitalize text-gray-400">({profile?.role})</span>
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-500 md:hidden"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <nav className="border-t border-gray-100 bg-white px-4 pb-3 md:hidden">
            <div className="flex flex-col gap-1 pt-2">
              <NavLinks items={navItems} onClick={() => setMobileOpen(false)} />
            </div>
            <p className="mt-3 text-xs text-gray-400">
              {profile?.full_name} · {profile?.role}
            </p>
          </nav>
        )}
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
