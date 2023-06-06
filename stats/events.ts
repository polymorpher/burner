import { type Burner } from '../contract/typechain'
import { type EventLog } from './types.ts'

const STEP = 1024
export async function parseBlocks (from: number, to: number, burner: Burner): Promise<EventLog[]> {
  if (to - from > STEP) {
    const eventLogs: EventLog[] = []
    for (let i = from; i < to; i += STEP) {
      eventLogs.push(...(await parseBlocks(i, Math.min(i + STEP, to), burner)))
    }
    return eventLogs
  }
  const filter = burner.filters['Burned(address,address,address,uint256,uint256)']()
  const logs = await burner.queryFilter(filter, from, to)
  console.debug(`Querying block ${from} to ${to}`)
  const eventLogs: EventLog[] = []
  for (const log of logs) {
    const receipt = await log.getTransactionReceipt()
    const tx = await log.getTransaction()
    const b = await log.getBlock()
    const el: EventLog = {
      burner: burner.address,
      from: receipt.from,
      to: receipt.to,
      user: log.args.user.toLowerCase(),
      stablecoin: log.args.stablecoin.toLowerCase(),
      stablecoinAmount: log.args.stablecoinAmount.toString(),
      burned: log.args.asset.toLowerCase(),
      burnedAmount: log.args.burnedAmount.toString(),
      tx: log.transactionHash,
      ts: String(b.timestamp ?? 0),
      gasPrice: String(tx.gasPrice ?? 0),
      gasUsed: String(receipt.gasUsed ?? 0),
      gasLimit: String(tx.gasLimit ?? 0),
      v: String(tx.v ?? 0),
      block: String(receipt.blockNumber ?? 0)
    }
    eventLogs.push(el)
  }
  return eventLogs
}
