import Topbar from '../Topbar'
import Setup from './Setup'

export const metadata = { title: 'yuin · set up an app' }

/**
 * Where a developer decides what their users will be asked for.
 *
 * The whole argument of the product is on this page: authentication is a form rather than
 * a library, the answer lives in a public registry rather than in someone's database, and
 * changing it takes a transaction rather than a deploy.
 */
export default function Page() {
  return (
    <main className="page">
      <Topbar where="set up an app" />
      <div className="wrap">
        <div className="eyebrow">Access control, without auth code</div>
        <h1 className="h">Decide who gets in.</h1>
        <p className="sub">
          Claim a name, choose what people must present, and save. What you pick is
          published where your users can read it before they sign up — and changing it
          later costs a transaction, not a deploy.
        </p>
        <Setup />
      </div>
    </main>
  )
}
