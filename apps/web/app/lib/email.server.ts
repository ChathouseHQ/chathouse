import { createLogger } from '@chathouse/logger'
import { createTransport, type Transporter } from 'nodemailer'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

const smtpFrom = process.env.SMTP_FROM || 'Chathouse <noreply@chathouse.local>'
const isMock = process.env.SMTP_MOCK === 'true'
const logger = createLogger('web:email')

function createMailTransport(): Transporter | null {
  if (isMock) {
    logger.info('Mock mode enabled - emails will be logged to the application logger')
    return null
  }

  const host = process.env.SMTP_HOST

  if (host) {
    const port = Number(process.env.SMTP_PORT) || 587
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASSWORD

    const transport = createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
    })

    logger.info(`SMTP transport configured (${host}:${port})`)
    return transport
  }

  logger.warn(
    '[email] No SMTP configured - using direct MX delivery. Emails may land in spam without proper SPF/DKIM records.',
  )
  return createTransport({ direct: true } as any)
}

let transporter: Transporter | null | undefined

function getTransporter(): Transporter | null {
  if (transporter === undefined) {
    transporter = createMailTransport()
  }
  return transporter
}

async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  const transport = getTransporter()

  if (!transport) {
    logger.info('--- [email mock] ---')
    logger.info(`To: ${to}`)
    logger.info(`Subject: ${subject}`)
    logger.info(`Body:\n${text || html}`)
    logger.info('--- [/email mock] ---')
    return
  }

  await transport.sendMail({
    from: smtpFrom,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  })
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Reset your Chathouse password',
    text: `You requested a password reset. Visit this link to set a new password (expires in 30 minutes):\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #1a1a1a;">Reset your password</h2>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #4a4a4a;">
          You requested a password reset for your Chathouse account. Click the button below to set a new password. This link expires in 30 minutes.
        </p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 500;">
          Reset password
        </a>
        <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.5; color: #8a8a8a;">
          If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
        </p>
        <hr style="margin: 32px 0 16px; border: none; border-top: 1px solid #e5e5e5;" />
        <p style="margin: 0; font-size: 12px; color: #aaa;">Chathouse</p>
      </div>
    `,
  })
}
