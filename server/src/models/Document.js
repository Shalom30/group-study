const mongoose = require('mongoose')

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true },
  summary: { type: String, required: true },
  flashcards: [{ question: String, answer: String }],
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Document', documentSchema)