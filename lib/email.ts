import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || 'dummy')
  return _resend
}

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const override = process.env.EMAIL_OVERRIDE
  const actualTo = override || to
  const actualHtml = override
    ? `<p style="background:#fff3cd;padding:8px;border:1px solid #ffc107;margin-bottom:16px;"><strong>DEBUG: Originally to:</strong> ${to}</p>${html}`
    : html

  const { data, error } = await getResend().emails.send({
    from: 'Wild Success <noreply@wildsuccess.co>',
    to: actualTo,
    subject: override ? `[DEBUG] ${subject}` : subject,
    html: actualHtml,
  })

  if (error) {
    console.error('Email send error:', error)
    throw error
  }

  return data
}
