/**
 * Bidding calls `verify('bid')` first, and the policy for that action is read from chain
 * at the moment of the bid rather than baked in here.
 *
 * That is what makes the live change work: the policy gains a selfie requirement mid-demo,
 * and the next bid from an already signed-in user is refused until they verify. The
 * refusal path is the interesting one — anyone can demo a success.
 */

// TODO
