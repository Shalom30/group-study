const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

const sendInvitationEmail = async ({ toEmail, groupName, invitedByName, inviteId }) => {
  const inviteLink = `${process.env.FRONTEND_URL}/invite/${inviteId}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f5f0eb;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:560px;margin:40px auto;padding:20px;">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#e07b2a,#c45e1a);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
          <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:24px;">🎓</span>
          </div>
          <h1 style="color:white;margin:0;font-size:24px;font-weight:700;">NoteLearn</h1>
          <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">AI-Powered Collaborative Study</p>
        </div>

        <!-- Body -->
        <div style="background:white;padding:32px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <h2 style="margin:0 0 8px;color:#1a1208;font-size:20px;">You've been invited! 🎉</h2>
          <p style="color:#6b5c4a;margin:0 0 24px;font-size:15px;line-height:1.6;">
            <strong style="color:#1a1208;">${invitedByName}</strong> has invited you to join their study group on NoteLearn.
          </p>

          <!-- Group Card -->
          <div style="background:#fdf6ef;border:1.5px solid #f0dcc8;border-radius:12px;padding:20px;margin-bottom:28px;">
            <p style="margin:0 0 4px;font-size:12px;color:#9c7c5a;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Study Group</p>
            <p style="margin:0;font-size:20px;font-weight:700;color:#1a1208;">${groupName}</p>
          </div>

          <!-- CTA Button -->
          <a href="${inviteLink}" 
             style="display:block;background:linear-gradient(135deg,#e07b2a,#c45e1a);color:white;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-size:16px;font-weight:600;margin-bottom:20px;">
            Join Study Group →
          </a>

          <p style="color:#9c7c5a;font-size:13px;text-align:center;margin:0 0 8px;">
            Don't have an account yet? No problem — clicking the button above will guide you through creating one.
          </p>
          <p style="color:#9c7c5a;font-size:13px;text-align:center;margin:0;">
            Once registered, your invitation will be waiting on your dashboard.
          </p>
        </div>

        <!-- Footer -->
        <p style="text-align:center;color:#b09880;font-size:12px;margin-top:20px;">
          This invitation was sent via NoteLearn · team.notelearn@gmail.com<br>
          If you didn't expect this, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `

  await transporter.sendMail({
    from: `"NoteLearn" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${invitedByName} invited you to join "${groupName}" on NoteLearn`,
    html
  })
}

module.exports = { sendInvitationEmail }