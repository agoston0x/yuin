/**
 * The way in.
 *
 * Two doors, because there are two audiences: a developer setting up who gets into their
 * app, and a person walking into one. The second is where the World check is proven to
 * actually work, which is the thing worth being certain about before anything else.
 */
import Topbar from './Topbar'

export default function Home() {
  return (
    <main className="page">
      <Topbar where="app" />
      <div className="wrap">
        <div className="eyebrow">Access control, without auth code</div>
        <h1 className="h">Decide who gets in.</h1>
        <p className="sub">
          Pick the proofs your app needs and Yuin turns them into a yes or a no. Nothing to
          integrate beyond a call, and nothing to store about the people who pass.
        </p>

        <div className="card">
          <h3>Set up an app</h3>
          <p className="muted">
            Claim a name, choose how people sign in, and say which actions need more than a
            login. Changeable while the app is live.
          </p>
          <a className="btn" href="/setup">
            Open the console →
          </a>
        </div>

        <div className="card">
          <h3>See a gate work</h3>
          <p className="muted">
            A real World check against the real World App, verified on the server. The
            honest test: it should be impossible to get through without your phone.
          </p>
          <a className="ghost" href="/gate" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Try the gate →
          </a>
        </div>
      </div>
    </main>
  )
}
