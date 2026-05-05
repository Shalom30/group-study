import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import MainLayout from '../../components/layout/MainLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '../../services/api'
import { Users, BookOpen, Brain, ArrowRight, Plus } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [invitations, setInvitations] = useState([])

  useEffect(() => {
    fetchGroups()
    fetchInvitations()
  }, [])

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups/my-groups')
      setGroups(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchInvitations = async () => {
    try {
      const res = await api.get('/groups/invitations')
      setInvitations(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const acceptInvitation = async (id) => {
    try {
      await api.post(`/groups/accept/${id}`)
      fetchInvitations()
      fetchGroups()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome back 👋</h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your studies today.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Study Groups</p>
                  <p className="text-3xl font-bold mt-1">{groups.length}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Invites</p>
                  <p className="text-3xl font-bold mt-1">{invitations.length}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Sessions</p>
                  <p className="text-3xl font-bold mt-1">0</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* My Groups */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">My Study Groups</CardTitle>
              <Button size="sm" onClick={() => navigate('/groups')}>
                <Plus className="w-4 h-4 mr-1" /> New Group
              </Button>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No study groups yet</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/groups')}>
                    Create your first group
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div key={group._id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{group.name}</p>
                        <p className="text-xs text-muted-foreground">{group.members.length} members</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/groups/${group._id}`)}>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No pending invitations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitations.map((invite) => (
                    <div key={invite._id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="font-medium text-sm">{invite.group?.name}</p>
                        <p className="text-xs text-muted-foreground">You've been invited to join</p>
                      </div>
                      <Button size="sm" onClick={() => acceptInvitation(invite._id)}>
                        Accept
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}