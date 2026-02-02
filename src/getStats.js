import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments (e.g., "npm run stats slash" or "npm run stats exit")
const MODE = process.argv[2] || 'proofs';
const SLASH_MODE = MODE === 'slash';
const EXIT_MODE = MODE === 'exit';

function getLatestStatsFile(mode) {
  const dataDir = path.join(__dirname, '..', 'data');

  let filePrefix, command, modeName;
  if (mode === 'exit') {
    filePrefix = 'exit-stats-';
    command = 'npm run exit';
    modeName = 'exit';
  } else if (mode === 'slash') {
    filePrefix = 'slash-stats-';
    command = 'npm run slash';
    modeName = 'slash';
  } else {
    filePrefix = 'prover-stats-';
    command = 'npm start';
    modeName = 'prover';
  }

  if (!fs.existsSync(dataDir)) {
    console.error(`No data directory found. Run the indexer first with: ${command}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir)
    .filter(f => f.startsWith(filePrefix) && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(dataDir, f),
      time: fs.statSync(path.join(dataDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    console.error(`No ${modeName} stats files found. Run the indexer first with: ${command}`);
    process.exit(1);
  }

  return files[0].path;
}

function displayProverStats() {
  const statsFile = getLatestStatsFile('prover');
  console.log(`Reading stats from: ${path.basename(statsFile)}\n`);

  const data = JSON.parse(fs.readFileSync(statsFile, 'utf-8'));

  console.log('='.repeat(80));
  console.log('AZTEC TESTNET PROVER STATISTICS');
  console.log('='.repeat(80));
  console.log(`Scanned at: ${new Date(data.scannedAt).toLocaleString()}`);
  console.log(`Block range: ${data.blockRange.from} to ${data.blockRange.to}`);
  console.log(`Total proofs: ${data.summary.totalProofs}`);
  console.log(`Unique provers: ${data.summary.uniqueProvers}`);
  console.log('');

  console.log('Proofs by Prover:');
  console.log('-'.repeat(80));

  for (const prover of data.provers) {
    const percentage = ((prover.proofCount / data.summary.totalProofs) * 100).toFixed(2);
    console.log(`${prover.address}`);
    console.log(`  Proofs: ${prover.proofCount} (${percentage}%)`);
    console.log(`  Recent blocks: ${prover.blocks.slice(0, 5).map(b => b.blockNumber).join(', ')}${prover.blocks.length > 5 ? '...' : ''}`);
    console.log('');
  }

  // Display a simple chart
  console.log('\nDistribution Chart:');
  console.log('-'.repeat(80));
  const maxBarLength = 50;
  const maxCount = Math.max(...data.provers.map(p => p.proofCount));

  for (const prover of data.provers) {
    const barLength = Math.ceil((prover.proofCount / maxCount) * maxBarLength);
    const bar = '█'.repeat(barLength);
    const shortAddress = `${prover.address.slice(0, 6)}...${prover.address.slice(-4)}`;
    console.log(`${shortAddress} ${bar} ${prover.proofCount}`);
  }
}

function displaySlashStats() {
  const statsFile = getLatestStatsFile('slash');
  console.log(`Reading stats from: ${path.basename(statsFile)}\n`);

  const data = JSON.parse(fs.readFileSync(statsFile, 'utf-8'));

  console.log('='.repeat(80));
  console.log('AZTEC TESTNET SLASH STATISTICS');
  console.log('='.repeat(80));
  console.log(`Scanned at: ${new Date(data.scannedAt).toLocaleString()}`);
  console.log(`Block range: ${data.blockRange.from} to ${data.blockRange.to}`);
  console.log(`Total slashes: ${data.summary.totalSlashes}`);
  console.log(`Total amount slashed: ${ethers.formatEther(data.summary.totalAmountSlashed)} ETH`);
  console.log(`Unique attesters slashed: ${data.summary.uniqueAttesters}`);
  console.log('');

  if (data.attesters.length === 0) {
    console.log('No slashing events found in the scanned block range.');
    return;
  }

  console.log('Slashes by Attester:');
  console.log('-'.repeat(80));

  for (const attester of data.attesters) {
    const percentage = data.summary.totalSlashes > 0
      ? ((attester.slashCount / data.summary.totalSlashes) * 100).toFixed(2)
      : '0.00';
    console.log(`${attester.address}`);
    console.log(`  Slashes: ${attester.slashCount} (${percentage}%)`);
    console.log(`  Total slashed: ${ethers.formatEther(attester.totalAmountSlashed)} ETH`);
    console.log(`  Recent slashes: ${attester.slashes.slice(0, 3).map(s => ethers.formatEther(s.amount) + ' ETH').join(', ')}${attester.slashes.length > 3 ? '...' : ''}`);
    console.log('');
  }

  // Display a simple chart
  console.log('\nSlash Distribution Chart:');
  console.log('-'.repeat(80));
  const maxBarLength = 50;
  const maxCount = Math.max(...data.attesters.map(a => a.slashCount));

  for (const attester of data.attesters) {
    const barLength = Math.ceil((attester.slashCount / maxCount) * maxBarLength);
    const bar = '█'.repeat(barLength);
    const shortAddress = `${attester.address.slice(0, 6)}...${attester.address.slice(-4)}`;
    console.log(`${shortAddress} ${bar} ${attester.slashCount}`);
  }
}

function displayExitStats() {
  const statsFile = getLatestStatsFile('exit');
  console.log(`Reading stats from: ${path.basename(statsFile)}\n`);

  const data = JSON.parse(fs.readFileSync(statsFile, 'utf-8'));
  const now = Math.floor(Date.now() / 1000);

  console.log('='.repeat(80));
  console.log('AZTEC TESTNET EXIT STATISTICS');
  console.log('='.repeat(80));
  console.log(`Scanned at: ${new Date(data.scannedAt).toLocaleString()}`);
  console.log(`Block range: ${data.blockRange.from} to ${data.blockRange.to}`);
  console.log(`Total withdrawals initiated: ${data.summary.totalInitiated}`);
  console.log(`Total withdrawals finalized: ${data.summary.totalFinalized}`);
  console.log(`Total pending exits: ${data.summary.totalPending}`);

  // Recalculate can/cannot finalize based on current time
  let canFinalizeNow = 0;
  let cannotFinalizeYet = 0;
  for (const exit of data.pendingExits) {
    if (now >= exit.exitableAt) {
      canFinalizeNow++;
    } else {
      cannotFinalizeYet++;
    }
  }

  console.log(`  - Can finalize now: ${canFinalizeNow}`);
  console.log(`  - Cannot finalize yet: ${cannotFinalizeYet}`);
  console.log(`Unique attesters: ${data.summary.uniqueAttesters}`);
  console.log('');

  if (data.pendingExits.length === 0) {
    console.log('No pending exits found.');
    console.log('');
  } else {
    console.log('Pending Exits Timeline:');
    console.log('-'.repeat(80));

    for (const exit of data.pendingExits) {
      const canFinalize = now >= exit.exitableAt;
      const exitDate = new Date(exit.exitableAt * 1000);
      const shortAddr = `${exit.attester.slice(0, 6)}...${exit.attester.slice(-4)}`;

      if (canFinalize) {
        console.log(`[CAN FINALIZE] ${shortAddr}: ${ethers.formatEther(exit.amount)} ETH`);
      } else {
        const daysLeft = Math.ceil((exit.exitableAt - now) / (24 * 60 * 60));
        console.log(`[${exitDate.toLocaleDateString()} - ${daysLeft}d left] ${shortAddr}: ${ethers.formatEther(exit.amount)} ETH`);
      }
    }
    console.log('');

    // Timeline visualization
    console.log('Exit Timeline Visualization:');
    console.log('-'.repeat(80));

    const maxBarLength = 50;
    const EXIT_DELAY_SECONDS = 14 * 24 * 60 * 60;

    for (const exit of data.pendingExits) {
      const shortAddr = `${exit.attester.slice(0, 6)}...${exit.attester.slice(-4)}`;
      const initiatedAt = exit.exitableAt - EXIT_DELAY_SECONDS;
      const elapsed = now - initiatedAt;
      const progress = Math.min(elapsed / EXIT_DELAY_SECONDS, 1);
      const filledLength = Math.floor(progress * maxBarLength);
      const emptyLength = maxBarLength - filledLength;

      const filled = '█'.repeat(filledLength);
      const empty = '░'.repeat(emptyLength);
      const percentComplete = (progress * 100).toFixed(0);

      if (progress >= 1) {
        console.log(`${shortAddr} [${filled}] READY`);
      } else {
        console.log(`${shortAddr} [${filled}${empty}] ${percentComplete}%`);
      }
    }
    console.log('');
  }

  if (data.attesters.length > 0) {
    console.log('Exits by Attester:');
    console.log('-'.repeat(80));

    for (const attester of data.attesters) {
      const pending = attester.initiatedCount - attester.finalizedCount;
      console.log(`${attester.address}`);
      console.log(`  Initiated: ${attester.initiatedCount}, Finalized: ${attester.finalizedCount}, Pending: ${pending}`);
      console.log(`  Amount: ${ethers.formatEther(attester.totalInitiatedAmount)} ETH initiated, ${ethers.formatEther(attester.totalFinalizedAmount)} ETH finalized`);
      console.log('');
    }
  }
}

if (EXIT_MODE) {
  displayExitStats();
} else if (SLASH_MODE) {
  displaySlashStats();
} else {
  displayProverStats();
}
