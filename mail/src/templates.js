/**
 * The mail itself. Short, plain, and it says which of the two codes this is — someone
 * waiting on two six-digit numbers from two senders needs to be able to tell them apart
 * without reading carefully.
 */
export function codeEmail({ code, appName, senderLabel }) {
  const subject = `${code} — your ${senderLabel} code`
  const text = [
    `${code}`,
    '',
    `This is your ${senderLabel} code for signing in to ${appName}.`,
    'You need a second code from the other sender as well; neither works alone.',
    '',
    'It expires in ten minutes. If you did not ask for it, nothing has happened and you',
    'can ignore this.',
  ].join('\n')

  return { subject, text }
}
