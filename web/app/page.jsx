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
      <section className='section'><nav className='nav'><a className='brand' href='#'><img src='/logo.png' alt='yuin' /></a><div className='navlinks'><span>Developers</span><span>Use cases</span><span>Docs</span></div><ScrollButton>Get started →</ScrollButton></nav><div className='hero'><div><div className='eyebrow'>Accounts, without the crypto</div><h1>Sign in. That's the whole thing.</h1><p>An email and a password gets your users a real smart account, secured by a passkey. No seed phrase, no extension, no gas prompt, nothing to understand.</p><ScrollButton>See how it works →</ScrollButton></div><Carousel /></div></section>
<section className='section two'><div className='content'><div><div className='eyebrow'>Four lines. That's it.</div><h2>And they have an account.</h2><p className='note'>No auth code, no user table, no password resets, no support ticket that begins “I lost my”. Your app gets an address and gets on with it.</p><div className='terminal'><span className='dim'>$</span> npm i @yuin/sdk<br /><br /><span className='dim'>// your app</span><br />const yuin = createClient({'{'} app {'}'})<br />await yuin.login()<br /><br /><span className='dim'>// that's their account</span><br />yuin.account</div></div><div><div className='flow'><div className='node'><div className='circle'>✉</div>Email + password</div><div className='arrow'>→</div><div className='node'><div className='circle seal'><img src='/seal.png' alt='' /></div>Yuin</div><div className='arrow'>→</div><div className='node'><div className='circle'>◈</div>Their account</div></div><div className='big'>Nobody holds the key.<br />Not even us.</div></div></div></section>
<section className='section three'><div className='content'><div><div className='eyebrow'>Why Yuin</div><h2>No lock-in.<br />By construction.</h2><p className='note'>Embedded wallets know which email owns which address, and if they go down your users are locked out. We never have that mapping, so we could not sell it, leak it, or hold it hostage.</p></div><div className='compare'><div className='row head'><div></div><div>DIY auth</div><div>Embedded wallet</div><div>Yuin</div></div><div className='row'><div>Works if we disappear</div><div className='yes'>✓</div><div>—</div><div className='yes'>✓</div></div><div className='row'><div>Users can walk away with it</div><div>—</div><div>—</div><div className='yes'>✓</div></div><div className='row'><div>Passkeys + social</div><div>Integrate</div><div>✓</div><div className='yes'>✓</div></div><div className='row'><div>Central user DB</div><div>Usually</div><div>Usually</div><div>No</div></div><div className='row'><div>Seed phrases</div><div>—</div><div>Hidden</div><div>Never</div></div></div></div></section>
    </>
  )
}
