const express = require('express')
const router = express.Router()
const authMiddleware = require('../middleware/auth.middleware')

router.get('/dashboard', authMiddleware, (req, res) => {
  res.json({
    message: 'Welcome to your dashboard ??',
    user: req.user
  })
})

module.exports = router
