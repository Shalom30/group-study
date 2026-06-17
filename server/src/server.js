const express = require('express')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const connectDB = require('./config/db')
const Session = require('./models/Session')
require('dotenv').config()

const sessionRoutes = require('./routes/sessionRoutes.js')
const authRoutes = require('./routes/auth.routes.js')
const protectedRoutes = require('./routes/protectedRoutes.js')
const groupRoutes = require('./routes/groupRoutes.js')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
})

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json())

app.use((req, res, next) => {
  console.log('Incoming request:', req.method, req.path)
  next()
})

connectDB()

app.get('/', (req, res) => {
  res.send('NoteLearn API Running')
})

app.use('/api/auth', authRoutes)
app.use('/api/protected', protectedRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/sessions', sessionRoutes)

const sessions = {}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('join-session', ({ groupId, userName, subGroupIndex }) => {
    // Always join the main group room
    socket.join(groupId)
    // Also join their personal subgroup room
    if (subGroupIndex !== undefined && subGroupIndex !== null) {
      socket.join(`${groupId}_sub_${subGroupIndex}`)
    }

    socket.data.userName = userName
    socket.data.groupId = groupId
    socket.data.subGroupIndex = subGroupIndex

    if (!sessions[groupId]) sessions[groupId] = []
    sessions[groupId] = sessions[groupId].filter(u => u !== userName)
    sessions[groupId].push(userName)

    io.to(groupId).emit('user-joined', {
      userName,
      members: sessions[groupId]
    })

    console.log(`${userName} joined session ${groupId} (subgroup ${subGroupIndex})`)
  })

  // GENERAL message (phases 0, 2, 3, 4)
  socket.on('send-message', async ({ groupId, message }) => {
    try {
      await Session.findOneAndUpdate(
        { group: groupId, status: { $in: ['waiting', 'active'] } },
        { $push: { messages: message } }
      )
    } catch (e) { console.error(e) }
    io.to(groupId).emit('receive-message', message)
  })

  // SUBGROUP message (phase 1 - peer teaching) - only goes to subgroup room
  socket.on('send-subgroup-message', async ({ groupId, subGroupIndex, message }) => {
    try {
      await Session.findOneAndUpdate(
        { group: groupId, status: { $in: ['waiting', 'active'] } },
        { $push: { [`subGroups.${subGroupIndex}.messages`]: message } }
      )
    } catch (e) { console.error(e) }
    // Only emit to members of this subgroup
    io.to(`${groupId}_sub_${subGroupIndex}`).emit('receive-subgroup-message', message)
  })

  socket.on('phase-change', ({ groupId, phase, session }) => {
    io.to(groupId).emit('phase-changed', { phase, session })
  })

  socket.on('raise-hand', ({ groupId, userName, raised }) => {
    io.to(groupId).emit('hand-raised', { userName, raised })
  })

  // Subgroup done teaching
  socket.on('subgroup-done', async ({ groupId, subGroupIndex }) => {
    // Notify everyone in main room
    io.to(groupId).emit('subgroup-finished', { subGroupIndex })

    // Check if ALL subgroups are done
    try {
      const session = await Session.findOne({
        group: groupId,
        status: { $in: ['waiting', 'active'] }
      })
      if (session) {
        const allDone = session.subGroups.every(sg => sg.isDone)
        if (allDone) {
          io.to(groupId).emit('all-subgroups-done')
        }
      }
    } catch (e) { console.error(e) }
  })

  socket.on('student-ready', ({ groupId, userName }) => {
    io.to(groupId).emit('student-ready', { userName })
  })

  socket.on('nudge-student', ({ groupId, targetName }) => {
    io.to(groupId).emit('nudge-received', { targetName })
  })  

  socket.on('kick-member', ({ groupId, targetName }) => {
    io.to(groupId).emit('kicked-target', { targetName })
  })

  socket.on('dm-admin', ({ groupId, from, message }) => {
    io.to(groupId).emit('dm-received', { from, message, time: new Date().toLocaleTimeString() })
  })

  socket.on('send-voice-note', ({ groupId, audioData, sender, time, subGroupIndex, isPrivate, noteId }) => {
    if (isPrivate && subGroupIndex !== undefined && subGroupIndex !== null) {
      socket.to(`${groupId}_sub_${subGroupIndex}`).emit('receive-voice-note', { audioData, sender, time, noteId })
    } else {
      socket.to(groupId).emit('receive-voice-note', { audioData, sender, time, noteId })
    }
  })
  
  socket.on('score-submitted', ({ groupId, userName, score }) => {
    io.to(groupId).emit('score-submitted', { userName, score })
  })
// Phase 3 — admin moves to next presenting subgroup
  socket.on('debrief-next-subgroup', ({ groupId, presentingIndex }) => {
    io.to(groupId).emit('debrief-presenter-changed', { presentingIndex })
  })
  // Admin ends session - redirect everyone
  socket.on('session-ended', ({ groupId, groupPageId }) => {
    io.to(groupId).emit('session-ended', { groupPageId })
  })

  socket.on('disconnect', () => {
    const { userName, groupId } = socket.data
    if (groupId && sessions[groupId]) {
      sessions[groupId] = sessions[groupId].filter(u => u !== userName)
      io.to(groupId).emit('user-left', {
        userName,
        members: sessions[groupId]
      })
    }
    console.log('User disconnected:', socket.id)
  })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log('Server running on port', PORT)
})