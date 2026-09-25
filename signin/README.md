# signin

The sign-in page: email OTA, Google, passkey, World. Static, served from Swarm and pinned
to one fixed domain, because a passkey is bound to an origin and because a page nobody
operates is a page nobody can quietly change.

Its hash is registered on chain, so a tampered copy is detectable.
