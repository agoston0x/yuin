/**
 * Ask for more, per action.
 *
 * What an action demands lives on chain, so a developer tightens a policy without
 * shipping code and the next call learns about it. "You may not bid until you verify" is
 * a screen, not a crash.
 */
import type { StepUpResult } from './types.js'

export async function verify(action: string): Promise<StepUpResult> {
  throw new Error('not implemented')
}
