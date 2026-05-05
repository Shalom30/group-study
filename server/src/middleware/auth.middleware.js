const jwt = require('jsonwebtoken')

const authMiddleware = (req, res, next) => {
  try {
    console.log('Auth middleware called for:', req.method, req.path)
    const authHeader = req.headers.authorization

    if (!authHeader) {
      console.log('No authorization header')
      return res.status(401).json({ message: 'No token, access denied' })
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      console.log('No token in header')
      return res.status(401).json({ message: 'No token, access denied' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    console.log('Auth successful for user:', decoded.email)

    next()
  } catch (error) {
    console.log('Auth error:', error.message)
    return res.status(401).json({ message: 'Invalid token' })
  }
}

module.exports = authMiddleware
