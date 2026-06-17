import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { io } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Brain, Users, BookOpen,
  CheckCircle, Target, Send, Hand,
  Mic, MicOff, MessageSquare, Clock,
  Trophy, AlertCircle, Loader2, Lock, Menu, X, Phone
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import VoiceRoom from '../session/VoiceRoom'

const SOCKET_URL = 'http://localhost:5000'

const PHASE_INFO = [
  { id: 'briefing', label: 'Briefing', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', duration: 10, description: 'Introduction and topic overview' },
  { id: 'peer_teaching', label: 'Peer Teaching', icon: Users, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200', duration: 20, description: 'Subgroups teach each other' },
  { id: 'debrief', label: 'AI Debrief', icon: Brain, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', duration: 10, description: 'Share and clarify with everyone' },
  { id: 'practice', label: 'Practice', icon: Target, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', duration: 15, description: 'Answer flashcard questions' },
  { id: 'summary', label: 'Summary', icon: CheckCircle, color: 'text-teal-500', bg: 'bg-teal-50', border: 'border-teal-200', duration: 0, description: 'Review results and wrap up' }
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

  // Two separate message arrays
  const [generalMessages, setGeneralMessages] = useState([])
  const [subgroupMessages, setSubgroupMessages] = useState([])

  const [input, setInput] = useState('')
  const [onlineMembers, setOnlineMembers] = useState([])
  const [handRaised, setHandRaised] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [wrongAnswers, setWrongAnswers] = useState([])
  const [score, setScore] = useState(null)
  const [subgroupDone, setSubgroupDone] = useState(false)
  const [allSubgroupsDone, setAllSubgroupsDone] = useState(false)
  const [finishedEarly, setFinishedEarly] = useState(false)
  const [presentingSubgroupIndex, setPresentingSubgroupIndex] = useState(0)
  const [allDebriefDone, setAllDebriefDone] = useState(false)
  const [sessionScores, setSessionScores] = useState([])
  const [readyStudents, setReadyStudents] = useState([])
  const [iAmReady, setIAmReady] = useState(false)
  const [nudgeReceived, setNudgeReceived] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef(null)
  const socketRef = useRef(null)
  const timerRef = useRef(null)
  const [dmMessages, setDmMessages] = useState([])
  const [dmInput, setDmInput] = useState('')
  const [showDmPanel, setShowDmPanel] = useState(false)
  const [mentionSuggestions, setMentionSuggestions] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const [showVoiceRoom, setShowVoiceRoom] = useState(false)
  const [showChatOverlay, setShowChatOverlay] = useState(false)
  const [dmUnread, setDmUnread] = useState(0)
  const receivedVoiceIdsRef = useRef(new Set())

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setCurrentUserId(payload.id)
    }
    fetchSession()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [id])

  useEffect(() => {
    if (!session || !currentUserId) return

    const creatorId = session.createdBy?._id
      ? session.createdBy._id.toString()
      : session.createdBy?.toString()
    setIsAdmin(creatorId === currentUserId)

    const sgIndex = session.subGroups?.findIndex(sg =>
      sg.members?.some(m => (m._id || m).toString() === currentUserId)
    )
    if (sgIndex !== undefined && sgIndex !== -1) {
      setMySubGroup(session.subGroups[sgIndex])
      setMySubGroupIndex(sgIndex)
      // Load subgroup chat history
      if (session.subGroups[sgIndex].messages?.length > 0) {
        setSubgroupMessages(session.subGroups[sgIndex].messages)
      }
    }

    const allMembers = session.subGroups?.flatMap(sg => sg.members) || []
    const me = allMembers.find(m => (m._id || m).toString() === currentUserId)
    setUserName(me?.name || 'Student')
  }, [session, currentUserId])

  // Connect socket after userName is known
  useEffect(() => {
    if (!userName || !session?._id || mySubGroupIndex === null) return

    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    const socket = io(SOCKET_URL)
    socketRef.current = socket

    // Pass subGroupIndex so server joins the right subgroup room
    socket.emit('join-session', {
      groupId: id,
      userName,
      subGroupIndex: mySubGroupIndex
    })

    socket.on('user-joined', ({ userName: who, members }) => {
      setOnlineMembers(members)
      if (who !== userName) addGeneralSystemMessage(`${who} joined the session`)
    })

    socket.on('user-left', ({ userName: who, members }) => {
      setOnlineMembers(members)
      addGeneralSystemMessage(`${who} left the session`)
    })

    // General messages (phases 0, 2, 3, 4)
    socket.on('receive-message', (message) => {
      setGeneralMessages(prev => [...prev, message])
    })

    // Subgroup messages (phase 1)
    socket.on('receive-subgroup-message', (message) => {
      setSubgroupMessages(prev => [...prev, message])
    })

    socket.on('phase-changed', ({ phase, session: updatedSession }) => {
      if (updatedSession) setSession(updatedSession)
      if (phase === 0) {
        startTimer(PHASE_INFO[phase]?.duration || 0, true)
      } else {
        startTimer(0, false)
      }
      addGeneralSystemMessage(`Moving to Phase ${phase + 1}: ${PHASE_INFO[phase]?.label}`)
      // Reset subgroup done state when moving phases
      setSubgroupDone(false)
      setFinishedEarly(false)
      setAllSubgroupsDone(false)
      setPresentingSubgroupIndex(0)
      setAllDebriefDone(false)
    })

    socket.on('hand-raised', ({ userName: who, raised }) => {
      if (who !== userName) {
        addGeneralSystemMessage(raised ? `${who} raised their hand ✋` : `${who} lowered their hand`)
      }
    })

    socket.on('subgroup-finished', ({ subGroupIndex: doneIndex }) => {
      addGeneralSystemMessage(`Subgroup ${doneIndex + 1} has finished teaching! ✅`)
    })

    socket.on('all-subgroups-done', () => {
      setAllSubgroupsDone(true)
      addGeneralSystemMessage('All subgroups are done! Waiting for admin to advance to Debrief.')
    })
    socket.on('debrief-presenter-changed', ({ presentingIndex }) => {
      setPresentingSubgroupIndex(presentingIndex)
      const total = session?.subGroups?.length || 0
      if (presentingIndex >= total) {
        setAllDebriefDone(true)
        addGeneralSystemMessage('All subgroups have presented! Admin can now advance to Practice.')
      } else {
        const name = session?.subGroups?.[presentingIndex]?.name || `Subgroup ${presentingIndex + 1}`
        addGeneralSystemMessage(`🎤 ${name} is now presenting!`)
      }
    })

    socket.on('student-ready', ({ userName: who }) => {
      setReadyStudents(prev => prev.includes(who) ? prev : [...prev, who])
      addGeneralSystemMessage(`${who} is ready to end the session ✅`)
    })

    const receivedVoiceIds = new Set()
    socket.on('receive-voice-note', ({ audioData, sender, time, noteId }) => {
      if (sender === userName) return
      const voiceMessage = {
        id: noteId || `${sender}-${time}`,
        type: 'voice',
        audioData,
        sender,
        time
      }
      setSession(currentSession => {
        const phase = currentSession?.currentPhase ?? 0
        if (phase === 1) {
          setSubgroupMessages(prev => {
            if (prev.some(m => m.id === voiceMessage.id)) return prev
            return [...prev, voiceMessage]
          })
        } else {
          setGeneralMessages(prev => {
            if (prev.some(m => m.id === voiceMessage.id)) return prev
            return [...prev, voiceMessage]
          })
        }
        return currentSession
      })
    })

    socket.on('dm-received', ({ from, message, time }) => {
      setDmMessages(prev => [...prev, { from, message, time }])
      if (from !== userName && !showDmPanel) {
        setDmUnread(n => n + 1)
        setShowDmPanel(true)
      }
    })
    socket.on('kicked-target', ({ targetName }) => {
      if (targetName === userName) {
        const groupPageId = session?.group?._id || session?.group
        navigate(`/groups/${groupPageId}`)
      }
    })

    socket.on('nudge-received', ({ targetName }) => {
      if (targetName === userName) {
        setNudgeReceived(true)
        setTimeout(() => setNudgeReceived(false), 5000)
      }
    })

    socket.on('score-submitted', ({ userName: who, score: theirScore }) => {
      setSessionScores(prev => {
        const filtered = prev.filter(s => s.userName !== who)
        return [...filtered, { userName: who, score: theirScore }]
      })
      addGeneralSystemMessage(`${who} has submitted their answers ✅`)
    })
    
    // Admin ended session — redirect everyone to group page
    socket.on('session-ended', ({ groupPageId }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      navigate(`/groups/${groupPageId}`)
    })

    return () => socket.disconnect()
  }, [userName, session?._id, mySubGroupIndex])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [generalMessages, subgroupMessages])

  const startTimer = (durationMinutes, isCountdown = false) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setElapsedTime(0)
    setTimeLeft(null)
    if (isCountdown && durationMinutes) {
      let secs = durationMinutes * 60
      setTimeLeft(secs)
      timerRef.current = setInterval(() => {
        secs -= 1
        setTimeLeft(secs)
        if (secs <= 0) {
          clearInterval(timerRef.current)
          setTimeLeft(0)
        }
      }, 1000)
    } else {
      let secs = 0
      timerRef.current = setInterval(() => {
        secs += 1
        setElapsedTime(secs)
      }, 1000)
    }
  }

  const fetchSession = async () => {
    try {
      const res = await api.get(`/sessions/${id}`)
      setSession(res.data)
      if (res.data.messages?.length > 0) {
        setGeneralMessages(res.data.messages)
      }
      const phaseDur = PHASE_INFO[res.data.currentPhase || 0]?.duration || 0
      const secs = (res.data.timeRemaining !== null && res.data.timeRemaining !== undefined && res.data.timeRemaining > 0)
        ? res.data.timeRemaining
        : phaseDur * 60
      const phase = res.data.currentPhase || 0
      if (phase === 0) {
        // Phase 1 (Briefing) — countdown only
        if (secs > 0) {
          if (timerRef.current) clearInterval(timerRef.current)
          let remaining = secs
          setTimeLeft(remaining)
          timerRef.current = setInterval(() => {
            remaining -= 1
            setTimeLeft(remaining)
            if (remaining <= 0) {
              clearInterval(timerRef.current)
              setTimeLeft(0)
            }
          }, 1000)
        }
      } else {
        // All other phases — count up
        let elapsed = 0
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
          elapsed += 1
          setElapsedTime(elapsed)
        }, 1000)
      }
    } catch (err) {
      console.error('Failed to fetch session:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (secs) => {
    if (secs === null || secs === undefined) return ''
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const addGeneralSystemMessage = (text) => {
    setGeneralMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      type: 'system',
      text,
      time: new Date().toLocaleTimeString()
    }])
  }

  const addSubgroupSystemMessage = (text) => {
    setSubgroupMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      type: 'system',
      text,
      time: new Date().toLocaleTimeString()
    }])
  }

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current) return
    const currentPhase = session?.currentPhase || 0

    const message = {
      id: Date.now(),
      type: 'user',
      text: input.trim(),
      sender: userName,
      time: new Date().toLocaleTimeString()
    }

    if (currentPhase === 1) {
      // Phase 2 — send to subgroup only
      socketRef.current.emit('send-subgroup-message', {
        groupId: id,
        subGroupIndex: mySubGroupIndex,
        message
      })
    } else {
      // All other phases — send to general chat
      socketRef.current.emit('send-message', { groupId: id, message })
    }
    setInput('')
  }
  const advanceDebriefPresenter = () => {
    if (!isAdmin) return
    const next = presentingSubgroupIndex + 1
    setPresentingSubgroupIndex(next)
    const total = session?.subGroups?.length || 0
    if (next >= total) {
      setAllDebriefDone(true)
      addGeneralSystemMessage('All subgroups have presented! Admin can now advance to Practice.')
    } else {
      const name = session?.subGroups?.[next]?.name || `Subgroup ${next + 1}`
      addGeneralSystemMessage(`🎤 ${name} is now presenting!`)
    }
    socketRef.current?.emit('debrief-next-subgroup', {
      groupId: id,
      presentingIndex: next
    })
  }

  const advancePhase = async () => {
    if (!isAdmin) return
    try {
      const nextPhase = (session.currentPhase || 0) + 1
      const res = await api.post(`/sessions/${id}/phase`, { phase: nextPhase })
      setSession(res.data)
      startTimer(PHASE_INFO[nextPhase]?.duration || 0)
      socketRef.current?.emit('phase-change', {
        groupId: id,
        phase: nextPhase,
        session: res.data
      })
    } catch (err) {
      console.error(err)
    }
  }

  const endSession = async () => {
    if (!isAdmin) return
    try {
      const groupPageId = session.group?._id || session.group
      await api.post(`/sessions/${id}/end`)
      socketRef.current?.emit('session-ended', {
        groupId: id,
        groupPageId
      })
      navigate(`/groups/${groupPageId}`)
    } catch (err) {
      console.error(err)
    }
  }

  const deleteSession = async () => {
    if (!isAdmin) return
    if (!window.confirm('Delete this session permanently? This cannot be undone.')) return
    try {
      const groupPageId = session.group?._id || session.group
      socketRef.current?.emit('session-ended', { groupId: id, groupPageId })
      await api.delete(`/sessions/${id}`)
      navigate(`/groups/${groupPageId}`)
    } catch (err) {
      console.error(err)
    }
  }

  const markSubgroupDone = async () => {
    try {
      const res = await api.post(`/sessions/${id}/subgroup/${mySubGroupIndex}/done`)
      setSubgroupDone(true)
      setFinishedEarly(true)
      socketRef.current?.emit('subgroup-done', {
        groupId: id,
        subGroupIndex: mySubGroupIndex
      })
      addSubgroupSystemMessage(res.data.allDone
        ? 'All subgroups finished! Waiting for admin to advance.'
        : 'Your subgroup is done! Review your topics while others finish.')
    } catch (err) {
      console.error(err)
    }
  }

  const signalReady = () => {
    setIAmReady(true)
    setReadyStudents(prev => prev.includes(userName) ? prev : [...prev, userName])
    socketRef.current?.emit('student-ready', { groupId: id, userName })
    addGeneralSystemMessage('You signaled ready to end ✅')
  }

  const nudgeStudent = (targetName) => {
    socketRef.current?.emit('nudge-student', { groupId: id, targetName })
    addGeneralSystemMessage(`You sent a reminder to ${targetName} 👋`)
  }

  const kickMember = async (targetName) => {
    await api.post(`/sessions/${id}/kick`, { targetName })
    socketRef.current?.emit('kick-member', { groupId: id, targetName })
    addGeneralSystemMessage(`${targetName} was removed from the session.`)
  }
  const sendDm = () => {
    if (!dmInput.trim()) return
    socketRef.current?.emit('dm-admin', { groupId: id, from: userName, message: dmInput.trim() })
    setDmInput('')
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setInput(val)
    const atIndex = val.lastIndexOf('@')
    if (atIndex !== -1) {
      const query = val.slice(atIndex + 1).toLowerCase()
      const suggestions = onlineMembers.filter(m => m !== userName && m.toLowerCase().startsWith(query))
      setMentionSuggestions(suggestions)
    } else {
      setMentionSuggestions([])
    }
  }

  const insertMention = (name) => {
    const atIndex = input.lastIndexOf('@')
    setInput(input.slice(0, atIndex) + `@${name} `)
    setMentionSuggestions([])
  }

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder
    audioChunksRef.current = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }
mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const reader = new FileReader()
      reader.onloadend = () => {
        const audioData = reader.result
        const isPrivate = (session?.currentPhase || 0) === 1
        const noteId = `${userName}-${Date.now()}`
        socketRef.current?.emit('send-voice-note', {
          groupId: id,
          audioData,
          sender: userName,
          time: new Date().toLocaleTimeString(),
          isPrivate,
          subGroupIndex: mySubGroupIndex,
          noteId
        })
        // Add own message locally — server won't echo back to sender
        const voiceMessage = {
          id: Date.now() + Math.random(),
          type: 'voice',
          audioData,
          sender: userName,
          time: new Date().toLocaleTimeString()
        }
        if (isPrivate) {
          setSubgroupMessages(prev => [...prev, voiceMessage])
        } else {
          setGeneralMessages(prev => [...prev, voiceMessage])
        }
      }
      reader.readAsDataURL(blob)
      stream.getTracks().forEach(t => t.stop())
    }

    mediaRecorder.start()
    setIsRecording(true)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  const raiseHand = () => {
    const newState = !handRaised
    setHandRaised(newState)
    socketRef.current?.emit('raise-hand', { groupId: id, userName, raised: newState })
    addGeneralSystemMessage(newState ? 'You raised your hand ✋' : 'You lowered your hand')
  }

  const submitAnswers = async () => {
    setSubmitted(true) // show loading state immediately
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/sessions/${id}/ai-evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          answers,
          flashcards: session.flashcards
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      const finalScore = data.score
      const wrong = session.flashcards
        ?.map((card, i) => ({ ...card, index: i, correct: data.results[i]?.correct, feedback: data.results[i]?.feedback }))
        .filter(c => !c.correct) || []

      setScore(finalScore)
      setWrongAnswers(wrong)

      await api.post(`/sessions/${id}/score`, {
        score: finalScore,
        wrongCount: wrong.length,
        totalCount: session.flashcards?.length
      })

      socketRef.current?.emit('score-submitted', {
        groupId: id,
        userName,
        score: finalScore
      })
    } catch (err) {
      console.error('Evaluation failed:', err)
      // Fallback: basic length check
      const total = session.flashcards?.length || 1
      let correct = 0
      const wrong = []
      session.flashcards?.forEach((card, i) => {
        if (answers[i]?.trim().length > 10) { correct++ }
        else { wrong.push({ ...card, index: i }) }
      })
      const finalScore = Math.round((correct / total) * 100)
      setScore(finalScore)
      setWrongAnswers(wrong)
    }
  }
  // ── Which messages to show ──
  const currentPhase = session?.currentPhase || 0
  const activeMessages = currentPhase === 1 ? subgroupMessages : generalMessages

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

  const phase = PHASE_INFO[currentPhase]

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <div className="border-b border-border bg-card px-3 md:px-6 py-2 md:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Button variant="ghost" size="sm" className="md:hidden flex-shrink-0 px-2" onClick={() => setSidebarOpen(o => !o)}>
            <Menu className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="flex-shrink-0 px-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Leave</span>
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm md:text-base truncate">{session.topic}</h1>
            <p className="text-xs text-muted-foreground">Ph.{currentPhase + 1}: {phase.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
          {currentPhase === 0 && timeLeft !== null && timeLeft > 0 && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono font-medium ${timeLeft < 60 ? 'bg-red-100 text-red-600' : 'bg-secondary text-foreground'}`}>
              <Clock className="w-3 h-3" />{formatTime(timeLeft)}
            </div>
          )}
          {currentPhase === 0 && timeLeft === 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
              <Clock className="w-3 h-3" />
              <span className="hidden sm:inline">Time's up</span>
              <span className="sm:hidden">⏰</span>
            </div>
          )}
          {currentPhase > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono font-medium bg-secondary text-foreground">
              <Clock className="w-3 h-3" />{formatTime(elapsedTime)}
            </div>
          )}
          <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            {onlineMembers.length || 1}
          </div>
          {isAdmin && (
            <>
              <Button
                variant="destructive" size="sm" onClick={endSession}
                className="text-xs px-2 md:px-3"
                disabled={currentPhase === 4 && readyStudents.length < onlineMembers.length - 1}
              >
                <span className="hidden sm:inline">
                  {currentPhase === 4 && readyStudents.length < onlineMembers.length - 1
                    ? `Waiting (${readyStudents.length}/${onlineMembers.length - 1})`
                    : 'End Session'}
                </span>
                <span className="sm:hidden">End</span>
              </Button>
              <Button
                variant="outline" size="sm"
                className="border-destructive text-destructive hover:bg-destructive hover:text-white text-xs px-2 md:px-3"
                onClick={deleteSession}
              >
                <span className="hidden sm:inline">Delete Session</span>
                <span className="sm:hidden">Del</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Left Sidebar ── */}
        <div className={`
          fixed md:relative top-0 left-0 h-full z-50 
          w-72 md:w-64 border-r border-border bg-card flex flex-col overflow-y-auto
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          {/* Mobile close button */}
          <div className="flex items-center justify-between px-4 pt-4 md:hidden">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session Menu</p>
            <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-secondary">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Phase flow */}
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Session Flow</p>
            <div className="space-y-1">
              {PHASE_INFO.map((p, i) => {
                const Icon = p.icon
                const isActive = i === currentPhase
                const isDone = i < currentPhase
                return (
                  <div key={p.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'}`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : isDone ? 'text-green-500' : ''}`} />
                    <span className="truncate">{p.label}</span>
                    {isDone && <CheckCircle className="w-3 h-3 text-green-500 ml-auto flex-shrink-0" />}
                    {isActive && <div className="w-2 h-2 bg-primary rounded-full ml-auto flex-shrink-0 animate-pulse" />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* My subgroup */}
          {mySubGroup && (
            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {currentPhase === 1 ? (
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3" /> My Subgroup (Private)
                  </span>
                ) : 'My Subgroup'}
              </p>
              <div className={`rounded-lg p-3 border ${phase.border} ${phase.bg}`}>
                <p className="text-xs font-semibold mb-2">{mySubGroup.name}</p>
                <div className="space-y-1 mb-3">
                  {mySubGroup.members?.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{(m.name || 'U').charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-xs">{m.name || 'Member'}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Topics:</p>
                {mySubGroup.topics?.map((t, i) => (
                  <p key={i} className="text-xs bg-white/60 rounded px-2 py-1 mb-1">{t}</p>
                ))}
              </div>
            </div>
          )}

          {/* Admin: all subgroups overview during phase 2 */}
          {isAdmin && currentPhase === 1 && (
            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Subgroup Progress</p>
              <div className="space-y-2">
                {session.subGroups?.map((sg, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${sg.isDone ? 'bg-green-50 text-green-700' : 'bg-secondary text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${sg.isDone ? 'bg-green-500' : 'bg-gray-300'}`} />
                    {sg.name}
                    {sg.isDone && <CheckCircle className="w-3 h-3 ml-auto" />}
                  </div>
                ))}
              </div>
              {allSubgroupsDone && (
                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-medium text-center">
                  All done! You can advance.
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="p-4 mt-auto">
            {isAdmin && onlineMembers.filter(m => m !== userName).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Participants</p>
                <div className="space-y-1">
                  {onlineMembers.filter(m => m !== userName).map((member, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/50">
                      <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{member.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-xs flex-1 truncate">{member}</span>
                      <button onClick={() => kickMember(member)} className="text-xs text-destructive hover:underline flex-shrink-0">
                        Kick
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isAdmin && (
              <div className="mb-4">
                <Button
                  variant="outline" size="sm" className="w-full justify-start"
                  onClick={() => { setShowDmPanel(p => !p); setDmUnread(0) }}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  DM Admin {dmUnread > 0 && <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-1.5">{dmUnread}</span>}
                </Button>
              </div>
            )}
            {isAdmin && (
              <div className="mb-4">
                <Button
                  variant="outline" size="sm" className="w-full justify-start"
                  onClick={() => { setShowDmPanel(p => !p); setDmUnread(0) }}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  DMs {dmUnread > 0 && <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-1.5">{dmUnread}</span>}
                </Button>
              </div>
            )}
            <div className="mb-4">
              <Button
                variant={showVoiceRoom ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start"
                onClick={() => setShowVoiceRoom(v => !v)}
              >
                <Phone className="w-4 h-4 mr-2" />
                {showVoiceRoom ? 'In Call 🟢' : 'Join Voice Call'}
              </Button>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Controls</p>
            <div className="space-y-2">
              <Button variant={isSpeaking ? 'default' : 'outline'} size="sm" className="w-full justify-start"
                onClick={() => { setIsSpeaking(s => !s); addGeneralSystemMessage(!isSpeaking ? 'You took the floor 🎙️' : 'You gave up the floor') }}>
                {isSpeaking ? <Mic className="w-4 h-4 mr-2" /> : <MicOff className="w-4 h-4 mr-2" />}
                {isSpeaking ? 'Speaking' : 'Take Floor'}
              </Button>
              <Button variant={handRaised ? 'default' : 'outline'} size="sm" className="w-full justify-start" onClick={raiseHand}>
                <Hand className="w-4 h-4 mr-2" />
                {handRaised ? 'Hand Raised ✋' : 'Raise Hand'}
              </Button>
              {currentPhase === 1 && mySubGroup && !subgroupDone && (
                <Button size="sm" className="w-full justify-start bg-green-600 hover:bg-green-700" onClick={markSubgroupDone}>
                  <CheckCircle className="w-4 h-4 mr-2" />Done Teaching
                </Button>
              )}
              {isAdmin && currentPhase < PHASE_INFO.length - 1 && (
                <Button size="sm" className="w-full justify-start" onClick={advancePhase}>
                  <Target className="w-4 h-4 mr-2" />Next Phase
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Phase banner */}
          <div className={`px-3 md:px-6 py-2 md:py-3 border-b ${phase.border} ${phase.bg} flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-0 justify-between`}>
            <div className="flex items-center gap-3">
              {(() => { const Icon = phase.icon; return <Icon className={`w-5 h-5 ${phase.color}`} /> })()}
              <div>
                <p className={`font-semibold text-sm ${phase.color}`}>{phase.label}</p>
                <p className="text-xs text-muted-foreground">{phase.description}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-white/60 px-2 py-1 rounded-full truncate max-w-[180px] sm:max-w-none hidden sm:block">
              {currentPhase === 0 && <>Introduce yourself — topic: <strong>{session.topic}</strong></>}
              {currentPhase === 1 && mySubGroup && <>🔒 Private room — Teach: {mySubGroup.topics?.join(', ')}</>}
              {currentPhase === 2 && <>Share your subgroup's findings with everyone</>}
              {currentPhase === 3 && !submitted && <>Answer all questions then click Submit</>}
              {currentPhase === 4 && <>Ask final questions and review your results</>}
            </div>
          </div>

          {/* ── Phase 1: Peer Teaching — subgroup isolated chat or waiting room ── */}
          {currentPhase === 1 && finishedEarly ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-xl font-bold mb-2">Great work! 🎉</h2>
                <p className="text-muted-foreground mb-6">Your subgroup finished teaching. While you wait for others, review your assigned topics below.</p>
                <div className={`rounded-xl p-4 border ${phase.border} ${phase.bg} text-left`}>
                  <p className="text-sm font-semibold mb-3">Your Topics to Review:</p>
                  {mySubGroup?.topics?.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{t}</p>
                    </div>
                  ))}
                </div>
                {allSubgroupsDone && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700 font-medium">All subgroups done! Admin is advancing to Debrief...</p>
                  </div>
                )}
              </div>
            </div>

          ) : currentPhase === 2 ? (
            /* ── AI Debrief phase ── */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Presenter banner */}
              <div className="px-6 py-3 bg-purple-50 border-b border-purple-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Mic className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    {allDebriefDone ? (
                      <p className="text-sm font-semibold text-purple-700">All subgroups presented! ✅</p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-purple-700">
                          🎤 {session.subGroups?.[presentingSubgroupIndex]?.name || `Subgroup ${presentingSubgroupIndex + 1}`} is presenting
                        </p>
                        <p className="text-xs text-purple-500">
                          Topics: {session.subGroups?.[presentingSubgroupIndex]?.topics?.join(', ')}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Subgroup dots */}
                  <div className="flex gap-1">
                    {session.subGroups?.map((_, i) => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < presentingSubgroupIndex ? 'bg-green-500' : i === presentingSubgroupIndex ? 'bg-purple-600 animate-pulse' : 'bg-gray-300'}`} />
                    ))}
                  </div>
                  {isAdmin && !allDebriefDone && (
                    <Button size="sm" className="ml-3 bg-purple-600 hover:bg-purple-700 text-white" onClick={advanceDebriefPresenter}>
                      Next Subgroup →
                    </Button>
                  )}
                  {isAdmin && allDebriefDone && (
                    <Button size="sm" className="ml-3" onClick={advancePhase}>
                      Advance to Practice →
                    </Button>
                  )}
                </div>
              </div>

              {/* Listening mode banner for non-presenters */}
              {mySubGroupIndex !== presentingSubgroupIndex && !allDebriefDone && (
                <div className="px-6 py-2 bg-yellow-50 border-b border-yellow-200 text-center">
                  <p className="text-xs text-yellow-700">
                    👂 Listening mode — raise your hand to ask a question after the presentation
                  </p>
                </div>
              )}
              {mySubGroupIndex === presentingSubgroupIndex && !allDebriefDone && (
                <div className="px-6 py-2 bg-green-50 border-b border-green-200 text-center">
                  <p className="text-xs text-green-700 font-medium">
                    🎤 It's your turn to present! Share what your subgroup learned.
                  </p>
                </div>
              )}

              {/* Chat */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {generalMessages.length === 0 && (
                  <div className="text-center py-12">
                    <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      {session.subGroups?.[0]?.name} — share what your subgroup learned about your topics!
                    </p>
                  </div>
                )}
                {generalMessages.map((msg) => (
                  <div key={msg.id || msg._id}>
                    {msg.type === 'system' && (
                      <div className="flex justify-center">
                        <span className="text-xs text-muted-foreground bg-secondary px-4 py-1.5 rounded-full">{msg.text}</span>
                      </div>
                    )}
                    {msg.type === 'voice' && (
                      <div className={`flex ${msg.sender === userName ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-md">
                          {msg.sender !== userName && (
                            <p className="text-xs font-medium text-muted-foreground mb-1 ml-1">{msg.sender}</p>
                          )}
                          <div className={`rounded-2xl px-3 py-2 ${msg.sender === userName ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary rounded-tl-sm'}`}>
                            <audio controls src={msg.audioData} className="h-8 w-48" />
                          </div>
                          <p className={`text-xs text-muted-foreground mt-1 ${msg.sender === userName ? 'text-right' : ''}`}>{msg.time}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input — only presenting subgroup or if all done */}
              <div className="border-t border-border p-3 md:p-4">
                {mySubGroupIndex === presentingSubgroupIndex || allDebriefDone ? (
                  <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 md:px-4 py-2.5 md:py-2">
                    <input
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      placeholder="Share your subgroup's findings..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      className={`p-2 rounded-lg flex-shrink-0 transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    <Button size="sm" onClick={sendMessage} disabled={!input.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                    <span className="text-sm text-yellow-700">👂 Listening — raise your hand to ask a question</span>
                    <Button size="sm" variant={handRaised ? 'default' : 'outline'} className="ml-auto" onClick={raiseHand}>
                      <Hand className="w-3.5 h-3.5 mr-1" />{handRaised ? 'Hand Raised ✋' : 'Raise Hand'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

          ) : currentPhase === 3 ? (
            /* ── Practice phase ── */
            <div className="flex-1 overflow-y-auto p-6 flex flex-col">
              {submitted ? (
                <div className="max-w-2xl mx-auto w-full py-8">
                  {/* Score circle */}
                  <div className="text-center mb-8">
                    <div className={`w-28 h-28 rounded-full flex flex-col items-center justify-center mx-auto mb-4 ${score >= 70 ? 'bg-green-100' : score >= 40 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                      <Trophy className={`w-8 h-8 mb-1 ${score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'}`} />
                      <span className={`text-2xl font-bold ${score >= 70 ? 'text-green-700' : score >= 40 ? 'text-yellow-700' : 'text-red-700'}`}>{score}%</span>
                    </div>
                    <p className="text-lg font-semibold mb-1">
                      {score >= 70 ? 'Excellent work! 🎉' : score >= 40 ? 'Good effort! Keep reviewing.' : "Keep studying — you'll get there!"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      You got {session.flashcards?.length - wrongAnswers.length} of {session.flashcards?.length} correct
                    </p>
                  </div>
                  {/* Wrong answers breakdown */}
                  {wrongAnswers.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-semibold mb-3 text-destructive">Questions to review ({wrongAnswers.length}):</p>
                      <div className="space-y-3">
                        {wrongAnswers.map((w, i) => (
                          <Card key={i} className="border-red-100">
                            <CardContent className="p-4">
                              <p className="text-sm font-medium mb-1">Q: {w.question}</p>
                              <p className="text-xs text-muted-foreground bg-secondary rounded px-2 py-1">
                                💡 Model answer: {w.answer}
                              </p>
                              {w.feedback && (
                                <p className="text-xs text-orange-600 mt-1 px-2">
                                  🤖 {w.feedback}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {wrongAnswers.length === 0 && (
                    <div className="text-center p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
                      <p className="text-green-700 font-medium">Perfect score! You answered every question! 🏆</p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground text-center">Waiting for others to finish — admin will advance to Summary.</p>
                </div>
              ) : (
                <div className="max-w-xl mx-auto w-full flex flex-col flex-1 py-6">
                  {/* Progress bar */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Question {currentCardIndex + 1} of {session.flashcards?.length}
                    </p>
                    <p className="text-xs text-muted-foreground">{Math.round(((currentCardIndex) / (session.flashcards?.length || 1)) * 100)}% done</p>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 mb-6">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${((currentCardIndex) / (session.flashcards?.length || 1)) * 100}%` }}
                    />
                  </div>
                  {/* Single flashcard */}
                  {session.flashcards?.[currentCardIndex] && (
                    <Card className="flex-1 mb-4">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-orange-600">{currentCardIndex + 1}</span>
                          </div>
                          <p className="font-medium text-base">{session.flashcards[currentCardIndex].question}</p>
                        </div>
                        <textarea
                          className="w-full border border-border rounded-xl p-4 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 min-h-[120px]"
                          placeholder="Type your answer here..."
                          value={answers[currentCardIndex] || ''}
                          onChange={(e) => setAnswers(prev => ({ ...prev, [currentCardIndex]: e.target.value }))}
                          autoFocus
                        />
                      </CardContent>
                    </Card>
                  )}
                  {/* Navigation buttons */}
                  <div className="flex gap-3">
                    {currentCardIndex > 0 && (
                      <Button variant="outline" className="flex-1" onClick={() => setCurrentCardIndex(i => i - 1)}>
                        ← Previous
                      </Button>
                    )}
                    {currentCardIndex < (session.flashcards?.length || 1) - 1 ? (
                      <Button className="flex-1" onClick={() => setCurrentCardIndex(i => i + 1)}
                        disabled={!answers[currentCardIndex]?.trim()}>
                        Next →
                      </Button>
                    ) : (
                      <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={submitAnswers}
                        disabled={!answers[currentCardIndex]?.trim()}>
                        <CheckCircle className="w-4 h-4 mr-2" /> Submit All Answers
                      </Button>
                    )}
                  </div>
                  {/* Skip hint */}
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    You must answer each question to proceed
                  </p>
                </div>
              )}
            </div>

          ) : currentPhase === 4 ? (
            /* ── Summary phase ── */
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto space-y-5">

                {/* AI Summary placeholder */}
                <AiSummaryCard sessionId={id} generalMessages={generalMessages} />

                {/* Personal performance card */}
                {score !== null && (
                  <Card className={`border-2 ${score >= 70 ? 'border-green-200 bg-green-50' : score >= 40 ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}`}>
                    <CardContent className="p-5">
                      <p className="text-sm font-semibold mb-3">Your Performance</p>
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${score >= 70 ? 'bg-green-100' : score >= 40 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                          <span className={`text-xl font-bold ${score >= 70 ? 'text-green-700' : score >= 40 ? 'text-yellow-700' : 'text-red-700'}`}>{score}%</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {score >= 70 ? '🎉 Excellent!' : score >= 40 ? '👍 Good effort' : '📚 Keep reviewing'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {session.flashcards?.length - wrongAnswers.length} correct out of {session.flashcards?.length} questions
                          </p>
                          {wrongAnswers.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Topics to revisit: {mySubGroup?.topics?.slice(0, 2).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Admin session report */}
                {isAdmin && (
                  <Card className="border-blue-100">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold">Session Report</p>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Admin Only</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-secondary rounded-lg p-3 text-center">
                          <p className="text-lg font-bold">{sessionScores.length}</p>
                          <p className="text-xs text-muted-foreground">Submitted</p>
                        </div>
                        <div className="bg-secondary rounded-lg p-3 text-center">
                          <p className="text-lg font-bold">
                            {sessionScores.length > 0
                              ? Math.round(sessionScores.reduce((a, s) => a + s.score, 0) / sessionScores.length)
                              : '—'}%
                          </p>
                          <p className="text-xs text-muted-foreground">Avg Score</p>
                        </div>
                        <div className="bg-secondary rounded-lg p-3 text-center">
                          <p className="text-lg font-bold">{onlineMembers.length}</p>
                          <p className="text-xs text-muted-foreground">Online</p>
                        </div>
                      </div>
                      {sessionScores.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Individual Results:</p>
                          {sessionScores
                            .sort((a, b) => b.score - a.score)
                            .map((s, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-primary">{s.userName?.charAt(0)?.toUpperCase()}</span>
                                </div>
                                <span className="text-xs flex-1">{s.userName}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 bg-secondary rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full ${s.score >= 70 ? 'bg-green-500' : s.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                      style={{ width: `${s.score}%` }} />
                                  </div>
                                  <span className={`text-xs font-semibold w-8 text-right ${s.score >= 70 ? 'text-green-600' : s.score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {s.score}%
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                      {sessionScores.length < onlineMembers.length && (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            Waiting for {onlineMembers.length - sessionScores.length} more to submit...
                          </p>
                        </div>
                      )}

                      {sessionScores.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Ready to end:</p>
                          {onlineMembers.filter(m => m !== userName).map((member, i) => {
                            const isReady = readyStudents.includes(member)
                            return (
                              <div key={i} className="flex items-center gap-2 mb-1.5">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isReady ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className="text-xs flex-1">{member}</span>
                                {isReady
                                  ? <span className="text-xs text-green-600 font-medium">Ready ✅</span>
                                  : <Button size="sm" variant="outline"
                                      className="h-6 text-xs px-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                                      onClick={() => nudgeStudent(member)}>
                                      Nudge 👋
                                    </Button>
                                }
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Final chat */}
                {/* Nudge banner */}
                {nudgeReceived && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-center animate-pulse">
                    <p className="text-sm text-orange-700 font-medium">👋 Admin is waiting for you — signal ready when done!</p>
                  </div>
                )}

                {/* Student ready button */}
                {!isAdmin && (
                  <div className="text-center">
                    {iAmReady ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-700 font-medium">You've signaled ready ✅</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Reviewed your results? Let the admin know you're done.</p>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={signalReady}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          I'm Ready to End ✅
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">💬 Use the chat below for final questions.</p>
              </div>
            </div>

          ) : (
            /* ── Chat phases (0, 1-subgroup, 2) ── */
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {activeMessages.length === 0 && (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      {currentPhase === 0 ? 'Introduce yourself and share what you already know about this topic.'
                        : currentPhase === 1 ? `🔒 Private subgroup chat — only your subgroup can see this. Start discussing your topics!`
                        : 'Share your findings with the whole group.'}
                    </p>
                  </div>
                )}
                {activeMessages.map((msg) => (
                  <div key={msg.id || msg._id}>
                    {msg.type === 'system' && (
                      <div className="flex justify-center">
                        <span className="text-xs text-muted-foreground bg-secondary px-4 py-1.5 rounded-full">{msg.text}</span>
                      </div>
                    )}
                    {msg.type === 'voice' && (
                      <div className={`flex ${msg.sender === userName ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-md">
                          {msg.sender !== userName && (
                            <p className="text-xs font-medium text-muted-foreground mb-1 ml-1">{msg.sender}</p>
                          )}
                          <div className={`rounded-2xl px-3 py-2 ${msg.sender === userName ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary rounded-tl-sm'}`}>
                            <audio controls src={msg.audioData} className="h-8 w-48" />
                          </div>
                          <p className={`text-xs text-muted-foreground mt-1 ${msg.sender === userName ? 'text-right' : ''}`}>{msg.time}</p>
                        </div>
                      </div>
                    )}
                    {msg.type === 'user' && (
                      <div className={`flex ${msg.sender === userName ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-md">
                          {msg.sender !== userName && (
                            <p className="text-xs font-medium text-muted-foreground mb-1 ml-1">{msg.sender}</p>
                          )}
                          <div className={`rounded-2xl px-4 py-2.5 text-sm ${msg.sender === userName ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary rounded-tl-sm'}`}>
                            {msg.text}
                          </div>
                          <p className={`text-xs text-muted-foreground mt-1 ${msg.sender === userName ? 'text-right' : ''}`}>{msg.time}</p>
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
                  {currentPhase === 1 && <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                  {currentPhase !== 1 && <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  <div className="relative flex-1">
                    {mentionSuggestions.length > 0 && (
                      <div className="absolute bottom-8 left-0 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                        {mentionSuggestions.map((name, i) => (
                          <button key={i} onClick={() => insertMention(name)}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-secondary">
                            @{name}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      placeholder={currentPhase === 1 ? 'Message your subgroup (private)...' : 'Type a message or @mention...'}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                  </div>
                  <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`p-2 rounded-lg flex-shrink-0 transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <Button size="sm" onClick={sendMessage} disabled={!input.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                {currentPhase === 1 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">🔒 Only your subgroup members can see these messages</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {/* DM Panel */}
      {showDmPanel && (
        <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-80 bg-card border border-border sm:rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">
              {isAdmin ? 'Student DMs' : 'DM to Admin'}
            </p>
            <button onClick={() => setShowDmPanel(false)}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-60">
            {dmMessages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>
            )}
            {dmMessages.map((dm, i) => (
              <div key={i} className={`flex flex-col ${dm.from === userName ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-muted-foreground mb-0.5">{dm.from}</span>
                <div className={`px-3 py-2 rounded-xl text-sm max-w-[90%] ${dm.from === userName ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                  {dm.message}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-3 flex gap-2">
            <input
              className="flex-1 text-sm bg-secondary rounded-lg px-3 py-1.5 outline-none"
              placeholder={isAdmin ? 'Reply to student...' : 'Message admin...'}
              value={dmInput}
              onChange={(e) => setDmInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendDm()}
            />
            <Button size="sm" onClick={sendDm} disabled={!dmInput.trim()}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
      {/* Voice Room — full main area overlay */}
      {showVoiceRoom && (
        <div className="fixed z-40 flex" style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="hidden md:block flex-shrink-0" style={{ width: '256px' }} />
          {/* Voice/screen area */}
          <div className={`flex flex-col bg-background transition-all duration-300 
            ${showChatOverlay ? 'hidden md:flex md:w-[60%]' : 'w-full'} p-4`}>
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button className="md:hidden p-1 rounded-lg hover:bg-secondary mr-2" onClick={() => setSidebarOpen(true)}>
                  <Menu className="w-4 h-4" />
                </button>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-sm font-semibold">Live Call</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowVoiceRoom(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <VoiceRoom
                sessionId={id}
                roomId={currentPhase === 1 && mySubGroupIndex !== null
                  ? `${id}-subgroup-${mySubGroupIndex}`
                  : id}
                onLeave={() => setShowVoiceRoom(false)}
                onToggleChat={() => setShowChatOverlay(c => !c)}
                showChat={showChatOverlay}
              />
            </div>
          </div>

          {/* Slide-in chat panel */}
          {showChatOverlay && (
            <div className="w-full md:w-[40%] flex flex-col bg-card border-l border-border">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold">Chat</p>
                <button onClick={() => setShowChatOverlay(false)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeMessages.map((msg) => (
                  <div key={msg.id || msg._id}>
                    {msg.type === 'system' && (
                      <div className="flex justify-center">
                        <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">{msg.text}</span>
                      </div>
                    )}
                    {msg.type === 'user' && (
                      <div className={`flex ${msg.sender === userName ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[85%]">
                          {msg.sender !== userName && (
                            <p className="text-xs font-medium text-muted-foreground mb-1 ml-1">{msg.sender}</p>
                          )}
                          <div className={`rounded-2xl px-3 py-2 text-sm ${msg.sender === userName ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-3">
                <div className="flex gap-2">
                  <input
                    className="flex-1 text-sm bg-secondary rounded-lg px-3 py-2 outline-none"
                    placeholder="Type a message..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  />
                  <Button size="sm" onClick={sendMessage} disabled={!input.trim()}>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
function AiSummaryCard({ sessionId, generalMessages }) {
  const [aiData, setAiData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(false)

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const chatMessages = generalMessages
        .filter(m => m.type === 'user')
        .map(m => ({ sender: m.sender, text: m.text }))

      const res = await fetch(`http://localhost:5000/api/sessions/${sessionId}/ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ chatMessages })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setAiData(data)
      setGenerated(true)
    } catch (err) {
      setError(err.message || 'Failed to generate summary')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">AI Session Summary</p>
              <p className="text-xs text-muted-foreground">Powered by Claude</p>
            </div>
          </div>
          {!generated && (
            <Button size="sm" onClick={generate} disabled={loading}>
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating...</>
                : <><Brain className="w-3.5 h-3.5 mr-1.5" />Generate</>}
            </Button>
          )}
        </div>

        {error && <p className="text-xs text-destructive mb-2">{error}</p>}

        {!aiData && !loading && (
          <p className="text-sm text-muted-foreground">Click Generate to get an AI-powered summary of this session including highlights, subgroup breakdown, and recommendations.</p>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analysing your session...</p>
          </div>
        )}

        {aiData && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
              <p className="text-sm leading-relaxed">{aiData.summary}</p>
            </div>
            {aiData.highlights?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Key Highlights</p>
                <ul className="space-y-1">
                  {aiData.highlights.map((h, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>{h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiData.subgroupBreakdown?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Subgroup Breakdown</p>
                <div className="space-y-2">
                  {aiData.subgroupBreakdown.map((sg, i) => (
                    <div key={i} className="bg-white/60 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold">{sg.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          sg.performance === 'good' ? 'bg-green-100 text-green-700' :
                          sg.performance === 'average' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'}`}>
                          {sg.performance}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{sg.covered}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiData.recommendations && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">What to Review Next</p>
                <p className="text-xs text-blue-700">{aiData.recommendations}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}