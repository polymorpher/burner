import { Wallets } from '../src/Data.tsx'
import config from '../config.ts'
import fs from 'fs/promises'
const OUT = process.env.OUT ?? 'pre-recovery.wallets.json'
async function printWallets (): Promise<void> {
  const preRecoveryWallets = Wallets.filter(w => w.createdAt < config.hackTime + 86400 * 100)
  const addresses = preRecoveryWallets.map(w => w.address)
  await fs.writeFile(OUT, JSON.stringify(addresses), { encoding: 'utf-8' })
}

printWallets().catch(console.error)
