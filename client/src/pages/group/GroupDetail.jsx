import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MainLayout from '../../components/layout/MainLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '../../services/api'
import { 
  Users, 
  Mail, 
  Crown, 
  ArrowLeft,
  UserPlus,
  Play,
  X
} from 'lucide-react'

export default function GroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  useEffect(() => {
    fetchGroup()
  }, [id])

  const fetchGroup = async () => {
    try {
      const res = await api.get(`/groups/${id}`)
      setGroup(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const sendInvite = async (e) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')
    try {
      await api.post('/groups/invite', { email: inviteEmail, groupId: id })
      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
    } catch (err) {
      setInviteError(err.response?.data?.message || 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading group...</p>
        </div>
      </MainLayout>
    )
  }

  if (!group) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Group not found</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate('/groups')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{group.name}</h1>
              <p className="text-muted-foreground mt-1">{group.description || 'No description'}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {group.members.length} member{group.members.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite
            </Button>
            <Button onClick={() => navigate(`/session/${id}`)}>
              <Play className="w-4 h-4 mr-2" />
              Start Session
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {group.members.map((member, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{member.name || 'Member'}</p>
                      <p className="text-xs text-muted-foreground">{member.email || ''}</p>
                    </div>
                    {group.admin === member._id || group.admin?._id === member._id ? (
                      <Crown className="w-4 h-4 text-yellow-500" />
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start" 
                onClick={() => navigate(`/session/${id}`)}
              >
                <Play className="w-4 h-4 mr-3" />
                Start Study Session
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setShowInvite(true)}
              >
                <UserPlus className="w-4 h-4 mr-3" />
                Invite Members
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/documents')}
              >
                <Mail className="w-4 h-4 mr-3" />
                Upload Documents
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Invite Modal */}
        {showInvite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Invite to Group</CardTitle>
                <button onClick={() => { setShowInvite(false); setInviteSuccess(''); setInviteError('') }}>
                  <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                </button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter the email address of the person you want to invite. They will receive 
                  a pending invitation even if they don't have an account yet.
                </p>
                <form onSubmit={sendInvite} className="space-y-4">
                  {inviteError && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                      {inviteError}
                    </div>
                  )}
                  {inviteSuccess && (
                    <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
                      {inviteSuccess}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="classmate@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" 
                      onClick={() => { setShowInvite(false); setInviteSuccess(''); setInviteError('') }}>
                      Close
                    </Button>
                    <Button type="submit" className="flex-1" disabled={inviteLoading}>
                      {inviteLoading ? 'Sending...' : 'Send Invite'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  )
}