export default function Topbar({ where }) {
  return (
    <nav className="topbar">
      <a className="brand" href="/">
        <img src="/logo.png" alt="yuin" />
      </a>
      <div className="crumbs">{where}</div>
    </nav>
  )
}
