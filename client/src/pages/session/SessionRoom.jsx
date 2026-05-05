import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { io } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft, Send, Hand, Mic, MicOff,
  Brain, Users, BookOpen, CheckCircle,
  MessageSquare, Target
} from 'lucide-react'

const SESSION_PHASES = [
  { id: 'intro', label: 'Introduction', icon: BookOpen, color: 'text-blue-500' },
  { id: 'explain', label: 'Peer Explanation', icon: Users, color: 'text-green-500' },
  { id: 'ai', label: 'AI Clarification', icon: Brain, color: 'text-purple-500' },
  { id: 'quiz', label: 'Practice', icon: Target, color: 'text-orange-500' },
  { id: 'summary', label: 'Summary', icon: CheckCircle, color: 'text-teal-500' },
]

const SOCKET_URL = 'http://localhost:5000'

export default function SessionRoom() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [currentPhase, setCurrentPhase] = useState(0)
  const [handRaised, setHandRaised] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [topic, setTopic] = useState('')
  const [sessionStarted, setSessionStarted] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [onlineMembers, setOnlineMembers] = useState([])
  const [userName, setUserName] = useState('')
  const messagesEndRef = useRef(null)
  const socketRef = useRef(null)

  useEffect(() => {
    fetchGroup()
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!userName) return

    const socket = io(SOCKET_URL)
    socketRef.current = socket

    socket.emit('join-session', { groupId: id, userName })

    socket.on('user-joined', ({ userName: who, members }) => {
      setOnlineMembers(members)
      if (who !== userName) {
        addSystemMessage(`${who} joined the session`)
      }
    })

    socket.on('user-left', ({ userName: who, members }) => {
      setOnlineMembers(members)
      addSystemMessage(`${who} left the session`)
    })

    socket.on('receive-message', (message) => {
      setMessages(prev => [...prev, message])
    })

    socket.on('phase-changed', (phase) => {
      setCurrentPhase(phase)
      const p = SESSION_PHASES[phase]
      addSystemMessage(`Phase changed to: ${p.label}`)
    })

    socket.on('hand-raised', ({ userName: who, raised }) => {
      if (who !== userName) {
        addSystemMessage(raised ? `${who} raised their hand ✋` : `${who} lowered their hand`)
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [userName, id])

  const fetchGroup = async () => {
    try {
      const res = await api.get(`/groups/${id}`)
      setGroup(res.data)
      const token = localStorage.getItem('token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const member = res.data.members.find(m => m._id === payload.id)
        setUserName(member?.name || payload.email || 'Student')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const addSystemMessage = (text) => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      type: 'system',
      text,
      time: new Date().toLocaleTimeString()
    }])
  }

  const startSession = () => {
    if (!topic.trim()) return
    setSessionStarted(true)

    const sysMsg = {
      id: Date.now(),
      type: 'system',
      text: `Study session started on: "${topic}"`,
      time: new Date().toLocaleTimeString()
    }
    const introMsg = {
      id: Date.now() + 1,
      type: 'system',
      text: `Phase 1: Introduction — Each member should briefly share what they already know about "${topic}".`,
      time: new Date().toLocaleTimeString()
    }
    setMessages([sysMsg, introMsg])
  }

  const sendMessage = async () => {
    if (!input.trim() || !socketRef.current) return
    const text = input.trim()
    setInput('')

    const message = {
      id: Date.now(),
      type: 'user',
      text,
      sender: userName,
      time: new Date().toLocaleTimeString()
    }

    socketRef.current.emit('send-message', { groupId: id, message })

    if (text.toLowerCase().startsWith('/ai ')) {
      setAiThinking(true)
      setTimeout(() => {
        const aiMsg = {
          id: Date.now(),
          type: 'ai',
          text: `I'll help with that. You asked: "${text.replace('/ai ', '')}". Connect your AI service with an OpenAI key to get real answers from your uploaded documents.`,
          time: new Date().toLocaleTimeString()
        }
        socketRef.current.emit('send-message', { groupId: id, message: aiMsg })
        setAiThinking(false)
      }, 1500)
    }
  }

  const nextPhase = () => {
    if (currentPhase < SESSION_PHASES.length - 1) {
      const next = currentPhase + 1
      socketRef.current.emit('phase-change', { groupId: id, phase: next })
      setCurrentPhase(next)

      const phase = SESSION_PHASES[next]
      let phaseMsg = ''
      if (phase.id === 'explain') phaseMsg = 'Peer Explanation — Take turns explaining key concepts. Use /ai [question] to ask the AI.'
      else if (phase.id === 'ai') phaseMsg = 'AI Clarification — Type your questions and the AI will address gaps.'
      else if (phase.id === 'quiz') phaseMsg = 'Practice Phase — Answer these questions to test your understanding.'
      else if (phase.id === 'summary') phaseMsg = 'Summary — Great work! Review your flashcards after this session.'

      const sysMsg = {
        id: Date.now(),
        type: 'system',
        text: `Moving to Phase ${next + 1}: ${phase.label}. ${phaseMsg}`,
        time: new Date().toLocaleTimeString()
      }
      socketRef.current.emit('send-message', { groupId: id, message: sysMsg })
    }
  }

  const raiseHand = () => {
    const newState = !handRaised
    setHandRaised(newState)
    socketRef.current?.emit('raise-hand', { groupId: id, userName, raised: newState })
    addSystemMessage(newState ? 'You raised your hand ✋' : 'You lowered your hand')
  }

  const toggleSpeak = () => {
    setIsSpeaking(!isSpeaking)
    addSystemMessage(!isSpeaking ? 'You are now the active speaker 🎙️' : 'You stopped speaking')
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/groups/${id}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Leave Session
          </Button>
          <div>
            <h1 className="font-semibold">{group.name}</h1>
            <p className="text-xs text-muted-foreground">
              {sessionStarted ? `Topic: ${topic}` : 'Set a topic to begin'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {onlineMembers.length || 1} online
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Session Flow
            </h3>
            <div className="space-y-1">
              {SESSION_PHASES.map((phase, i) => {
                const Icon = phase.icon
                const isActive = i === currentPhase
                const isDone = i < currentPhase
                return (
                  <div key={phase.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                  }`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : isDone ? 'text-green-500' : ''}`} />
                    <span>{phase.label}</span>
                    {isDone && <CheckCircle className="w-3 h-3 text-green-500 ml-auto" />}
                    {isActive && <div className="w-2 h-2 bg-primary rounded-full ml-auto animate-pulse" />}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Members
            </h3>
            <div className="space-y-2">
              {group.members.map((member, i) => {
                const isOnline = onlineMembers.includes(member.name)
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">
                        {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                      </span>
                    </div>
                    <span className="text-sm">{member.name || 'Member'}</span>
                    <div className={`w-2 h-2 rounded-full ml-auto ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="p-4 mt-auto">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Controls
            </h3>
            <div className="space-y-2">
              <Button variant={isSpeaking ? 'default' : 'outline'} size="sm" className="w-full justify-start" onClick={toggleSpeak}>
                {isSpeaking ? <Mic className="w-4 h-4 mr-2" /> : <MicOff className="w-4 h-4 mr-2" />}
                {isSpeaking ? 'Speaking' : 'Take the Floor'}
              </Button>
              <Button variant={handRaised ? 'default' : 'outline'} size="sm" className="w-full justify-start" onClick={raiseHand}>
                <Hand className="w-4 h-4 mr-2" />
                {handRaised ? 'Hand Raised ✋' : 'Raise Hand'}
              </Button>
              {sessionStarted && currentPhase < SESSION_PHASES.length - 1 && (
                <Button size="sm" className="w-full justify-start" onClick={nextPhase}>
                  <Target className="w-4 h-4 mr-2" />
                  Next Phase
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {!sessionStarted ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    Start Study Session
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter the topic you want to study today. The AI will facilitate
                    your session through structured phases.
                  </p>
                  <Input
                    placeholder="e.g. Data Structures - Binary Trees"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && startSession()}
                  />
                  <Button className="w-full" onClick={startSession} disabled={!topic.trim()}>
                    Begin Session
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                            <p className="text-xs font-medium text-muted-foreground mb-1 ml-1">{msg.sender}</p>
                          )}
                          <div className={`rounded-2xl px-4 py-2.5 ${
                            msg.sender === userName
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-secondary text-foreground rounded-tl-sm'
                          }`}>
                            <p className="text-sm">{msg.text}</p>
                          </div>
                          <p className={`text-xs text-muted-foreground mt-1 ${msg.sender === userName ? 'text-right' : ''}`}>
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
                {aiThinking && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Brain className="w-4 h-4 text-purple-600 animate-pulse" />
                    </div>
                    <div className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-border p-4">
                <div className="flex items-center gap-2 bg-secondary rounded-xl px-4 py-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Type a message or /ai [question] to ask the AI..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button size="sm" onClick={sendMessage} disabled={!input.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Use <span className="font-mono bg-secondary px-1 rounded">/ai [question]</span> to ask the AI facilitator
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}