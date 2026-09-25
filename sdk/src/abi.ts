/** Only what the SDK calls. */

export const appRegistryAbi = [
  {
    type: 'function',
    name: 'policyFor',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'bytes32' }],
    outputs: [{ type: 'bytes32[]' }],
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
] as const

export const accountAbi = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'registerSession',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint64' }, { type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isOwner',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

export const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const
