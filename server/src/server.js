const express = require('express')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const connectDB = require('./config/db')
require('dotenv').config()

const sessionRoutes = require('./routes/sessionRoutes.js')
const authRoutes = require('./routes/auth.routes.js')
const protectedRoutes = require('./routes/protectedRoutes.js')
const groupRoutes = require('./routes/groupRoutes.js')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
})

app.use(cors())
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

  socket.on('join-session', ({ groupId, userName }) => {
    socket.join(groupId)
    socket.data.userName = userName
    socket.data.groupId = groupId

    if (!sessions[groupId]) sessions[groupId] = []
    sessions[groupId] = sessions[groupId].filter(u => u !== userName)
    sessions[groupId].push(userName)

    io.to(groupId).emit('user-joined', {
      userName,
      members: sessions[groupId]
    })

    console.log(`${userName} joined session ${groupId}`)
  })

  socket.on('send-message', ({ groupId, message }) => {
    io.to(groupId).emit('receive-message', message)
  })

  socket.on('phase-change', ({ groupId, phase }) => {
    io.to(groupId).emit('phase-changed', phase)
  })

  socket.on('raise-hand', ({ groupId, userName, raised }) => {
    io.to(groupId).emit('hand-raised', { userName, raised })
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