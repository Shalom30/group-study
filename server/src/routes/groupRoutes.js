const express = require('express')
const router = express.Router()
const authMiddleware = require('../middleware/auth.middleware')
const Group = require('../models/Group')
const Invitation = require('../models/Invitation')
const { sendInvitationEmail } = require('../utils/email')
const User = require('../models/User')

router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body
    const group = new Group({ name, description, admin: req.user.id, members: [req.user.id] })
    await group.save()
    res.json(group)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/invite', authMiddleware, async (req, res) => {
  try {
    const { email, groupId } = req.body

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' })
    }

    const group = await Group.findById(groupId).populate('admin', 'name email')
    if (!group) return res.status(404).json({ message: 'Group not found' })

    // Check if already a member
    const existingUser = await User.findOne({ email })
    if (existingUser && group.members.includes(existingUser._id)) {
      return res.status(400).json({ message: 'This person is already a member of the group' })
    }

    const existingInvite = await Invitation.findOne({ email, group: groupId, status: 'pending' })
    if (existingInvite) return res.status(400).json({ message: 'This person has already been invited' })

    const invite = new Invitation({ email, group: groupId, invitedBy: req.user.id })
    await invite.save()

    // Send real email
    await sendInvitationEmail({
      toEmail: email,
      groupName: group.name,
      invitedByName: group.admin.name,
      inviteId: invite._id
    })

    res.json({ message: 'Invitation sent successfully', invite })
  } catch (err) {
    console.error('Invite error:', err)
    res.status(500).json({ message: err.message })
  }
})

router.get('/invitations', authMiddleware, async (req, res) => {
  try {
    const invites = await Invitation.find({ email: req.user.email, status: 'pending' }).populate('group')
    res.json(invites)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/accept/:id', authMiddleware, async (req, res) => {
  try {
    const invite = await Invitation.findById(req.params.id)
    if (!invite) return res.status(404).json({ message: 'Invite not found' })
    invite.status = 'accepted'
    await invite.save()
    await Group.findByIdAndUpdate(invite.group, { $addToSet: { members: req.user.id } })
    res.json({ message: 'Joined group successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/my-groups', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id })
    res.json(groups)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Getting group by ID:', req.params.id)
    const group = await Group.findById(req.params.id).populate('members', 'name email')
    if (!group) {
      console.log('Group not found:', req.params.id)
      return res.status(404).json({ message: 'Group not found' })
    }
    console.log('Group found:', group.name)
    res.json(group)
  } catch (err) {
    console.error('Error getting group:', err)
    res.status(500).json({ message: err.message })
  }
})

// DELETE GROUP (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
    if (!group) return res.status(404).json({ message: 'Group not found' })
    if (group.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the group admin can delete this group' })
    }
    await Group.findByIdAndDelete(req.params.id)
    await Invitation.deleteMany({ group: req.params.id })
    res.json({ message: 'Group deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Public invite link handler — checks if invite exists and redirects
router.get('/invite-info/:inviteId', async (req, res) => {
  try {
    const invite = await Invitation.findById(req.params.inviteId).populate('group', 'name')
    if (!invite) return res.status(404).json({ message: 'Invitation not found or expired' })
    res.json({
      inviteId: invite._id,
      groupName: invite.group.name,
      email: invite.email,
      status: invite.status
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})
module.exports = router