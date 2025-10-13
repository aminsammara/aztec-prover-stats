// Minimal ABI for the Aztec Rollup contract
// We only need the L2ProofVerified event for tracking prover statistics
export const ROLLUP_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "blockNumber",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "proverId",
        "type": "address"
      }
    ],
    "name": "L2ProofVerified",
    "type": "event"
  }
];
