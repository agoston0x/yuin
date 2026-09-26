/**
 * The landing page.
 *
 * Same markup and the same stylesheet as the static original — only the carousel is a
 * client component, because it is the one thing on the page that has to hold state.
 */
import Carousel from './Carousel'
import ScrollButton from './ScrollButton'

export default function Home() {
  return (
    <>
      <section className='section'><nav className='nav'><a className='brand' href='#'><img src='/logo.png' alt='yuin' /></a><div className='navlinks'><span>Developers</span><span>Use cases</span><span>Docs</span></div><ScrollButton>Get started →</ScrollButton></nav><div className='hero'><div><div className='eyebrow'>Access control, without auth code</div><h1>Know who gets in.</h1><p>Require a real human, 18+, Google, passkey — or any combination. Yuin handles the proof. Your app gets a yes or no.</p><ScrollButton>See how it works →</ScrollButton></div><Carousel /></div></section>
<section className='section two'><div className='content'><div><div className='eyebrow'>One rule. That's it.</div><h2>Say who can enter.</h2><p className='note'>Pick the proofs your app needs. Yuin turns identity into a simple access decision — without you building authentication infrastructure.</p><div className='terminal'><span className='dim'>$</span> npm i @yuin/access<br /><br /><span className='dim'>// your route</span><br />yuin.require({'{'}<br />{'\u00a0'}{'\u00a0'}human: true,<br />{'\u00a0'}{'\u00a0'}age: 18,<br />{'\u00a0'}{'\u00a0'}passkey: true<br />{'})'}</div></div><div><div className='flow'><div className='node'><div className='circle'>⌘</div>Your app</div><div className='arrow'>→</div><div className='node'><div className='circle'>印</div>Yuin</div><div className='arrow'>→</div><div className='node'><div className='circle'>✓</div>Yes / no</div></div><div className='big'>Users prove once.<br />Apps learn only what they need.</div></div></div></section>
<section className='section three'><div className='content'><div><div className='eyebrow'>Why Yuin</div><h2>Less auth.<br />More trust.</h2><p className='note'>Traditional auth tells you an account logged in. Yuin lets you ask what actually matters — while avoiding a central identity database.</p></div><div className='compare'><div className='row head'><div></div><div>DIY auth</div><div>Embedded wallet</div><div>Yuin</div></div><div className='row'><div>Real-human proof</div><div>Build it</div><div>—</div><div className='yes'>✓</div></div><div className='row'><div>Age proof</div><div>Build it</div><div>—</div><div className='yes'>✓</div></div><div className='row'><div>Passkeys + social</div><div>Integrate</div><div>✓</div><div className='yes'>✓</div></div><div className='row'><div>Central user DB</div><div>Usually</div><div>Usually</div><div>No</div></div><div className='row'><div>Seed phrases</div><div>—</div><div>Hidden</div><div>Never</div></div></div></div></section>
    </>
  )
}
