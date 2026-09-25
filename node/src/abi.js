/** Only the pieces this node actually calls. A full ABI would just be noise. */

export const nodeRegistryAbi = [
  { type: 'function', name: 'threshold', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'isActive',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  { type: 'function', name: 'activeSet', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  {
    type: 'function',
    name: 'nodes',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [
      { name: 'stake', type: 'uint256' },
      { name: 'gateway', type: 'string' },
      { name: 'thresholdPubKey', type: 'bytes' },
      { name: 'unbondingAt', type: 'uint64' },
      { name: 'index', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    name: 'join',
    stateMutability: 'payable',
    inputs: [{ type: 'string' }, { type: 'bytes' }],
    outputs: [],
  },
]

export const appRegistryAbi = [
  {
    type: 'function',
    name: 'appOf',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'stake', type: 'uint256' },
          { name: 'aud', type: 'string' },
          { name: 'gateway', type: 'string' },
          { name: 'frontendHash', type: 'bytes32' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'policyFor',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'bytes32' }],
    outputs: [{ type: 'bytes32[]' }],
  },
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
]

export const identityRegistryAbi = [
  {
    type: 'function',
    name: 'identityOf',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'link',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'bytes32' }, { type: 'address' }, { type: 'bytes[]' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'linkDigest',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
]

export const accountFactoryAbi = [
  {
    type: 'function',
    name: 'personalAddress',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'appAddress',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'deployPersonal',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'bytes32' }, { type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'deployForApp',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'address' }],
    outputs: [{ type: 'address' }],
  },
]
