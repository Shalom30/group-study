const express = require('express')
const router = express.Router()
const multer = require('multer')
const authMiddleware = require('../middleware/auth.middleware')
const Session = require('../models/Session')
const Group = require('../models/Group')

const storage = multer.memoryStorage()
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })
const Anthropic = require('@anthropic-ai/sdk')
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// CREATE SESSION
router.post('/create', authMiddleware, upload.array('documents', 10), async (req, res) => {
  try {
    const { groupId, topic } = req.body

    const group = await Group.findById(groupId).populate('members', 'name email')
    if (!group) return res.status(404).json({ message: 'Group not found' })

    // ── Member limit ────────────────────────────────────────────────
    if (group.members.length > 21)
      return res.status(400).json({ message: 'Session cannot exceed 21 members. Please split into smaller groups.' })

    // ── Parse + AI generate from documents ─────────────────────────
    let aiTopics = null
    let aiFlashcards = null
    let documentText = ''

    if (req.files && req.files.length > 0) {
      const file = req.files[0] // use first uploaded doc
      try {
        const base64 = file.buffer.toString('base64')
        const aiMsg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 }
              },
              {
                type: 'text',
                text: `You are a study assistant. The session topic is "${topic}".
Analyze this document and return ONLY valid JSON in this exact format, nothing else:
{
  "topics": [
    "specific topic title from the document",
    "another specific topic title",
    "another specific topic title",
    "another specific topic title",
    "another specific topic title",
    "another specific topic title"
  ],
  "flashcards": [
    { "question": "specific question from document content", "answer": "correct answer from document" },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ]
}
Generate exactly 6 specific topics and exactly 10 specific questions with correct answers, all based on the actual document content.`
              }
            ]
          }]
        })
        const raw = aiMsg.content[0].text
        const clean = raw.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)
        aiTopics = parsed.topics
        aiFlashcards = parsed.flashcards
      } catch (e) {
        console.error('AI generation failed, using placeholders:', e.message)
      }
    }

    // Fallback to placeholders if AI failed or no doc uploaded
    const finalTopics = aiTopics || [
      `${topic} - Core Concepts`,
      `${topic} - Key Principles`,
      `${topic} - Practical Applications`,
      `${topic} - Common Problems`,
      `${topic} - Advanced Topics`,
      `${topic} - Summary Points`
    ]

    const finalFlashcards = aiFlashcards || [
      { question: `What is the main concept of ${topic}?`, answer: 'Upload a document to get AI-generated answers.' },
      { question: `Give a real-world example of ${topic}.`, answer: 'Upload a document to get AI-generated answers.' },
      { question: `What are the key principles of ${topic}?`, answer: 'Upload a document to get AI-generated answers.' },
      { question: `How is ${topic} applied in practice?`, answer: 'Upload a document to get AI-generated answers.' },
      { question: `What are common mistakes when studying ${topic}?`, answer: 'Upload a document to get AI-generated answers.' },
      { question: `Define the core terminology of ${topic}.`, answer: 'Upload a document to get AI-generated answers.' },
      { question: `What are the main challenges in ${topic}?`, answer: 'Upload a document to get AI-generated answers.' },
      { question: `How does ${topic} relate to other subjects?`, answer: 'Upload a document to get AI-generated answers.' },
      { question: `What methods are used in ${topic}?`, answer: 'Upload a document to get AI-generated answers.' },
      { question: `Summarize the most important points of ${topic}.`, answer: 'Upload a document to get AI-generated answers.' }
    ]

    // ── Build subgroups ─────────────────────────────────────────────
    const members = group.members
    const subGroups = []
    const subGroupSize = 3
    for (let i = 0; i < members.length; i += subGroupSize) {
      const chunk = members.slice(i, i + subGroupSize)
      subGroups.push({
        name: `Group ${subGroups.length + 1}`,
        members: chunk.map(m => m._id),
        leaderId: chunk[0]._id,
        topics: [],
        isDone: false
      })
    }

    const topicsPerGroup = Math.ceil(finalTopics.length / subGroups.length)
    subGroups.forEach((sg, i) => {
      sg.topics = finalTopics.slice(i * topicsPerGroup, (i + 1) * topicsPerGroup)
    })

    const session = new Session({
      group: groupId,
      createdBy: req.user.id,
      topic,
      topics: finalTopics,
      subGroups,
      flashcards: finalFlashcards,
      currentPhase: 0,
      status: 'waiting',
      phaseStartedAt: new Date()
    })

    await session.save()
    res.json(session)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ⚠️ MUST BE BEFORE /:sessionId
