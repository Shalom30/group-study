const express = require('express')
const router = express.Router()
const authMiddleware = require('../middleware/auth.middleware')
const Group = require('../models/Group')
const Invitation = require('../models/Invitation')

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
    console.log('Inviting user:', email, 'to group:', groupId)
    const group = await Group.findById(groupId)
    if (!group) return res.status(404).json({ message: 'Group not found' })
    const existingInvite = await Invitation.findOne({ email, group: groupId, status: 'pending' })
    if (existingInvite) return res.status(400).json({ message: 'User already invited' })
    const invite = new Invitation({ email, group: groupId, invitedBy: req.user.id })
    await invite.save()
    console.log('Invitation created:', invite._id, 'for email:', invite.email)
    res.json({ message: 'Invitation sent', invite })
  } catch (err) {
    console.error('Error inviting user:', err)
    res.status(500).json({ message: err.message })
  }
})

router.get('/invitations', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching invitations for user:', req.user.email)
    console.log('User ID:', req.user.id)
    const invites = await Invitation.find({ email: req.user.email, status: 'pending' }).populate('group')
    console.log('Found invitations:', invites.length)
    res.json(invites)
  } catch (err) {
    console.error('Error fetching invitations:', err)
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

module.exports = router
