import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GraduationCap, Users, Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function InviteLanding() {
  const { inviteId } = useParams()
  const navigate = useNavigate()
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await api.get(`/groups/invite-info/${inviteId}`)
        setInvite(res.data)
        // Store inviteId so after login/register we can show it
        localStorage.setItem('pendingInviteId', inviteId)
      } catch (err) {
        setError('This invitation link is invalid or has expired.')
      } finally {
        setLoading(false)
      }
    }
    fetchInvite()
  }, [inviteId])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center warm-bg">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center warm-bg p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Invalid Invitation</h2>
          <p className="text-muted-foreground text-sm mb-6">{error}</p>
          <Button onClick={() => navigate('/')}>Go to NoteLearn</Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center warm-bg p-4">
      <div className="w-full max-w-md">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg, hsl(25 90% 48%), hsl(15 85% 52%))' }}>
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-primary">NoteLearn</h1>
          <p className="text-muted-foreground text-sm mt-1">AI-Powered Collaborative Study</p>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">You're invited! 🎉</h2>
              <p className="text-muted-foreground text-sm">You've been invited to join a study group</p>
            </div>

            {/* Group name card */}
            <div className="bg-secondary rounded-xl p-4 text-center mb-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Study Group</p>
              <p className="text-lg font-bold">{invite.groupName}</p>
            </div>

            <div className="space-y-3">
              <Button className="w-full" onClick={() => navigate(`/login?invite=${inviteId}`)}>
                Sign in to Accept
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate(`/register?invite=${inviteId}`)}>
                Create an Account
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              After signing in, your invitation will appear on your dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}