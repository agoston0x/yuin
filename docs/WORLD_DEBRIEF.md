# World — integration debrief

What the track asks for: which credential, why it is the minimum sufficient assurance, the
failure paths, and honest friction.

## The product events, and why each credential

**Bidding on a lot — a live person.** The event is a bid that commits real money in an
auction where a single script could outbid every human in the room. A selfie check is the
minimum that addresses it: it establishes that a person is present at the moment of the
bid. It does not establish who they are, and we do not ask it to — the auction has no need
for a name and no business holding one.

We ask for it at the bid rather than at the door, deliberately. The threat is not "a bot
browsed the catalogue"; it is "a bot bid". Putting the check at the door would inconvenience
every visitor and still leave the actual risk open for the whole session.

**Entering the auction — age, from a passport.** The event is access to a place where
alcohol is sold. Age is a legal requirement rather than a product preference, and a passport
establishes it once. We ask at the door and not per bid, because a person's age does not
change between lots and re-asking would be theatre.

**Joining a game that pays out — a live person.** Same reasoning as the bid, different
moment: here the first move is the moment that matters, because a bot that never loses has
already won by the time anyone notices.

**Nothing in the dashboard.** An account looking at its own balance needs no proof of
humanity. Demanding one would be exactly the mistake a policy system exists to prevent, and
leaving this surface ungated is a deliberate part of the demo.

## The failure path

Shown live, and it is the more interesting half of the demo: the auction's bid policy is
changed from the console mid-session, and a bidder who has been signed in all afternoon is
refused on their next bid until the selfie passes. The refusal renders as a state — "this
needs a live person, verify and come back" — rather than as an error, because the user is
not wrong, they are simply not finished.

Denied, expired and cancelled all land in the same place: the action stays unavailable and
the reason is named. Nothing is half-applied.

## Where the proof goes

Verification happens under our own app id, and the result is linked to the identity. An app
receives the fact that a check passed, never the proof itself, so nothing an app holds can
be replayed anywhere else. The scope being set once is also what makes a person the same
person across every app built here, which is the property recovery depends on.

## The awkward question, answered before it is asked

IDKit needs a backend to sign `rp_context`, and we hold that key. In a system whose whole
claim is that no operator holds anything, that deserves a straight answer: we are a
credential issuer, not a mapping holder. We can attest that a World check passed; we cannot
produce anyone's email address, cannot move anyone's funds, and if we disappear tomorrow
every account still works through its other credentials. That is a materially different
kind of trust from the one being removed, and it is why every account is required to carry
a second, portable recovery path.

## Open questions for the World team

- Age via passport sits under Identity Check, which is in preview. Is it usable for a build
  like this, and under what limits?
- Does verifying inside World App differ from IDKit in the browser for this flow?
- One app id for a protocol that many apps build on, or one per app? We want the scope set
  once so an identity is consistent everywhere — confirming that is the intended shape.
- Is there a recommended pattern for `rp_context` signing when there is no central operator?

## Friction log

_Filled in at the event: setup time, sandbox versus production, what the docs did not say,
and the single change that would have helped most._
