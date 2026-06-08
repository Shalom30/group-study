const mongoose = require('mongoose')
console.log('Group model initialized ✅')

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  coAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  coAdminRequests: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true })

module.exports = mongoose.model('Group', groupSchema)