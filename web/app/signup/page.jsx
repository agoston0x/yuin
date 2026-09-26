import Signup from './Signup'

export const metadata = { title: 'yuin · sign up' }

/**
 * An account from an email address and a password, and nothing else.
 *
 * No wallet, no seed phrase, no extension, and no backend of ours holding the mapping
 * between the two. What the chain gets is one hash; what the senders get is an address
 * they already mailed.
 */
export default function Page() {
  return <Signup />
}
