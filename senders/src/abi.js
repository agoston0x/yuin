/** Only what a sender calls. */
export const emailIdentityRegistryAbi = [
  {
    type: 'function',
    name: 'createAccount',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'bytes32' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint64' },
      { type: 'bytes[]' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'accountOf',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'addressFor',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'address' }],
    outputs: [{ type: 'address' }],
  },
]
