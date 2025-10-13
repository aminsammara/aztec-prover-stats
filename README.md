# Aztec Prover Statistics

Track and analyze proof submissions by provers on the Aztec Testnet rollup contract deployed on Sepolia.

## Overview

This tool indexes the `L2ProofVerified` events emitted by the Aztec rollup contract to provide statistics on which provers are submitting epoch proofs and how many proofs each prover has submitted.

### How it Works

The Aztec rollup contract emits an `L2ProofVerified` event every time an epoch proof is successfully verified:

```solidity
event L2ProofVerified(uint256 indexed blockNumber, address indexed proverId);
```

This event is emitted in the `submitEpochRootProof` function in `EpochProofLib.sol` (line 124) after:
- Attestations are verified
- The epoch proof is validated
- The proven chain tip is advanced
- Rewards are distributed

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

### View Statistics

To view the most recent statistics without re-scanning:

```bash
npm run stats
```

This displays:
- Total number of proofs submitted
- Number of unique provers
- Proof count and percentage per prover
- Visual distribution chart
- Recent block numbers for each prover

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

Detailed data is saved to `data/prover-stats-{timestamp}.json`:

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
│   ├── abi.js           # Minimal contract ABI with L2ProofVerified event
│   ├── index.js         # Main indexer script
│   └── getStats.js      # Statistics viewer
├── data/                # Generated JSON files with prover data
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

### Event Parameters

- `blockNumber` (uint256, indexed): The L2 block number that was proven
- `proverId` (address, indexed): The Ethereum address of the prover who submitted the proof

### Why This Matters

Tracking prover activity helps:
- Monitor network decentralization
- Identify active provers
- Analyze proof submission patterns
- Verify prover participation in the network
- Calculate prover market share

## Troubleshooting

### "ROLLUP_CONTRACT_ADDRESS is not set"

Make sure you've created a `.env` file with the correct contract address.

### "Error querying blocks"

- Check your RPC endpoint is working
- Verify you haven't exceeded rate limits
- Try reducing the block range or chunk size

### "No data directory found"

Run the indexer first with `npm start` to generate data files.

## License

MIT
