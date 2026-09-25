/**
 * Putting mail on the wire.
 *
 * One provider, behind one function, because the interesting part of this service is that
 * there are two independent senders — not which API either of them happens to use. In
 * development nothing is sent and the code is logged, so the flow can be exercised without
 * a mail account.
 */
const API = 'https://api.resend.com/emails'

export async function send({ to, subject, text }) {
  const key = process.env.MAIL_PROVIDER_API_KEY
  const from = process.env.MAIL_FROM

  if (!key || !from) {
    console.log(`[mail] to=${to} subject=${subject}\n${text}\n`)
    return { delivered: false, reason: 'no provider configured' }
  }

  const response = await fetch(API, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text }),
  })

  if (!response.ok) throw new Error(`mail provider refused: ${await response.text()}`)
  return { delivered: true }
}
