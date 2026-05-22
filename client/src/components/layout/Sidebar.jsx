import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Users, BookOpen,
  LogOut, GraduationCap, Menu, X
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users,           label: 'Study Groups', path: '/groups' },
  { icon: BookOpen,        label: 'My Documents', path: '/documents' },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(25 90% 48%), hsl(15 85% 52%))' }}>
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg leading-none text-white tracking-tight">NoteLearn</p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--sidebar-muted))' }}>AI Study Platform</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-widest px-3 mb-3"
          style={{ color: 'hsl(var(--sidebar-muted))' }}>
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                background: isActive ? 'hsl(25 90% 48% / 0.15)' : 'transparent',
                color: isActive ? 'hsl(25 90% 65%)' : 'hsl(var(--sidebar-foreground))',
                borderLeft: isActive ? '3px solid hsl(25 90% 48%)' : '3px solid transparent',
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(25 90% 48%), hsl(15 85% 52%))' }}>
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-all duration-150"
          style={{ color: 'hsl(var(--sidebar-muted))' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'hsl(0 84% 60% / 0.12)'; e.currentTarget.style.color = 'hsl(0 84% 65%)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'hsl(var(--sidebar-muted))' }}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
        style={{ background: 'hsl(var(--sidebar))' }}
        onClick={() => setMobileOpen(o => !o)}
      >
        {mobileOpen
          ? <X className="w-4 h-4 text-white" />
          : <Menu className="w-4 h-4 text-white" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 sidebar-overlay md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className="fixed left-0 top-0 h-screen w-64 z-40 md:hidden transition-transform duration-300"
        style={{
          background: 'hsl(var(--sidebar))',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="fixed left-0 top-0 h-screen w-64 hidden md:flex flex-col"
        style={{ background: 'hsl(var(--sidebar))' }}
      >
        <SidebarContent />
      </aside>
    </>
  )
}