// GET ACTIVE SESSION FOR A GROUP
router.get('/group/:groupId/active', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findOne({
      group: req.params.groupId,
      status: { $in: ['waiting', 'active'] }
    })
      .populate('subGroups.members', 'name email')
      .populate('subGroups.leaderId', 'name email')
    res.json(session)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET SESSION BY ID
router.get('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
      .populate('group')
      .populate('createdBy', 'name email')
      .populate('subGroups.members', 'name email')
      .populate('subGroups.leaderId', 'name email')
    if (!session) return res.status(404).json({ message: 'Session not found' })

    const phaseDurations = [10, 20, 10, 15, 0]
    const phaseDuration = phaseDurations[session.currentPhase] * 60
    let timeRemaining = null
    if (session.phaseStartedAt && phaseDuration > 0) {
      const elapsed = Math.floor((Date.now() - new Date(session.phaseStartedAt).getTime()) / 1000)
      timeRemaining = Math.max(0, phaseDuration - elapsed)
    }

    res.json({ ...session.toObject(), timeRemaining })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ADVANCE PHASE
router.post('/:sessionId/phase', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ message: 'Session not found' })
    if (session.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the session creator can advance the phase' })
    }
    session.currentPhase = req.body.phase
    session.status = 'active'
    session.phaseStartedAt = new Date()
    await session.save()
    const populated = await Session.findById(session._id)
      .populate('group')
      .populate('createdBy', 'name email')
      .populate('subGroups.members', 'name email')
      .populate('subGroups.leaderId', 'name email')
    res.json(populated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// END SESSION
router.post('/:sessionId/end', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ message: 'Session not found' })
    if (session.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the session creator can end the session' })
    }
    session.status = 'ended'
    await session.save()
    res.json({ message: 'Session ended' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE SESSION
router.delete('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ message: 'Session not found' })
    if (session.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the session creator can delete this session' })
    }
    await Session.findByIdAndDelete(req.params.sessionId)
    res.json({ message: 'Session deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// MARK SUBGROUP AS DONE
router.post('/:sessionId/subgroup/:subGroupIndex/done', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ message: 'Session not found' })
    session.subGroups[req.params.subGroupIndex].isDone = true
    await session.save()
    const allDone = session.subGroups.every(sg => sg.isDone)
    res.json({ message: 'Subgroup marked done', allDone })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// SAVE STUDENT SCORE
router.post('/:sessionId/score', authMiddleware, async (req, res) => {
  try {
    const { score, wrongCount, totalCount } = req.body
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ message: 'Session not found' })
    session.scores = session.scores.filter(s => s.userId.toString() !== req.user.id)
    session.scores.push({
      userId: req.user.id,
      userName: req.user.name,
      score,
      wrongCount,
      totalCount
    })
    await session.save()
    res.json({ message: 'Score saved' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET PAST SESSIONS FOR A GROUP
router.get('/group/:groupId/history', authMiddleware, async (req, res) => {
  try {
    const sessions = await Session.find({
      group: req.params.groupId,
      status: 'ended'
    })
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 })
    res.json(sessions)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})


// KICK MEMBER
router.post('/:sessionId/kick', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ message: 'Session not found' })
    if (session.createdBy.toString() !== req.user.id)
      return res.status(403).json({ message: 'Only the session creator can kick members' })
    res.json({ message: 'Kick signal sent' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// LIVEKIT TOKEN
router.get('/:sessionId/livekit-token', authMiddleware, async (req, res) => {
  try {
    const { AccessToken } = require('livekit-server-sdk')
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ message: 'Session not found' })

    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity: req.user.name || req.user.id }
    )
    const roomId = req.query.roomId || req.params.sessionId
    token.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishScreen: true
    })

    res.json({ token: await token.toJwt(), url: process.env.LIVEKIT_URL })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET SAVED DOCUMENTS FOR USER
router.get('/ai/documents', authMiddleware, async (req, res) => {
  try {
    const Document = require('../models/Document')
    const docs = await Document.find({ userId: req.user.id }).sort({ createdAt: -1 })
    res.json(docs)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// AI - DOCUMENT SUMMARY + FLASHCARDS
router.post('/ai/document', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

    const base64 = req.file.buffer.toString('base64')

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64
            }
          },
          {
            type: 'text',
            text: `You are a study assistant. Given the document above, do two things:
1. Write a clear, concise summary (150-200 words) of the key concepts.
2. Generate exactly 8 flashcards as a JSON array with "question" and "answer" fields.

Respond ONLY in this JSON format, nothing else:
{
  "summary": "...",
  "flashcards": [
    { "question": "...", "answer": "..." }
  ]
}`
          }
        ]
      }]
    })

    const raw = message.content[0].text
    const clean = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    const Document = require('../models/Document')
    const doc = await Document.create({
      userId: req.user.id,
      fileName: req.file.originalname,
      summary: result.summary,
      flashcards: result.flashcards
    })

    res.json({ ...result, _id: doc._id, fileName: doc.fileName, createdAt: doc.createdAt })
  } catch (err) {
    console.error('AI document error:', err)
    res.status(500).json({ message: 'AI processing failed. ' + err.message })
  }
})

