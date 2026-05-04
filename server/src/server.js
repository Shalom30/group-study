const express = require('express')
const cors = require('cors')
const connectDB = require('./config/db')
require('dotenv').config()

const authRoutes = require('./routes/auth.routes.js')
const protectedRoutes = require('./routes/protectedRoutes.js')
const groupRoutes = require('./routes/groupRoutes.js')

const app = express()

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

// Test route
app.post('/api/test', (req, res) => {
  res.json({ message: 'Test route works', body: req.body })
})

console.log('Mounting auth routes...')
app.use('/api/auth', authRoutes)
console.log('Auth routes mounted')

console.log('Mounting protected routes...')
app.use('/api/protected', protectedRoutes)
console.log('Protected routes mounted')

console.log('Mounting group routes...')
app.use('/api/groups', groupRoutes)
console.log('Group routes mounted')

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log('Server running on port', PORT)
  console.log('Registered routes:')
  const routerStack = app._router?.stack || []
  routerStack
    .filter((layer) => layer.route)
    .forEach((layer) => {
      const methods = Object.keys(layer.route.methods).join(', ').toUpperCase()
      console.log(`${methods} ${layer.route.path}`)
    })
})
