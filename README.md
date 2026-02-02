# Aztec Prover Statistics

Track and analyze proof submissions, slashing events, and validator exits on the Aztec Testnet rollup contract deployed on Sepolia.

## Overview

This tool indexes events emitted by the Aztec rollup contract to provide statistics on:
- **Prover activity**: Which provers are submitting epoch proofs and how many
- **Slashing events**: Which attesters have been slashed and for how much
- **Exit tracking**: Which attesters have initiated withdrawals and their finalization status

### How it Works

#### Proof Submissions

The Aztec rollup contract emits an `L2ProofVerified` event every time an epoch proof is successfully verified:

```solidity
event L2ProofVerified(uint256 indexed blockNumber, address indexed proverId);
```

This event is emitted in the `submitEpochRootProof` function in `EpochProofLib.sol` (line 124) after:
- Attestations are verified
- The epoch proof is validated
- The proven chain tip is advanced
- Rewards are distributed

#### Slashing Events

The contract also emits a `Slashed` event when an attester is penalized:

```solidity
event Slashed(address indexed attester, uint256 amount);
```

This event is emitted in the `slash` function when:
- An attester is penalized for misbehavior
- The slash amount is deducted from their stake or exit balance

#### Exit Events

The contract emits withdrawal events when attesters exit the network:

```solidity
event WithdrawInitiated(address indexed attester, address indexed recipient, uint256 amount);
event WithdrawFinalized(address indexed attester, address indexed recipient, uint256 amount);
```

When an attester initiates a withdrawal, there is a **14-day delay** before they can finalize it. The exit mode tracks:
- How many attesters have pending exits
- Which exits can be finalized (14 days elapsed)
- Which exits are still in the waiting period
- A timeline visualization of pending exits

## Prerequisites

- Node.js (v18 or higher)
- A Sepolia RPC endpoint (from Infura, Alchemy, or another provider)
- The Aztec Testnet rollup contract address on Sepolia

## Installation

1. Clone or navigate to this directory:
```bash
cd aztec-prover-stats
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Edit `.env` and add your configuration:
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
ROLLUP_CONTRACT_ADDRESS=0xYourAztecRollupContractAddress
```

Optional: Set block range to limit scanning:
```env
START_BLOCK=5000000
END_BLOCK=5100000
```

## Usage

### Index Prover Data

Run the indexer to scan the blockchain and collect prover statistics:

```bash
npm start
```

This will:
- Connect to Sepolia via your RPC endpoint
- Scan for `L2ProofVerified` events in the specified block range
- Display statistics in the console
- Save detailed data to `data/prover-stats-{timestamp}.json`

### View Prover Statistics

To view the most recent prover statistics without re-scanning:

```bash
npm run stats
```

This displays:
- Total number of proofs submitted
- Number of unique provers
- Proof count and percentage per prover
- Visual distribution chart
- Recent block numbers for each prover

### Index Slash Events

Run the indexer in slash mode to scan for slashing events:

```bash
npm run slash
# or
npm start slash
```

This will:
- Connect to Sepolia via your RPC endpoint
- Scan for `Slashed` events in the specified block range
- Display slash statistics in the console
- Save detailed data to `data/slash-stats-{timestamp}.json`

### View Slash Statistics

To view the most recent slash statistics without re-scanning:

```bash
npm run slash-stats
# or
npm run stats slash
```

This displays:
- Total number of slashes
- Total amount slashed (in ETH)
- Number of unique attesters slashed
- Slash count and amount per attester
- Visual distribution chart

### Index Exit Events

Run the indexer in exit mode to scan for withdrawal events:

```bash
npm run exit
# or
npm start exit
```

This will:
- Connect to Sepolia via your RPC endpoint
- Scan for `WithdrawInitiated` and `WithdrawFinalized` events
- Fetch block timestamps to calculate finalization eligibility
- Display exit statistics in the console
- Save detailed data to `data/exit-stats-{timestamp}.json`

### View Exit Statistics

To view the most recent exit statistics without re-scanning:

```bash
npm run exit-stats
# or
npm run stats exit
```

This displays:
- Total withdrawals initiated vs finalized
- Pending exits breakdown (can finalize vs cannot finalize yet)
- Timeline of pending exits with days remaining
- Progress visualization for each pending exit

## Output

### Console Output Example

```
================================================================================
PROVER STATISTICS
================================================================================
Total proofs submitted: 156
Unique provers: 3

Proofs by Prover:
--------------------------------------------------------------------------------
0x1234...5678: 89 proofs (57.05%)
0xabcd...ef00: 45 proofs (28.85%)
0x9876...5432: 22 proofs (14.10%)

Distribution Chart:
--------------------------------------------------------------------------------
0x1234...5678 ██████████████████████████████████████████████████ 89
0xabcd...ef00 █████████████████████████ 45
0x9876...5432 ████████████ 22
```

### JSON Output

#### Prover Stats

Detailed prover data is saved to `data/prover-stats-{timestamp}.json`:

```json
{
  "scannedAt": "2025-10-13T12:34:56.789Z",
  "blockRange": {
    "from": 5000000,
    "to": 5100000
  },
  "summary": {
    "totalProofs": 156,
    "uniqueProvers": 3
  },
  "provers": [
    {
      "address": "0x1234...5678",
      "proofCount": 89,
      "blocks": [
        {
          "blockNumber": "123",
          "txHash": "0xabc...",
          "ethBlockNumber": 5012345
        }
      ]
    }
  ]
}
```

