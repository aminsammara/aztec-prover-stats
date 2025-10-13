import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { ROLLUP_ABI } from './abi.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const ROLLUP_CONTRACT_ADDRESS = process.env.ROLLUP_CONTRACT_ADDRESS;
const START_BLOCK = process.env.START_BLOCK ? parseInt(process.env.START_BLOCK) : undefined;
const END_BLOCK = process.env.END_BLOCK ? parseInt(process.env.END_BLOCK) : 'latest';

// Chunk size for querying events (adjust based on RPC provider limits)
const CHUNK_SIZE = 10000;

async function main() {
  if (!SEPOLIA_RPC_URL) {
    console.error('Error: SEPOLIA_RPC_URL is not set in .env file');
    process.exit(1);
  }

  if (!ROLLUP_CONTRACT_ADDRESS) {
    console.error('Error: ROLLUP_CONTRACT_ADDRESS is not set in .env file');
    process.exit(1);
  }

  console.log('Connecting to Sepolia...');
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);

  const contract = new ethers.Contract(
    ROLLUP_CONTRACT_ADDRESS,
    ROLLUP_ABI,
    provider
  );

  console.log(`Contract address: ${ROLLUP_CONTRACT_ADDRESS}`);

  // Determine block range
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = START_BLOCK || 0;
  const toBlock = END_BLOCK === 'latest' ? currentBlock : END_BLOCK;

  console.log(`Scanning blocks from ${fromBlock} to ${toBlock}...`);
  console.log(`Total blocks to scan: ${toBlock - fromBlock + 1}`);

  const proverStats = {};
  let totalProofs = 0;

  // Query events in chunks to avoid RPC limits
  for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, toBlock);

    console.log(`\nQuerying blocks ${start} to ${end}...`);

    try {
      const filter = contract.filters.L2ProofVerified();
      const events = await contract.queryFilter(filter, start, end);

      console.log(`Found ${events.length} L2ProofVerified events in this chunk`);

      for (const event of events) {
        const blockNumber = event.args.blockNumber.toString();
        const proverId = event.args.proverId;

        if (!proverStats[proverId]) {
          proverStats[proverId] = {
            address: proverId,
            proofCount: 0,
            blocks: []
          };
        }

        proverStats[proverId].proofCount++;
        proverStats[proverId].blocks.push({
          blockNumber: blockNumber,
          txHash: event.transactionHash,
          ethBlockNumber: event.blockNumber
        });

        totalProofs++;
      }
    } catch (error) {
      console.error(`Error querying blocks ${start} to ${end}:`, error.message);
      // Continue with next chunk
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('PROVER STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total proofs submitted: ${totalProofs}`);
  console.log(`Unique provers: ${Object.keys(proverStats).length}`);
  console.log('');

  // Sort provers by proof count (descending)
  const sortedProvers = Object.values(proverStats).sort((a, b) => b.proofCount - a.proofCount);

  console.log('Proofs by Prover:');
  console.log('-'.repeat(80));

  for (const prover of sortedProvers) {
    const percentage = ((prover.proofCount / totalProofs) * 100).toFixed(2);
    console.log(`${prover.address}: ${prover.proofCount} proofs (${percentage}%)`);
  }

  // Save detailed data to JSON file
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const outputFile = path.join(dataDir, `prover-stats-${Date.now()}.json`);
  const outputData = {
    scannedAt: new Date().toISOString(),
    blockRange: {
      from: fromBlock,
      to: toBlock
    },
    summary: {
      totalProofs,
      uniqueProvers: Object.keys(proverStats).length
    },
    provers: sortedProvers
  };

  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  console.log(`\nDetailed data saved to: ${outputFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
