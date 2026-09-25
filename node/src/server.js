/**
 * The HTTP surface a browser posts to. Thin on purpose: accept a request, verify it, put
 * a share on the wire, answer with what the page needs to keep going.
 *
 * POST /login    a JWT and a session key, asking to be registered
 * POST /step-up  a credential proof for a named action
 * POST /otp      issue one half of an email code
 * GET  /health   who this node is, and whether its Bee is usable
 */

// TODO
