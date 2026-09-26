/**
 * Putting the code in front of a person.
 *
 * One provider behind one function, because the interesting part is that two independent
 * senders exist — not which API either uses. With nothing configured the code is logged
 * rather than sent, so the whole flow can be exercised without a mail account.
 */
import { config } from './config.js'

const API = 'https://api.resend.com/emails'

export function codeEmail({ code, label }) {
  return {
    subject: `${code} — your ${label} code`,
    text: [
      `${code}`,
      '',
      `This is your ${label} code. You need a second code from the other sender as well;`,
      'neither works on its own.',
      '',
      'It expires in ten minutes. If you did not ask for it, nothing has happened.',
    ].join('\n'),
  }
}

export async function send({ to, code }) {
  const { subject, text } = codeEmail({ code, label: config.label })

  if (!config.mail.key || !config.mail.from) {
    console.log(`[${config.label}] ${to} -> ${code}`)
    return { delivered: false, reason: 'no provider configured' }
  }

  const response = await fetch(API, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.mail.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: config.mail.from, to, subject, text }),
  })

  if (!response.ok) throw new Error(`mail provider refused: ${await response.text()}`)
  return { delivered: true }
}
