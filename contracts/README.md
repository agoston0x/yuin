# contracts

The on-chain half: `IdentityRegistry` (credential hash to identity, no admin, outlives
everything), `AppRegistry` (a developer's stake, their `aud`, and the credential policy
their users are held to), `NodeRegistry` (who may verify a login and what lying costs
them), the account factory, and the ENS resolver with its EAC roles.

Foundry. Deployed to Sepolia for the hackathon, chain config swappable.
