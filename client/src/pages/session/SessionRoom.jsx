import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { io } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Brain, Users, BookOpen,
  CheckCircle, Target, Send, Hand,
  Mic, MicOff, MessageSquare, Clock,
  Trophy, AlertCircle, Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SOCKET_URL = 'http://localhost:5000'

const PHASE_INFO = [
  {
    id: 'briefing',
    label: 'Briefing',
    icon: BookOpen,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    duration: 10,
    description: 'Introduction and topic overview'
  },
  {
    id: 'peer_teaching',
    label: 'Peer Teaching',
    icon: Users,
    color: 'text-green-500',
    bg: 'bg-green-50',
    border: 'border-green-200',
    duration: 20,
    description: 'Subgroups teach each other'
  },
  {
    id: 'debrief',
    label: 'AI Debrief',
    icon: Brain,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    duration: 10,
    description: 'Share and clarify with everyone'
  },
  {
    id: 'practice',
    label: 'Practice',
    icon: Target,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    duration: 15,
    description: 'Answer flashcard questions'
  },
  {
    id: 'summary',
    label: 'Summary',
    icon: CheckCircle,
    color: 'text-teal-500',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    duration: 0,
    description: 'Review results and wrap up'
  }
]

export default function SessionRoom() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [userName, setUserName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [mySubGroup, setMySubGroup] = useState(null)
  const [mySubGroupIndex, setMySubGroupIndex] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [onlineMembers, setOnlineMembers] = useState([])
  const [handRaised, setHandRaised] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(null)
  const [subgroupDone, setSubgroupDone] = useState(false)
  const messagesEndRef = useRef(null)
  const socketRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setCurrentUserId(payload.id)
    }
    fetchSession()
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!userName || !session) return
    const socket = io(SOCKET_URL)
    socketRef.current = socket

    socket.emit('join-session', { groupId: id, userName })

    socket.on('user-joined', ({ userName: who, members }) => {
      setOnlineMembers(members)
      if (who !== userName) addSystemMessage(`${who} joined the session`)
    })

    socket.on('user-left', ({ userName: who, members }) => {
      setOnlineMembers(members)
      addSystemMessage(`${who} left the session`)
    })

    socket.on('receive-message', (message) => {
      setMessages(prev => [...prev, message])
    })

    socket.on('phase-changed', ({ phase, session: updatedSession }) => {
      setSession(updatedSession)
      startPhaseTimer(phase)
      addSystemMessage(`Moving to Phase ${phase + 1}: ${PHASE_INFO[phase].label}`)
    })

    socket.on('hand-raised', ({ userName: who, raised }) => {
      if (who !== userName) {
        addSystemMessage(raised ? `${who} raised their hand ✋` : `${who} lowered their hand`)
      }
    })

    socket.on('subgroup-done', ({ subGroupIndex }) => {
      addSystemMessage(`Subgroup ${subGroupIndex + 1} has finished teaching!`)
    })

    socket.on('session-ended', () => {
      addSystemMessage('The session has been ended by the admin.')
      setTimeout(() => navigate(`/groups/${session?.group?._id || ''}`), 3000)
    })

    return () => socket.disconnect()
  }, [userName, session?._id])

  useEffect(() => {
    if (!session || !currentUserId) return

    const creatorId = session.createdBy?._id || session.createdBy
    setIsAdmin(creatorId?.toString() === currentUserId)

    const sgIndex = session.subGroups?.findIndex(sg =>
      sg.members?.some(m => (m._id || m).toString() === currentUserId)
    )
    if (sgIndex !== -1 && sgIndex !== undefined) {
      setMySubGroup(session.subGroups[sgIndex])
      setMySubGroupIndex(sgIndex)
    }

    const allMembers = session.subGroups?.flatMap(sg => sg.members) || []
    const me = allMembers.find(m => (m._id || m).toString() === currentUserId)
    setUserName(me?.name || 'Student')

    startPhaseTimer(session.currentPhase)
  }, [session, currentUserId])

    const fetchSession = async () => {
    try {
        const res = await api.get(`/sessions/${id}`)
        setSession(res.data)
        if (res.data.messages?.length > 0) {
        setMessages(res.data.messages)
        }
        if (res.data.timeRemaining !== null && res.data.timeRemaining !== undefined) {
        if (timerRef.current) clearInterval(timerRef.current)
        let secs = res.data.timeRemaining
        setTimeLeft(secs)
        if (secs > 0) {
            timerRef.current = setInterval(() => {
            secs -= 1
            setTimeLeft(secs)
            if (secs <= 0) {
                clearInterval(timerRef.current)
                setTimeLeft(0)
            }
            }, 1000)
        }
        }
    } catch (err) {
        console.error(err)
    } finally {
        setLoading(false)
    }
    }


  const formatTime = (secs) => {
    if (secs === null) return ''
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const addSystemMessage = (text) => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      type: 'system',
      text,
      time: new Date().toLocaleTimeString()
    }])
  }

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current) return
    const message = {
      id: Date.now(),
      type: 'user',
      text: input.trim(),
      sender: userName,
      time: new Date().toLocaleTimeString()
    }
    socketRef.current.emit('send-message', { groupId: id, message })
    setInput('')
  }

  const advancePhase = async () => {
    if (!isAdmin) return
    try {
      const nextPhase = session.currentPhase + 1
      const res = await api.post(`/sessions/${id}/phase`, { phase: nextPhase })
      setSession(res.data)
      socketRef.current?.emit('phase-change', {
        groupId: id,
        phase: nextPhase,
        session: res.data
      })
      startPhaseTimer(nextPhase)
    } catch (err) {
      console.error(err)
    }
  }

  const endSession = async () => {
    if (!isAdmin) return
    try {
      await api.post(`/sessions/${id}/end`)
      socketRef.current?.emit('session-ended', { groupId: id })
      navigate(`/groups/${session?.group?._id || ''}`)
    } catch (err) {
      console.error(err)
    }
  }

  const markSubgroupDone = async () => {
    try {
      const res = await api.post(`/sessions/${id}/subgroup/${mySubGroupIndex}/done`)
      setSubgroupDone(true)
      socketRef.current?.emit('subgroup-done', { groupId: id, subGroupIndex: mySubGroupIndex })
      addSystemMessage(`Your subgroup marked as done. ${res.data.allDone ? 'All subgroups finished!' : 'Waiting for other subgroups...'}`)
    } catch (err) {
      console.error(err)
    }
  }

  const raiseHand = () => {
    const newState = !handRaised
    setHandRaised(newState)
    socketRef.current?.emit('raise-hand', { groupId: id, userName, raised: newState })
    addSystemMessage(newState ? 'You raised your hand ✋' : 'You lowered your hand')
  }

  const submitAnswers = () => {
    let correct = 0
    session.flashcards?.forEach((card, i) => {
      if (answers[i]?.trim().toLowerCase().length > 3) correct++
    })
    const percentage = Math.round((correct / session.flashcards.length) * 100)
    setScore(percentage)
    setSubmitted(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
          <p className="text-muted-foreground">Session not found</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    )
  }

  const currentPhase = session.currentPhase || 0
  const phase = PHASE_INFO[currentPhase]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Leave
          </Button>
          <div>
            <h1 className="font-semibold">{session.topic}</h1>
            <p className="text-xs text-muted-foreground">
              Phase {currentPhase + 1}: {phase.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono font-medium ${
              timeLeft < 60 ? 'bg-red-100 text-red-600' : 'bg-secondary text-foreground'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {formatTime(timeLeft)}
            </div>
          )}
          <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {onlineMembers.length || 1} online
          </div>
          {isAdmin && (
            <Button variant="destructive" size="sm" onClick={endSession}>
              End Session
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 border-r border-border bg-card flex flex-col overflow-y-auto">
          {/* Phase Flow */}
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Session Flow
            </p>
            <div className="space-y-1">
              {PHASE_INFO.map((p, i) => {
                const Icon = p.icon
                const isActive = i === currentPhase
                const isDone = i < currentPhase
                return (
                  <div key={p.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                    isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                  }`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-primary' : isDone ? 'text-green-500' : ''
                    }`} />
                    <span className="truncate">{p.label}</span>
                    {isDone && <CheckCircle className="w-3 h-3 text-green-500 ml-auto flex-shrink-0" />}
                    {isActive && <div className="w-2 h-2 bg-primary rounded-full ml-auto flex-shrink-0 animate-pulse" />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* My Subgroup */}
          {mySubGroup && (
            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                My Subgroup
              </p>
              <div className={`rounded-lg p-3 border ${phase.border} ${phase.bg}`}>
                <p className="text-xs font-semibold mb-2">{mySubGroup.name}</p>
                <div className="space-y-1 mb-3">
                  {mySubGroup.members?.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">
                          {(m.name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs">{m.name || 'Member'}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Topics:</p>
                {mySubGroup.topics?.map((t, i) => (
                  <p key={i} className="text-xs text-foreground bg-white/60 rounded px-2 py-1 mb-1">
                    {t}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="p-4 mt-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Controls
            </p>
            <div className="space-y-2">
              <Button
                variant={isSpeaking ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setIsSpeaking(!isSpeaking)
                  addSystemMessage(!isSpeaking ? 'You took the floor 🎙️' : 'You gave up the floor')
                }}
              >
                {isSpeaking
                  ? <Mic className="w-4 h-4 mr-2" />
                  : <MicOff className="w-4 h-4 mr-2" />}
                {isSpeaking ? 'Speaking' : 'Take Floor'}
              </Button>
              <Button
                variant={handRaised ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start"
                onClick={raiseHand}
              >
                <Hand className="w-4 h-4 mr-2" />
                {handRaised ? 'Hand Raised ✋' : 'Raise Hand'}
              </Button>
              {currentPhase === 1 && mySubGroup && !subgroupDone && (
                <Button
                  size="sm"
                  className="w-full justify-start bg-green-600 hover:bg-green-700"
                  onClick={markSubgroupDone}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Done Teaching
                </Button>
              )}
              {isAdmin && currentPhase < PHASE_INFO.length - 1 && (
                <Button
                  size="sm"
                  className="w-full justify-start"
                  onClick={advancePhase}
                >
                  <Target className="w-4 h-4 mr-2" />
                  Next Phase
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Phase Banner */}
          <div className={`px-6 py-3 border-b ${phase.border} ${phase.bg} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              {(() => { const Icon = phase.icon; return <Icon className={`w-5 h-5 ${phase.color}`} /> })()}
              <div>
                <p className={`font-semibold text-sm ${phase.color}`}>{phase.label}</p>
                <p className="text-xs text-muted-foreground">{phase.description}</p>
              </div>
            </div>
            {currentPhase === 0 && (
              <div className="text-xs text-muted-foreground bg-white/60 px-3 py-1 rounded-full">
                Introduce yourself and share what you know about: <strong>{session.topic}</strong>
              </div>
            )}
            {currentPhase === 1 && mySubGroup && (
              <div className="text-xs text-muted-foreground bg-white/60 px-3 py-1 rounded-full">
                Teach your subgroup: {mySubGroup.topics?.join(', ')}
              </div>
            )}
            {currentPhase === 2 && (
              <div className="text-xs text-muted-foreground bg-white/60 px-3 py-1 rounded-full">
                Share your subgroup's findings with everyone
              </div>
            )}
            {currentPhase === 3 && !submitted && (
              <div className="text-xs text-muted-foreground bg-white/60 px-3 py-1 rounded-full">
                Answer all questions then click Submit
              </div>
            )}
          </div>

          {/* Phase 3 (Practice) — Flashcard Interface */}
          {currentPhase === 3 ? (
            <div className="flex-1 overflow-y-auto p-6">
              {submitted ? (
                <div className="max-w-2xl mx-auto text-center py-12">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
                    score >= 70 ? 'bg-green-100' : score >= 40 ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    <Trophy className={`w-12 h-12 ${
                      score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'
                    }`} />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">{score}%</h2>
                  <p className="text-muted-foreground mb-2">
                    {score >= 70 ? 'Excellent work! 🎉' : score >= 40 ? 'Good effort! Keep reviewing.' : 'Keep studying — you\'ll get there!'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Waiting for everyone to finish before moving to Summary...
                  </p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto">
                  <h2 className="text-xl font-bold mb-6">
                    Answer these questions — {session.flashcards?.length} total
                  </h2>
                  <div className="space-y-6">
                    {session.flashcards?.map((card, i) => (
                      <Card key={i}>
                        <CardContent className="p-5">
                          <p className="font-medium mb-3">
                            <span className="text-muted-foreground text-sm mr-2">Q{i + 1}.</span>
                            {card.question}
                          </p>
                          <textarea
                            className="w-full border border-border rounded-lg p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20"
                            rows={3}
                            placeholder="Type your answer here..."
                            value={answers[i] || ''}
                            onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Button className="w-full mt-6" size="lg" onClick={submitAnswers}>
                    Submit Answers
                  </Button>
                </div>
              )}
            </div>
          ) : currentPhase === 4 ? (
            /* Phase 4 (Summary) */
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto">
                <Card className="mb-6 bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Brain className="w-6 h-6 text-primary" />
                      <p className="font-semibold">AI Summary</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Great session on <strong>{session.topic}</strong>! Here is a summary of what was covered.
                      Each subgroup taught their assigned topics, the group practiced with flashcards,
                      and everyone contributed to the discussion. Connect your AI service to get
                      a detailed personalized summary based on your uploaded document.
                    </p>
                  </CardContent>
                </Card>
                <p className="text-sm text-muted-foreground text-center">
                  Use the chat to ask final questions. The admin will end the session when ready.
                </p>
              </div>
            </div>
          ) : (
            /* All other phases — Chat Interface */
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      {currentPhase === 0
                        ? 'Introduce yourself and share what you already know about this topic.'
                        : currentPhase === 1
                        ? 'Discuss your assigned topics with your subgroup.'
                        : 'Share your findings with the whole group.'}
                    </p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id}>
                    {msg.type === 'system' && (
                      <div className="flex justify-center">
                        <span className="text-xs text-muted-foreground bg-secondary px-4 py-1.5 rounded-full">
                          {msg.text}
                        </span>
                      </div>
                    )}
                    {msg.type === 'user' && (
                      <div className={`flex ${msg.sender === userName ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-md">
                          {msg.sender !== userName && (
                            <p className="text-xs font-medium text-muted-foreground mb-1 ml-1">
                              {msg.sender}
                            </p>
                          )}
                          <div className={`rounded-2xl px-4 py-2.5 ${
                            msg.sender === userName
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-secondary text-foreground rounded-tl-sm'
                          }`}>
                            <p className="text-sm">{msg.text}</p>
                          </div>
                          <p className={`text-xs text-muted-foreground mt-1 ${
                            msg.sender === userName ? 'text-right' : ''
                          }`}>
                            {msg.time}
                          </p>
                        </div>
                      </div>
                    )}
                    {msg.type === 'ai' && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Brain className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="max-w-lg">
                          <p className="text-xs font-medium text-purple-600 mb-1">AI Facilitator</p>
                          <div className="bg-purple-50 border border-purple-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{msg.time}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-border p-4">
                <div className="flex items-center gap-2 bg-secondary rounded-xl px-4 py-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button size="sm" onClick={sendMessage} disabled={!input.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}