# mail

The sender behind email one-time codes. Two independent senders each mail a code and
publish only `H(code‖email‖nonce)`; this is our half, the app runs the other.

Neither half alone can sign anyone in, which is the entire point of there being two.