// AI - EVALUATE QUIZ ANSWERS
router.post('/:sessionId/ai-evaluate', authMiddleware, async (req, res) => {
  try {
    const { answers, flashcards } = req.body
    // answers: { "0": "student answer", "1": "..." }
    // flashcards: [{ question, answer }]

    const pairs = flashcards.map((card, i) => ({
      question: card.question,
      correctAnswer: card.answer,
      studentAnswer: answers[i] || ''
    }))

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are a quiz evaluator. Evaluate each student answer against the correct answer.
Be fair — award credit for answers that demonstrate understanding even if not word-for-word.

Return ONLY valid JSON, nothing else:
{
  "results": [
    { "index": 0, "correct": true, "feedback": "brief feedback" },
    { "index": 1, "correct": false, "feedback": "brief feedback" }
  ],
  "score": 70
}

score = percentage of correct answers (0-100).

Questions to evaluate:
${JSON.stringify(pairs, null, 2)}`
      }]
    })

    const raw = message.content[0].text
    const clean = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    res.json(result)
  } catch (err) {
    console.error('AI evaluate error:', err)
    res.status(500).json({ message: 'AI evaluation failed: ' + err.message })
  }
})

// AI SESSION SUMMARY
router.post('/:sessionId/ai-summary', authMiddleware, async (req, res) => {
  try {
    const { chatMessages } = req.body
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ message: 'Session not found' })

    const chatText = chatMessages?.length > 0
      ? chatMessages.map(m => `${m.sender}: ${m.text}`).join('\n')
      : 'No chat messages recorded in this session.'

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are an educational AI. Analyze this study session and return ONLY valid JSON, nothing else:
{
  "summary": "2-3 sentence overview of what was covered",
  "highlights": ["key point 1", "key point 2", "key point 3"],
  "subgroupBreakdown": [
    { "name": "Group 1", "covered": "what they discussed", "performance": "good" }
  ],
  "recommendations": "what students should review next"
}

Session topic: ${session.topic}
Subgroups: ${session.subGroups?.map(sg => `${sg.name}: topics - ${sg.topics?.join(', ')}`).join(' | ')}
Chat transcript:
${chatText.slice(0, 4000)}`
      }]
    })

    const raw = message.content[0].text
    const clean = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    res.json(result)
  } catch (err) {
    console.error('AI summary error:', err)
    res.status(500).json({ message: 'AI summary failed: ' + err.message })
  }
})

module.exports = router