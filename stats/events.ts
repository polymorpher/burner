import { type Burner } from '../contract/typechain'
import { type EventLog, type TransactionHistoryQuery, type TransactionHistoryResponse } from './types.ts'
import axios from 'axios'
import { type JsonRpcProvider } from '@ethersproject/providers'

const STEP = 1024

async function querySinglePage (pageIndex: number, pagesize: number, address: string, url: string): Promise<TransactionHistoryResponse> {
  const q: TransactionHistoryQuery = {
    jsonrpc: '2.0',
    method: 'hmyv2_getTransactionsHistory',
    params: [{
      address,
      pageIndex,
      pagesize,
      fullTx: true,
      txType: 'ALL',
      order: 'ASC'
    }],
    id: 1
  }
  console.debug(`[querySinglePage] ${address}: Querying page ${pageIndex}, pagesize=${pagesize}`)
  const { data } = await axios.post<TransactionHistoryResponse>(url, q)
  return data
}
export async function parseRange (burner: Burner): Promise<[ number, number ]> {
  const url = (burner.provider as JsonRpcProvider).connection.url
  const address = burner.address
  let index = 0
  const pagesize = 50
  let data = await querySinglePage(index, pagesize, address, url)
  const from = data.result.transactions?.length ? data.result.transactions[0].blockNumber : 0
  let to = data.result.transactions?.length ? data.result.transactions[data.result.transactions.length - 1].blockNumber : 0
  while (data.result.transactions.length >= pagesize) {
    index += 1
    data = await querySinglePage(index, pagesize, address, url)
    if (data.result.transactions.length > 0) {
      to = data.result.transactions[data.result.transactions.length - 1].blockNumber
    }
    console.debug(`[parseRange] ${burner.address}: ${from}, ${to}`)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return [from, to]
}

export async function parseBlocks (from: number, to: number, burner: Burner): Promise<EventLog[]> {
  if (to === 0 && from === 0) {
    console.debug(`Automatically parsing block range from burner ${burner.address}`)
    const [a, b] = await parseRange(burner)
    from = a
    to = b
  }
  if (to === 0 && from === 0) {
    return []
  }
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
