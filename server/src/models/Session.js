const mongoose = require('mongoose')

const subGroupSchema = new mongoose.Schema({
  name: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  topics: [String],
  leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDone: { type: Boolean, default: false }
})

const flashcardSchema = new mongoose.Schema({
  question: String,
  answer: String
})

const sessionSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic: { type: String, required: true },
  documentText: { type: String, default: '' },
  documentName: { type: String, default: '' },
  topics: [String],
  subGroups: [subGroupSchema],
  flashcards: [flashcardSchema],
  currentPhase: { type: Number, default: 0 },
  status: { type: String, enum: ['waiting', 'active', 'ended'], default: 'waiting' },
  timer: { type: Number, default: 0 },
  phaseStartedAt: { type: Date },
  messages: [{
        id: String,
        type: { type: String, enum: ['user', 'system', 'ai'], default: 'user' },
        text: String,
        sender: String,
        time: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true })

module.exports = mongoose.model('Session', sessionSchema)