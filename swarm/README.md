# swarm

The sign-up page, as one file, served from Swarm.

Same flow as the hosted page and the same code, bundled with nothing fetched at runtime.
That matters more here than anywhere else: this is the page that handles the password, and
the argument for it is that nobody operates it. A page that pulled a script from a server
would hand that server the ability to change what the password does.

So: one HTML file, one hash, and no network at runtime except the two senders and a public
RPC.

```bash
npm install
NEXT_PUBLIC_EMAIL_IDENTITY_REGISTRY=0x… \
NEXT_PUBLIC_P256_VERIFIER=0x… \
NEXT_PUBLIC_SENDERS=https://…,https://… \
npm run build
```

Then upload `dist/` to a Bee node as a collection and the reference is the page.
