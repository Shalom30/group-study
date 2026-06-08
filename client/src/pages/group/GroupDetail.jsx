import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MainLayout from '../../components/layout/MainLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '../../services/api'
import {
  Users, ArrowLeft, UserPlus, Play,
  X, Crown, FileText, Upload, Loader2, Trash2,
  History, Trophy, Calendar
} from 'lucide-react'

export default function GroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [showCreateSession, setShowCreateSession] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [sessionTopic, setSessionTopic] = useState('')
  const [sessionFiles, setSessionFiles] = useState([])
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [activeSession, setActiveSession] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pastSessions, setPastSessions] = useState([])
  const [pastLoading, setPastLoading] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResults, setBulkResults] = useState(null)
  const [inviteTab, setInviteTab] = useState('single')
  const [coAdminRequesting, setCoAdminRequesting] = useState(false)
  const [respondingTo, setRespondingTo] = useState(null)
  const [removingCoAdmin, setRemovingCoAdmin] = useState(null)

  useEffect(() => {
    fetchGroup()
    fetchActiveSession()
    fetchPastSessions()

    const token = localStorage.getItem('token')
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setCurrentUserId(payload.id)
    }

    const interval = setInterval(() => {
      fetchGroup()
      fetchActiveSession()
    }, 5000)

    return () => clearInterval(interval)
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

  const fetchActiveSession = async () => {
    try {
      const res = await api.get(`/sessions/group/${id}/active`)
      setActiveSession(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchPastSessions = async () => {
    setPastLoading(true)
    try {
      const res = await api.get(`/sessions/group/${id}/history`)
      setPastSessions(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setPastLoading(false)
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

  const sendBulkInvite = async (e) => {
    e.preventDefault()
    if (!bulkFile) return
    setBulkLoading(true)
    setBulkResults(null)

    try {
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
      const data = await bulkFile.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      const emails = rows
        .map(row => row[0]?.toString().trim())
        .filter(val => val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))

      if (emails.length === 0) {
        setBulkResults({ error: 'No valid emails found in the file. Make sure emails are in the first column.' })
        setBulkLoading(false)
        return
      }

      let sent = 0
      let alreadyInvited = 0
      let failed = 0

      for (const email of emails) {
        try {
          await api.post('/groups/invite', { email, groupId: id })
          sent++
        } catch (err) {
          if (err.response?.data?.message?.includes('already')) {
            alreadyInvited++
          } else {
            failed++
          }
        }
      }

      setBulkResults({ sent, alreadyInvited, failed, total: emails.length })
      setBulkFile(null)
    } catch (err) {
      setBulkResults({ error: 'Failed to read the file. Make sure it is a valid .xlsx file.' })
    } finally {
      setBulkLoading(false)
    }
  }

  const createSession = async (e) => {
    e.preventDefault()
    if (!sessionTopic.trim()) return
    setSessionLoading(true)
    setSessionError('')
    try {
      const formData = new FormData()
      formData.append('groupId', id)
      formData.append('topic', sessionTopic)
      sessionFiles.forEach(f => formData.append('documents', f))
      const res = await api.post('/sessions/create', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      navigate(`/session/${res.data._id}`)
    } catch (err) {
      setSessionError(err.response?.data?.message || 'Failed to create session')
    } finally {
      setSessionLoading(false)
    }
  }

  const requestCoAdmin = async () => {
    setCoAdminRequesting(true)
    try {
      await api.post(`/groups/${id}/request-coadmin`)
      fetchGroup()
    } catch (err) {
      console.error(err)
    } finally {
      setCoAdminRequesting(false)
    }
  }

  const respondToCoAdminRequest = async (userId, action) => {
    setRespondingTo(userId + action)
    try {
      await api.post(`/groups/${id}/coadmin-respond`, { userId, action })
      fetchGroup()
    } catch (err) {
      console.error(err)
    } finally {
      setRespondingTo(null)
    }
  }

  const removeCoAdmin = async (userId) => {
    setRemovingCoAdmin(userId)
    try {
      await api.post(`/groups/${id}/remove-coadmin`, { userId })
      fetchGroup()
    } catch (err) {
      console.error(err)
    } finally {
      setRemovingCoAdmin(null)
    }
  }

  const deleteGroup = async () => {
    setDeleteLoading(true)
    try {
      await api.delete(`/groups/${id}`)
      navigate('/groups')
    } catch (err) {
      console.error(err)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── derived admin state ──────────────────────────────────────────────────
  const adminId = group?.admin?._id
    ? group.admin._id.toString()
    : group?.admin?.toString() ?? ''
  const isAdmin = !!adminId && adminId === currentUserId
  const coAdminIds = group?.coAdmins?.map(c => (c._id || c).toString()) || []
  const isCoAdmin = coAdminIds.includes(currentUserId)
  const isAnyAdmin = isAdmin || isCoAdmin
  const hasRequestedCoAdmin = group?.coAdminRequests?.some(
    r => (r.user?._id || r.user)?.toString() === currentUserId
  )

  // ── loading / not found guards ───────────────────────────────────────────
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

  const isMember = group.members?.some(
    m => (m._id || m).toString() === currentUserId
  )
  if (!isMember && currentUserId) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64 flex-col gap-3">
          <p className="text-muted-foreground font-medium">You are not a member of this group.</p>
          <Button onClick={() => navigate('/groups')}>Back to Groups</Button>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">

        {/* Back button */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate('/groups')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Group header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 md:mb-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Invite</span>
            </Button>
            {activeSession ? (
              <Button size="sm" onClick={() => navigate(`/session/${activeSession._id}`)}>
                <Play className="w-4 h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Join </span>Session
              </Button>
            ) : isAnyAdmin ? (
              <Button size="sm" onClick={() => setShowCreateSession(true)}>
                <Play className="w-4 h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Start </span>Session
              </Button>
            ) : (
              <Button disabled variant="outline" size="sm">
                <span className="hidden sm:inline">Waiting for session...</span>
                <span className="sm:hidden">Waiting...</span>
              </Button>
            )}
            {isAdmin && (
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Delete</span>
              </Button>
            )}
          </div>
        </div>

        {/* Active Session Banner */}
        {activeSession && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="font-medium text-green-800">Active Session: {activeSession.topic}</p>
                <p className="text-sm text-green-600">Phase {activeSession.currentPhase + 1} — Click to join</p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate(`/session/${activeSession._id}`)}>
              Join Now
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Members card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {group.members.map((member, i) => {
                  const memberId = (member._id || member).toString()
                  const isMainAdmin = memberId === adminId
                  const isMemberCoAdmin = coAdminIds.includes(memberId)
                  return (
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
                      <div className="flex items-center gap-2">
                        {isMainAdmin && (
                          <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                            <Crown className="w-3 h-3" /> Admin
                          </span>
                        )}
                        {!isMainAdmin && isMemberCoAdmin && (
                          <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            <Crown className="w-3 h-3" /> Co-Admin
                          </span>
                        )}
                        {isAdmin && isMemberCoAdmin && !isMainAdmin && (
                          <button
                            onClick={() => removeCoAdmin(memberId)}
                            disabled={removingCoAdmin === memberId}
                            className="text-xs text-destructive hover:underline"
                          >
                            {removingCoAdmin === memberId ? '...' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Request Co-Admin — only for regular members */}
              {!isAdmin && !isCoAdmin && (
                <div className="mt-4 pt-4 border-t border-border">
                  {hasRequestedCoAdmin ? (
                    <p className="text-xs text-center text-muted-foreground bg-secondary rounded-lg py-2">
                      ✅ Co-admin request sent — waiting for admin approval
                    </p>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={requestCoAdmin}
                      disabled={coAdminRequesting}
                    >
                      {coAdminRequesting ? (
                        <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Sending request...</>
                      ) : (
                        <><Crown className="w-3 h-3 mr-2" />Request Co-Admin Role</>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {isAnyAdmin && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Co-admins: {coAdminIds.length}/3 slots filled
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions card */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isAnyAdmin && !activeSession && (
                <Button className="w-full justify-start" onClick={() => setShowCreateSession(true)}>
                  <Play className="w-4 h-4 mr-3" />
                  Start New Study Session
                </Button>
              )}
              {activeSession && (
                <Button className="w-full justify-start" onClick={() => navigate(`/session/${activeSession._id}`)}>
                  <Play className="w-4 h-4 mr-3" />
                  Join Active Session
                </Button>
              )}
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowInvite(true)}>
                <UserPlus className="w-4 h-4 mr-3" />
                Invite Members
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/documents')}>
                <FileText className="w-4 h-4 mr-3" />
                Upload Documents
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Co-Admin Requests — main admin only */}
        {isAdmin && group.coAdminRequests?.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold">Co-Admin Requests</h2>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                {group.coAdminRequests.length} pending
              </span>
            </div>
            <div className="space-y-2">
              {group.coAdminRequests.map((req, i) => {
                const reqUser = group.members.find(
                  m => (m._id || m).toString() === (req.user?._id || req.user)?.toString()
                )
                const reqUserId = (req.user?._id || req.user)?.toString()
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                    <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {reqUser?.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{reqUser?.name || 'Member'}</p>
                      <p className="text-xs text-muted-foreground">Requesting co-admin access</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={respondingTo === reqUserId + 'approve' || coAdminIds.length >= 3}
                        onClick={() => respondToCoAdminRequest(reqUserId, 'approve')}
                      >
                        {respondingTo === reqUserId + 'approve'
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : coAdminIds.length >= 3 ? 'Full' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={respondingTo === reqUserId + 'reject'}
                        onClick={() => respondToCoAdminRequest(reqUserId, 'reject')}
                      >
                        {respondingTo === reqUserId + 'reject'
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : 'Reject'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            {coAdminIds.length >= 3 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                All 3 co-admin slots are filled. Remove one to approve new requests.
              </p>
            )}
          </div>
        )}

        {/* Past Sessions */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Past Sessions</h2>
          </div>

          {pastLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : pastSessions.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-xl">
              <History className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No past sessions yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Completed sessions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pastSessions.map((s, i) => {
                const avgScore = s.scores?.length > 0
                  ? Math.round(s.scores.reduce((a, sc) => a + sc.score, 0) / s.scores.length)
                  : null
                const date = new Date(s.updatedAt).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                })
                return (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-colors">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.topic}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />{date}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          {s.scores?.length || 0} participant{s.scores?.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="sm:hidden flex-shrink-0">
                      {avgScore !== null ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${avgScore >= 70 ? 'bg-green-100 text-green-700' : avgScore >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {avgScore}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                      {avgScore !== null && (
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${avgScore >= 70 ? 'bg-green-100 text-green-700' : avgScore >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          <Trophy className="w-3 h-3" />
                          Avg {avgScore}%
                        </div>
                      )}
                      {avgScore === null && (
                        <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">No scores</span>
                      )}
                      <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-full">
                        Phase {s.currentPhase + 1} reached
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── MODALS ─────────────────────────────────────────────────────── */}

        {/* Create Session Modal */}
        {showCreateSession && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Start Study Session</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Upload your study material and set a topic</p>
                </div>
                <button onClick={() => { setShowCreateSession(false); setSessionFiles([]); setSessionError('') }}>
                  <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                </button>
              </CardHeader>
              <CardContent>
                <form onSubmit={createSession} className="space-y-5">
                  {sessionError && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{sessionError}</div>
                  )}

                  {/* Topic */}
                  <div className="space-y-2">
                    <Label>Study Topic</Label>
                    <Input
                      placeholder="e.g. Data Structures - Binary Trees"
                      value={sessionTopic}
                      onChange={(e) => setSessionTopic(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">This is what the group will study today</p>
                  </div>

                  {/* ── File Upload ── */}
                  <div className="space-y-2">
                    <Label>Study Materials (PDF / Word) — up to 10 files</Label>
                    <div className="border-2 border-dashed border-border rounded-xl p-5 text-center">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.docx"
                          multiple
                          onClick={(e) => { e.target.value = '' }}
                          onChange={(e) => {
                            const picked = Array.from(e.target.files).slice(0, 10)
                            setSessionFiles(prev => {
                              const combined = [...prev, ...picked]
                              const unique = combined.filter(
                                (f, idx, arr) => arr.findIndex(x => x.name === f.name) === idx
                              )
                              return unique.slice(0, 10)
                            })
                          }}
                          className="hidden"
                        />
                        <span className="text-sm text-primary hover:underline font-medium">
                          Click to upload PDFs or Word docs
                        </span>
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Optional — AI uses these to generate topics and flashcards
                      </p>
                    </div>
                    {sessionFiles.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {sessionFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 bg-secondary/60 rounded-lg px-3 py-2">
                            <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <span className="text-xs flex-1 truncate">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => setSessionFiles(prev => prev.filter((_, j) => j !== i))}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground text-right">
                          {sessionFiles.length}/10 files
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Member limit warning */}
                  {group.members.length > 21 && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                      <X className="w-4 h-4 flex-shrink-0" />
                      This group has {group.members.length} members — sessions are capped at 21. Remove some members before starting.
                    </div>
                  )}

                  <div className="bg-secondary/50 rounded-xl p-4">
                    <p className="text-sm font-medium mb-2">What happens when you start:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✅ Members are divided into subgroups of max 3</li>
                      <li>✅ Topics are distributed across subgroups</li>
                      <li>✅ Flashcards are prepared for the practice phase</li>
                      <li>✅ All members are notified to join</li>
                    </ul>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowCreateSession(false); setSessionFiles([]); setSessionError('') }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={sessionLoading || !sessionTopic.trim() || group.members.length > 21}
                    >
                      {sessionLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                      ) : (
                        <><Play className="w-4 h-4 mr-2" />Start Session</>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delete Group Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-destructive">Delete Group</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete <strong>{group.name}</strong>?
                  This will permanently remove the group and all its invitations. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>
                    Cancel
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={deleteGroup} disabled={deleteLoading}>
                    {deleteLoading
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>
                      : 'Yes, Delete Group'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Invite Modal */}
        {showInvite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Invite Members</CardTitle>
                <button onClick={() => {
                  setShowInvite(false)
                  setInviteSuccess('')
                  setInviteError('')
                  setBulkResults(null)
                  setBulkFile(null)
                  setInviteTab('single')
                }}>
                  <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                </button>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-5">
                  <button
                    onClick={() => setInviteTab('single')}
                    className={`flex-1 text-sm py-2 rounded-lg font-medium transition-all ${inviteTab === 'single' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Single Invite
                  </button>
                  <button
                    onClick={() => setInviteTab('bulk')}
                    className={`flex-1 text-sm py-2 rounded-lg font-medium transition-all ${inviteTab === 'bulk' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Bulk Invite (Excel)
                  </button>
                </div>

                {inviteTab === 'single' && (
                  <form onSubmit={sendInvite} className="space-y-4">
                    {inviteError && (
                      <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{inviteError}</div>
                    )}
                    {inviteSuccess && (
                      <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">✅ {inviteSuccess}</div>
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
                        {inviteLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : 'Send Invite'}
                      </Button>
                    </div>
                  </form>
                )}

                {inviteTab === 'bulk' && (
                  <form onSubmit={sendBulkInvite} className="space-y-4">
                    <div className="bg-secondary/50 rounded-xl p-4 text-sm text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">How to prepare your Excel file:</p>
                      <p>• Put all emails in the <strong>first column (Column A)</strong></p>
                      <p>• One email per row</p>
                      <p>• You can have a header like "Email" in row 1 — it will be skipped</p>
                      <p>• Save as <strong>.xlsx</strong> format</p>
                    </div>
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => { setBulkFile(e.target.files[0]); setBulkResults(null) }}
                          className="hidden"
                        />
                        <span className="text-sm text-primary hover:underline font-medium">
                          {bulkFile ? bulkFile.name : 'Click to upload Excel file'}
                        </span>
                      </label>
                      {bulkFile && <p className="text-xs text-muted-foreground mt-1">Ready to send invitations</p>}
                    </div>
                    {bulkResults && !bulkResults.error && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
                        <p className="text-sm font-semibold text-green-800">
                          ✅ Bulk invite complete — {bulkResults.total} emails processed
                        </p>
                        <p className="text-xs text-green-700">
                          {bulkResults.sent} invitation{bulkResults.sent !== 1 ? 's' : ''} sent successfully
                        </p>
                        {bulkResults.alreadyInvited > 0 && (
                          <p className="text-xs text-yellow-700">{bulkResults.alreadyInvited} already invited or member</p>
                        )}
                        {bulkResults.failed > 0 && (
                          <p className="text-xs text-red-600">{bulkResults.failed} failed to send</p>
                        )}
                      </div>
                    )}
                    {bulkResults?.error && (
                      <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{bulkResults.error}</div>
                    )}
                    <div className="flex gap-3">
                      <Button type="button" variant="outline" className="flex-1"
                        onClick={() => { setShowInvite(false); setBulkResults(null); setBulkFile(null) }}>
                        Close
                      </Button>
                      <Button type="submit" className="flex-1" disabled={bulkLoading || !bulkFile}>
                        {bulkLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending all...</> : 'Send All Invites'}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </MainLayout>
  )
}