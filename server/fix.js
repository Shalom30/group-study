const fs = require('fs')

fs.writeFileSync('./src/routes/auth.routes.js', [
  "const express = require('express')",
  "const router = express.Router()",
  "const { register, login } = require('../controllers/auth.controller')",
  "",
  "router.post('/register', register)",
  "router.post('/login', login)",
  "",
  "module.exports = router"
].join('\n'))

console.log('auth.routes.js fixed')
