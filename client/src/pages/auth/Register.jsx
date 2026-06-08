import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CheckCircle, XCircle } from 'lucide-react'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const validateField = (field, value) => {
    const newErrors = { ...errors }

    if (field === 'name') {
      if (value.trim().length < 2) {
        newErrors.name = 'Name must be at least 2 characters'
      } else if (!/[a-zA-Z]/.test(value)) {
        newErrors.name = 'Name must contain letters, not just numbers'
      } else {
        delete newErrors.name
      }
    }

    if (field === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        newErrors.email = 'Please enter a valid email address'
      } else {
        delete newErrors.email
      }
    }

    if (field === 'password') {
      if (value.length < 8) {
        newErrors.password = 'Password must be at least 8 characters'
      } else {
        delete newErrors.password
      }
    }

    setErrors(newErrors)
  }

  const passwordStrength = () => {
    if (password.length === 0) return null
    if (password.length < 8) return { label: 'Too short', color: 'bg-red-500', width: '25%' }
    if (password.length < 10) return { label: 'Weak', color: 'bg-orange-500', width: '50%' }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: 'Medium', color: 'bg-yellow-500', width: '75%' }
    return { label: 'Strong', color: 'bg-green-500', width: '100%' }
  }

  const isFormValid = () => {
    return (
      name.trim().length >= 2 &&
      /[a-zA-Z]/.test(name) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      password.length >= 8 &&
      Object.keys(errors).length === 0
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Run all validations before submitting
    validateField('name', name)
    validateField('email', email)
    validateField('password', password)
    if (!isFormValid()) return

    setLoading(true)
    setServerError('')
    try {
      await api.post('/auth/register', { name, email, password })
      navigate('/login')
      const loginRes = await api.post('/auth/login', { email, password })
      login(loginRes.data.token)
      const pendingInvite = localStorage.getItem('pendingInviteId')
      navigate(pendingInvite ? `/dashboard?invite=${pendingInvite}` : '/dashboard')
    } catch (err) {
      setServerError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const strength = passwordStrength()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 warm-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-primary">NoteLearn</h1>
          <p className="text-muted-foreground mt-1">AI-Powered Collaborative Study</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Join NoteLearn and start studying smarter</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {serverError && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  {serverError}
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    validateField('name', e.target.value)
                  }}
                  className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.name && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <XCircle className="w-3 h-3" />{errors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    validateField('email', e.target.value)
                  }}
                  className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <XCircle className="w-3 h-3" />{errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    validateField('password', e.target.value)
                  }}
                  className={errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {/* Password strength bar */}
                {strength && (
                  <div className="space-y-1">
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: strength.width }}
                      />
                    </div>
                    <p className={`text-xs ${
                      strength.label === 'Strong' ? 'text-green-600' :
                      strength.label === 'Medium' ? 'text-yellow-600' :
                      strength.label === 'Weak' ? 'text-orange-600' : 'text-destructive'
                    }`}>
                      {strength.label === 'Strong'
                        ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Strong password</span>
                        : strength.label === 'Too short'
                        ? 'Minimum 8 characters required'
                        : `${strength.label} — add uppercase letters and numbers`}
                    </p>
                  </div>
                )}
                {errors.password && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <XCircle className="w-3 h-3" />{errors.password}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !isFormValid()}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}