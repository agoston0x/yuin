/**
 * Playing for something.
 *
 * Both players lock an amount before the first move; the winner is paid when the board
 * resolves. What makes it bearable is that nobody signs anything mid-game: the session key
 * already carries permission, bounded by a cap the account enforces, so the moves are just
 * moves.
 *
 * That bound is the whole reason a session key is safe to leave in a browser. A key that
 * could do anything would make this a terrible idea.
 */
export const STAKE_TOKEN = process.env.STAKE_TOKEN || ''

export function playingForTokens() {
  return Boolean(STAKE_TOKEN)
}

export function settle({ board, players }) {
  const result = board && players ? null : null
  return result
}
