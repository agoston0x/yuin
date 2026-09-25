export const appRegistryAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'payable',
    inputs: [{ type: 'bytes32' }, { type: 'string' }, { type: 'string' }, { type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'update',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'bytes32' }, { type: 'string' }, { type: 'string' }, { type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setPolicy',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32[]' }],
    outputs: [],
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
  { type: 'function', name: 'MIN_STAKE', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
]

export const resolverAbi = [
  {
    type: 'function',
    name: 'textFor',
    stateMutability: 'view',
    inputs: [{ type: 'string' }, { type: 'string' }],
    outputs: [{ type: 'string' }],
  },
]

export const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
]
