import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../components/layout/MainLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '../../services/api'
import { Users, Plus, ArrowRight, X } from 'lucide-react'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups/my-groups')
      setGroups(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const createGroup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/groups/create', { name, description })
      setName('')
      setDescription('')
      setShowCreate(false)
      fetchGroups()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Study Groups</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your collaborative study groups
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Group
          </Button>
        </div>

        {/* Create Group Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Create Study Group</CardTitle>
                <button onClick={() => setShowCreate(false)}>
                  <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                </button>
              </CardHeader>
              <CardContent>
                <form onSubmit={createGroup} className="space-y-4">
                  {error && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Group Name</Label>
                    <Input
                      placeholder="e.g. Final Year Squad"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="What will you study together?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Group'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Groups Grid */}
        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No study groups yet</h3>
              <p className="text-muted-foreground mb-6">
                Create a group and invite your classmates to study together
              </p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create your first group
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Card key={group._id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                      {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{group.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {group.description || 'No description'}
                  </p>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => navigate(`/groups/${group._id}`)}
                  >
                    Open Group
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  )
}