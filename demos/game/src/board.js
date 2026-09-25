/** Three by three. The only part of this repo with no security argument attached. */

export const EMPTY = null

export function newBoard() {
  return Array(9).fill(EMPTY)
}

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export function winner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { player: board[a], line: [a, b, c] }
  }
  return board.every(Boolean) ? { player: null, line: [] } : null
}

export function play(board, index, player) {
  if (board[index] !== EMPTY) return board
  const next = [...board]
  next[index] = player
  return next
}
