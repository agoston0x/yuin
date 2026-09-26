'use client'

/**
 * The six things Yuin does, one card at a time.
 *
 * It advances on its own, and stops resetting under the reader's feet the moment they
 * touch a control — someone who clicked back wants to read that card, not be dragged
 * forward two seconds later.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const SLIDES = [
  { num: '01 — Setup', title: 'Live in an afternoon.', body: 'Pick how people sign in. Email code, Google, passkey, World — any of them, in any combination, from a form.', tags: ['Email OTA', 'Google', 'Passkey', 'World'] },
  { num: '02 — Two ways in', title: 'Private, or fast.', body: 'Email and a password, where the password never leaves the browser. Or Google, in one click. Your app picks which it accepts.', tags: ['Email + password', 'Google', 'Your choice'] },
  { num: '03 — Ownership', title: 'Nobody holds the door.', body: 'Credentials are salted hashes on chain. No operator maps an address back to a person, and no operator can lock anyone out.', tags: ['Staked nodes', 'No central DB', 'Slashable'] },
  { num: '04 — Recovery', title: 'More than one way back.', body: 'A passkey, a second provider, a World proof, or your own wallet. Lose a phone, not an account.', tags: ['Passkey', 'World', 'Any EOA'] },
  { num: '05 — Money', title: 'Pay in what you hold.', body: 'Prices in one token, wallets in another. The swap rides inside the payment, so nobody sees a swap screen.', tags: ['Uniswap', 'Exact output', 'One signature'] },
  { num: '06 — Keys', title: 'Bounded by design.', body: 'Session keys expire and cannot spend past their cap. Recovery waits in the open, where you can stop it.', tags: ['Spend caps', 'Timelock', 'Veto'] },
]

const INTERVAL = 5200

export default function Carousel() {
  const [index, setIndex] = useState(0)
  const timer = useRef(null)

  const restart = useCallback(() => {
    clearInterval(timer.current)
    timer.current = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL)
  }, [])

  useEffect(() => {
    restart()
    return () => clearInterval(timer.current)
  }, [restart])

  const go = (n) => {
    setIndex(((n % SLIDES.length) + SLIDES.length) % SLIDES.length)
    restart()
  }

  return (
    <div className="carousel">
      <div className="slides">
        {SLIDES.map((slide, i) => (
          <div key={slide.num} className={i === index ? 'slide on' : 'slide'}>
            <div>
              <div className="num">{slide.num}</div>
              <h3>{slide.title}</h3>
              <p>{slide.body}</p>
            </div>
            <div className="tags">
              {slide.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="controls">
        <button className="cbtn" onClick={() => go(index - 1)} aria-label="Previous">
          &larr;
        </button>
        <div className="dots">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.num}
              className={i === index ? 'dot on' : 'dot'}
              onClick={() => go(i)}
              aria-label={slide.title}
            />
          ))}
        </div>
        <button className="cbtn" onClick={() => go(index + 1)} aria-label="Next">
          &rarr;
        </button>
      </div>
    </div>
  )
}
