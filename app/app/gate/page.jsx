import Topbar from '../Topbar'
import Gate from './Gate'

export const metadata = { title: 'yuin · gate' }

/**
 * The proof that the World integration is real.
 *
 * Two gates on one page, so the difference is visible rather than asserted: personhood,
 * which says a live human is here, and age, which says an adult is. Passing one does not
 * pass the other, and neither can be faked from the browser, because the proof is checked
 * on the server against World's verifier.
 */
export default function Page() {
  return (
    <main className="page">
      <Topbar where="gate" />
      <div className="wrap">
        <div className="eyebrow">Proof, not configuration</div>
        <h1 className="h">Scan, or stay out.</h1>
        <p className="sub">
          Nothing below can be talked past. The proof goes to World for verification, and
          this page only ever learns whether it passed.
        </p>
        <Gate />
      </div>
    </main>
  )
}
