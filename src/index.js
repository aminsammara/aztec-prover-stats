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

// Parse command line arguments (e.g., "npm start slash" or "npm start exit")
const MODE = process.argv[2] || 'proofs';
const SLASH_MODE = MODE === 'slash';
const EXIT_MODE = MODE === 'exit';

// Exit delay in seconds (14 days)
const EXIT_DELAY_SECONDS = 14 * 24 * 60 * 60;

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
  const mode = EXIT_MODE ? 'Exit Events' : SLASH_MODE ? 'Slash Events' : 'Proof Submissions';
  console.log(`Mode: ${mode}`);

  // Determine block range
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = START_BLOCK || 0;
  const toBlock = END_BLOCK === 'latest' ? currentBlock : END_BLOCK;

  console.log(`Scanning blocks from ${fromBlock} to ${toBlock}...`);
  console.log(`Total blocks to scan: ${toBlock - fromBlock + 1}`);

  if (EXIT_MODE) {
    await indexExitEvents(contract, provider, fromBlock, toBlock);
  } else if (SLASH_MODE) {
    await indexSlashEvents(contract, fromBlock, toBlock);
  } else {
    await indexProofEvents(contract, fromBlock, toBlock);
  }
}

async function indexProofEvents(contract, fromBlock, toBlock) {
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

async function indexSlashEvents(contract, fromBlock, toBlock) {
  const attesterStats = {};
  let totalSlashes = 0;
  let totalAmountSlashed = 0n;

  // Query events in chunks to avoid RPC limits
  for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, toBlock);

    console.log(`\nQuerying blocks ${start} to ${end}...`);

    try {
      const filter = contract.filters.Slashed();
      const events = await contract.queryFilter(filter, start, end);

      console.log(`Found ${events.length} Slashed events in this chunk`);

      for (const event of events) {
        const attester = event.args.attester;
        const amount = event.args.amount;

        if (!attesterStats[attester]) {
          attesterStats[attester] = {
            address: attester,
            slashCount: 0,
            totalAmountSlashed: 0n,
            slashes: []
          };
        }

        attesterStats[attester].slashCount++;
        attesterStats[attester].totalAmountSlashed += amount;
        attesterStats[attester].slashes.push({
          amount: amount.toString(),
          txHash: event.transactionHash,
          ethBlockNumber: event.blockNumber
        });

        totalSlashes++;
        totalAmountSlashed += amount;
      }
    } catch (error) {
      console.error(`Error querying blocks ${start} to ${end}:`, error.message);
      // Continue with next chunk
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SLASH STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total slashes: ${totalSlashes}`);
  console.log(`Total amount slashed: ${ethers.formatEther(totalAmountSlashed)} ETH`);
  console.log(`Unique attesters slashed: ${Object.keys(attesterStats).length}`);
  console.log('');

  // Sort attesters by slash count (descending)
  const sortedAttesters = Object.values(attesterStats)
    .map(a => ({
      ...a,
      totalAmountSlashed: a.totalAmountSlashed.toString()
    }))
    .sort((a, b) => b.slashCount - a.slashCount);

  console.log('Slashes by Attester:');
  console.log('-'.repeat(80));

  for (const attester of sortedAttesters) {
    const percentage = totalSlashes > 0 ? ((attester.slashCount / totalSlashes) * 100).toFixed(2) : '0.00';
    console.log(`${attester.address}: ${attester.slashCount} slashes (${percentage}%), ${ethers.formatEther(attester.totalAmountSlashed)} ETH`);
  }

  // Save detailed data to JSON file
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const outputFile = path.join(dataDir, `slash-stats-${Date.now()}.json`);
  const outputData = {
    scannedAt: new Date().toISOString(),
    blockRange: {
      from: fromBlock,
      to: toBlock
    },
    summary: {
      totalSlashes,
      totalAmountSlashed: totalAmountSlashed.toString(),
      uniqueAttesters: Object.keys(attesterStats).length
    },
    attesters: sortedAttesters
  };

  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  console.log(`\nDetailed data saved to: ${outputFile}`);
}

async function indexExitEvents(contract, provider, fromBlock, toBlock) {
  const initiatedEvents = [];
  const finalizedEvents = [];

  // Query events in chunks to avoid RPC limits
  for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, toBlock);

    console.log(`\nQuerying blocks ${start} to ${end}...`);

    try {
      // Query both event types
      const initiatedFilter = contract.filters.WithdrawInitiated();
      const finalizedFilter = contract.filters.WithdrawFinalized();

      const [initiated, finalized] = await Promise.all([
        contract.queryFilter(initiatedFilter, start, end),
        contract.queryFilter(finalizedFilter, start, end)
      ]);

      console.log(`Found ${initiated.length} WithdrawInitiated, ${finalized.length} WithdrawFinalized events`);

      initiatedEvents.push(...initiated);
      finalizedEvents.push(...finalized);
    } catch (error) {
      console.error(`Error querying blocks ${start} to ${end}:`, error.message);
      // Continue with next chunk
    }
  }

  console.log('\nFetching block timestamps for initiated events...');

  // Get block timestamps for all initiated events
  const blockTimestamps = {};
  const uniqueBlocks = [...new Set(initiatedEvents.map(e => e.blockNumber))];

  for (let i = 0; i < uniqueBlocks.length; i += 10) {
    const batch = uniqueBlocks.slice(i, i + 10);
    const blocks = await Promise.all(batch.map(bn => provider.getBlock(bn)));
    for (const block of blocks) {
      blockTimestamps[block.number] = block.timestamp;
    }
    if (i % 50 === 0 && i > 0) {
      console.log(`  Fetched ${i}/${uniqueBlocks.length} block timestamps...`);
    }
  }

  // Build attester stats
  const attesterStats = {};
  const now = Math.floor(Date.now() / 1000);

  // Process initiated events
  for (const event of initiatedEvents) {
    const attester = event.args.attester;
    const recipient = event.args.recipient;
    const amount = event.args.amount;
    const timestamp = blockTimestamps[event.blockNumber];
    const exitableAt = timestamp + EXIT_DELAY_SECONDS;

    if (!attesterStats[attester]) {
      attesterStats[attester] = {
        address: attester,
        initiatedCount: 0,
        finalizedCount: 0,
        totalInitiatedAmount: 0n,
        totalFinalizedAmount: 0n,
        initiated: [],
        finalized: []
      };
    }

    attesterStats[attester].initiatedCount++;
    attesterStats[attester].totalInitiatedAmount += amount;
    attesterStats[attester].initiated.push({
      recipient,
      amount: amount.toString(),
      txHash: event.transactionHash,
      ethBlockNumber: event.blockNumber,
      timestamp,
      exitableAt,
      canFinalize: now >= exitableAt
    });
  }

  // Process finalized events
  for (const event of finalizedEvents) {
    const attester = event.args.attester;
    const recipient = event.args.recipient;
    const amount = event.args.amount;

    if (!attesterStats[attester]) {
      attesterStats[attester] = {
        address: attester,
        initiatedCount: 0,
        finalizedCount: 0,
        totalInitiatedAmount: 0n,
        totalFinalizedAmount: 0n,
        initiated: [],
        finalized: []
      };
    }

    attesterStats[attester].finalizedCount++;
    attesterStats[attester].totalFinalizedAmount += amount;
    attesterStats[attester].finalized.push({
      recipient,
      amount: amount.toString(),
      txHash: event.transactionHash,
      ethBlockNumber: event.blockNumber
    });
  }

  // Calculate summary statistics
  let totalInitiated = 0;
  let totalFinalized = 0;
  let pendingCanFinalize = 0;
  let pendingCannotFinalize = 0;
  const pendingExits = [];

  for (const attester of Object.values(attesterStats)) {
    totalInitiated += attester.initiatedCount;
    totalFinalized += attester.finalizedCount;

    // Check for pending exits (initiated but not finalized)
    const pendingCount = attester.initiatedCount - attester.finalizedCount;
    if (pendingCount > 0) {
      // Get the most recent unfulfilled initiated events
      const unfinalized = attester.initiated.slice(-pendingCount);
      for (const exit of unfinalized) {
        if (exit.canFinalize) {
          pendingCanFinalize++;
        } else {
          pendingCannotFinalize++;
        }
        pendingExits.push({
          attester: attester.address,
          ...exit
        });
      }
    }
  }

  // Sort pending exits by exitableAt
  pendingExits.sort((a, b) => a.exitableAt - b.exitableAt);

  console.log('\n' + '='.repeat(80));
  console.log('EXIT STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total withdrawals initiated: ${totalInitiated}`);
  console.log(`Total withdrawals finalized: ${totalFinalized}`);
  console.log(`Total pending exits: ${pendingExits.length}`);
  console.log(`  - Can finalize now: ${pendingCanFinalize}`);
  console.log(`  - Cannot finalize yet: ${pendingCannotFinalize}`);
  console.log(`Unique attesters: ${Object.keys(attesterStats).length}`);
  console.log('');

  // Display pending exits timeline
  if (pendingExits.length > 0) {
    console.log('Pending Exits Timeline:');
    console.log('-'.repeat(80));

    for (const exit of pendingExits) {
      const exitDate = new Date(exit.exitableAt * 1000);
      const status = exit.canFinalize ? '[CAN FINALIZE]' : `[${exitDate.toLocaleDateString()}]`;
      const shortAddr = `${exit.attester.slice(0, 6)}...${exit.attester.slice(-4)}`;
      console.log(`${status} ${shortAddr}: ${ethers.formatEther(exit.amount)} ETH`);
    }
    console.log('');
  }

  // Sort attesters by initiated count (descending)
  const sortedAttesters = Object.values(attesterStats)
    .map(a => ({
      ...a,
      totalInitiatedAmount: a.totalInitiatedAmount.toString(),
      totalFinalizedAmount: a.totalFinalizedAmount.toString()
    }))
    .sort((a, b) => b.initiatedCount - a.initiatedCount);

  console.log('Exits by Attester:');
  console.log('-'.repeat(80));

  for (const attester of sortedAttesters) {
    const pending = attester.initiatedCount - attester.finalizedCount;
    console.log(`${attester.address}`);
    console.log(`  Initiated: ${attester.initiatedCount}, Finalized: ${attester.finalizedCount}, Pending: ${pending}`);
    console.log(`  Amount: ${ethers.formatEther(attester.totalInitiatedAmount)} ETH initiated, ${ethers.formatEther(attester.totalFinalizedAmount)} ETH finalized`);
    console.log('');
  }

  // Save detailed data to JSON file
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const outputFile = path.join(dataDir, `exit-stats-${Date.now()}.json`);
  const outputData = {
    scannedAt: new Date().toISOString(),
    currentTimestamp: now,
    blockRange: {
      from: fromBlock,
      to: toBlock
    },
    summary: {
      totalInitiated,
      totalFinalized,
      totalPending: pendingExits.length,
      pendingCanFinalize,
      pendingCannotFinalize,
      uniqueAttesters: Object.keys(attesterStats).length
    },
    pendingExits,
    attesters: sortedAttesters
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
