import Demo from './Demo'

export const metadata = { title: 'yuin · demo' }

/**
 * One page, two gates, and a pair of switches to turn them on.
 *
 * The point is the sequence rather than any one screen: the same visitor walks in freely,
 * then needs a passport, then needs to be a live person — and nothing about the page
 * changed except two boxes being ticked.
 */
export default function Page() {
  return <Demo />
}
