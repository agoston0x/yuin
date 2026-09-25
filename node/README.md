# node

The staked verifier, one Docker container: Bee plus a JWT verifier plus a chain client.
It checks that a login is real, signs a share saying so, and exchanges shares with the
other nodes over GSOC — three of five make a registration.

It holds no user keys and stores no mapping. Run five for the demo.