#### Slash Stats

Detailed slash data is saved to `data/slash-stats-{timestamp}.json`:

```json
{
  "scannedAt": "2025-10-13T12:34:56.789Z",
  "blockRange": {
    "from": 5000000,
    "to": 5100000
  },
  "summary": {
    "totalSlashes": 5,
    "totalAmountSlashed": "50000000000000000000",
    "uniqueAttesters": 2
  },
  "attesters": [
    {
      "address": "0x1234...5678",
      "slashCount": 3,
      "totalAmountSlashed": "30000000000000000000",
      "slashes": [
        {
          "amount": "10000000000000000000",
          "txHash": "0xabc...",
          "ethBlockNumber": 5012345
        }
      ]
    }
  ]
}
```

#### Exit Stats

Detailed exit data is saved to `data/exit-stats-{timestamp}.json`:

```json
{
  "scannedAt": "2025-10-13T12:34:56.789Z",
  "currentTimestamp": 1697199296,
  "blockRange": {
    "from": 5000000,
    "to": 5100000
  },
  "summary": {
    "totalInitiated": 10,
    "totalFinalized": 7,
    "totalPending": 3,
    "pendingCanFinalize": 1,
    "pendingCannotFinalize": 2,
    "uniqueAttesters": 8
  },
  "pendingExits": [
    {
      "attester": "0x1234...5678",
      "recipient": "0xabcd...ef00",
      "amount": "100000000000000000000",
      "txHash": "0xabc...",
      "ethBlockNumber": 5012345,
      "timestamp": 1696000000,
      "exitableAt": 1697209600,
      "canFinalize": false
    }
  ],
  "attesters": [
    {
      "address": "0x1234...5678",
      "initiatedCount": 2,
      "finalizedCount": 1,
      "totalInitiatedAmount": "200000000000000000000",
      "totalFinalizedAmount": "100000000000000000000",
      "initiated": [...],
      "finalized": [...]
    }
  ]
}
```

## Performance Considerations

### Chunked Queries

The indexer queries events in chunks (default: 10,000 blocks) to avoid RPC provider limits. You can adjust `CHUNK_SIZE` in `src/index.js` if needed.

### Indexed Parameters

Both event parameters (`blockNumber` and `proverId`) are indexed, making queries very efficient. The indexer can filter and retrieve events quickly even across large block ranges.

### RPC Rate Limits

If you encounter rate limit errors, consider:
- Using a paid RPC provider with higher limits
- Reducing the `CHUNK_SIZE` value
- Adding delays between chunk queries
- Scanning smaller block ranges

## Project Structure

```
aztec-prover-stats/
├── src/
│   ├── abi.js           # Contract ABI with all tracked events
│   ├── index.js         # Main indexer script (supports slash, exit modes)
│   └── getStats.js      # Statistics viewer (supports slash, exit modes)
├── data/                # Generated JSON files (prover-stats-*, slash-stats-*, exit-stats-*)
├── .env                 # Configuration (not committed)
├── .env.example         # Configuration template
├── .gitignore
├── package.json
└── README.md
```

## Technical Details

### Event Source

The `L2ProofVerified` event is emitted in:
- **File**: `l1-contracts/src/core/libraries/rollup/EpochProofLib.sol`
- **Function**: `submitEpochRootProof()`
- **Line**: 124

### L2ProofVerified Event Parameters

- `blockNumber` (uint256, indexed): The L2 block number that was proven
- `proverId` (address, indexed): The Ethereum address of the prover who submitted the proof

### Slashed Event Parameters

- `attester` (address, indexed): The Ethereum address of the attester who was slashed
- `amount` (uint256): The amount of tokens slashed (in wei)

### Withdrawal Event Parameters

**WithdrawInitiated:**
- `attester` (address, indexed): The attester initiating the withdrawal
- `recipient` (address, indexed): The address that will receive the funds
- `amount` (uint256): The amount being withdrawn (in wei)

**WithdrawFinalized:**
- `attester` (address, indexed): The attester whose withdrawal is being finalized
- `recipient` (address, indexed): The address receiving the funds
- `amount` (uint256): The amount withdrawn (in wei)

### Why This Matters

**Tracking prover activity helps:**
- Monitor network decentralization
- Identify active provers
- Analyze proof submission patterns
- Verify prover participation in the network
- Calculate prover market share

**Tracking slashing events helps:**
- Monitor validator/attester behavior and compliance
- Identify problematic attesters
- Analyze slashing patterns and severity
- Assess network security and stake distribution
- Track total penalties across the network

**Tracking exit events helps:**
- Monitor validator churn and network stability
- Identify attesters leaving the network
- Track the 14-day exit queue and pending finalizations
- Plan for network capacity changes
- Detect unusual exit patterns that might indicate issues

## Troubleshooting

### "ROLLUP_CONTRACT_ADDRESS is not set"

Make sure you've created a `.env` file with the correct contract address.

### "Error querying blocks"

- Check your RPC endpoint is working
- Verify you haven't exceeded rate limits
- Try reducing the block range or chunk size

### "No data directory found"

Run the indexer first with `npm start` to generate data files.

### "No slash stats files found"

Run the indexer in slash mode first with `npm run slash` to generate slash data files.

### "No exit stats files found"

Run the indexer in exit mode first with `npm run exit` to generate exit data files.

## License

MIT
