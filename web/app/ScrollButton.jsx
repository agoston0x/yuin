'use client'

/** The two hero buttons that jump to the second section. Client-side only because of the click. */
export default function ScrollButton({ children }) {
  return (
    <button className="btn" onClick={() => document.querySelector('.two')?.scrollIntoView()}>
      {children}
    </button>
  )
}
