import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getLatestStatsFile() {
  const dataDir = path.join(__dirname, '..', 'data');

  if (!fs.existsSync(dataDir)) {
    console.error('No data directory found. Run the indexer first with: npm start');
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir)
    .filter(f => f.startsWith('prover-stats-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(dataDir, f),
      time: fs.statSync(path.join(dataDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    console.error('No stats files found. Run the indexer first with: npm start');
    process.exit(1);
  }

  return files[0].path;
}

function displayStats() {
  const statsFile = getLatestStatsFile();
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

displayStats();
