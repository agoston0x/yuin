import Account from './Account'

export const metadata = { title: 'yuin · your account' }

/**
 * The account, behaving like a wallet.
 *
 * Whoever signed up has a smart account, a key that controls it, and nothing else to
 * learn. This page is the argument that the thing is usable rather than merely correct:
 * money goes in, money changes shape, money goes out.
 */
export default function Page() {
  return <Account />
}
