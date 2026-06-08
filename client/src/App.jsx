import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Dashboard from './pages/dashboard/Dashboard'
import Groups from './pages/group/Groups'
import GroupDetail from './pages/group/GroupDetail'
import Documents from './pages/documents/Documents'
import SessionRoom from './pages/session/SessionRoom'
import Landing from './pages/Landing'
import InviteLanding from './pages/invite/InviteLanding'

const ProtectedRoute = ({ children }) => {
  const { user, authLoading } = useAuth()
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
      <Route path="/groups/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />  
      <Route path="/documents" element={<ProtectedRoute><Documents /></      ProtectedRoute>} />
      <Route path="/session/:id" element={<ProtectedRoute><SessionRoom /></ProtectedRoute>} />
      <Route path="/invite/:inviteId" element={<InviteLanding />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}