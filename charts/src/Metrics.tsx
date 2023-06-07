import { type EventLog, type Wallet } from '../../stats/types.ts'
import groupBy from 'lodash-es/groupBy.js'
import sum from 'lodash-es/sum.js'
import uniq from 'lodash-es/uniq.js'
import mean from 'lodash-es/mean.js'
import sortBy from 'lodash-es/sortBy.js'
import config from '../config.ts'
import { normalizeStablecoinAmount } from './Data.tsx'

export const computeNumWallets = (events: EventLog[]): number => {
  const wallets = uniq(events.map(e => e.user.toLowerCase()))
  return wallets.length
}

export const computeWalletTypes = (events: EventLog[], wallets: Wallet[]): { eoa: number, sc: number } => {
  const users = uniq(events.map(e => e.user.toLowerCase()))
  const walletToIsEoa = Object.fromEntries(wallets.map(w => [w.address.toLowerCase(), w.isEoa]))
  return {
    eoa: users.filter(e => walletToIsEoa[e]).length,
    sc: users.filter(e => !walletToIsEoa[e]).length
  }
}

export interface PercentileReport {
  '10': number
  '25': number
  '50': number
  '75': number
  '90': number
  'avg'?: number
}

const computePercentiles = (values: number[], transformer = e => e): PercentileReport => {
  const sorted = sortBy(values)
  const len = sorted.length
  const percs = [10, 25, 50, 75, 90]
  const indexes = percs.map(e => Math.floor(e / 100 * len))
  return Object.fromEntries([...indexes.map((pos, i) => [percs[i], transformer(sorted[pos])]), ['avg', transformer(mean(sorted))]])
}
export const computePercentilesStablecoinReceived = (events: EventLog[]): PercentileReport => {
  const walletAndTransactions = groupBy(events, (e: EventLog) => e.user.toLowerCase())
  const sums: number[] = Object.entries(walletAndTransactions).map(([, txs]) =>
    sum((txs as EventLog[]).map(e => normalizeStablecoinAmount(e.stablecoinAmount)))
  )
  return computePercentiles(sums)
}

export const computePercentileWalletAges = (wallets: Wallet[]): PercentileReport => {
  const now = Math.floor(Date.now() / 1000)
  const ages = wallets.map(e => (now - e.createdAt) / 86400)
  return computePercentiles(ages)
}

const getWalletGroup = (createdAt: number): string => {
  if (createdAt < config.hackTime) {
    return '[1] pre-hack'
  }
  if (createdAt < config.hackTime + 86400 * 100) {
    return '[2] pre-recovery'
  }
  return '[3] post-recovery'
}

export const computeStablecoinReceivedPerGroup = (events: EventLog[], wallets: Wallet[]): Record<string, number> => {
  const groups = groupBy(wallets, (w: Wallet) => getWalletGroup(w.createdAt))
  const walletToGroup = Object.fromEntries(
    Object.entries(groups)
      .map(([group, ws]) =>
        (ws as Wallet[]).map(e => [e.address.toLowerCase(), group])
      ).flat()
  )
  const groupAndTransactions = groupBy(events, (e: EventLog) => walletToGroup[e.user.toLowerCase()])
  const groupAndSum: Array<[string, number]> = Object.entries(groupAndTransactions).map(([group, txs]) =>
    [group, sum((txs as EventLog[]).map(e => normalizeStablecoinAmount(e.stablecoinAmount)))]
  )
  return Object.fromEntries(sortBy(groupAndSum, e => e[0]))
}

export const computePercentileStablecoinDisburseTime = (events: EventLog[]): PercentileReport => {
  const sortedEvents: EventLog[] = sortBy(events, (e: EventLog) => Number(e.ts))
  const total = sum(events.map(e => normalizeStablecoinAmount(e.stablecoinAmount)))
  const percentiles = [10, 25, 50, 75, 90]

  const ret = {}
  let ind = 0
  let acc = 0
  for (const e of sortedEvents) {
    const target = percentiles[ind] / 100 * total
    const amount = normalizeStablecoinAmount(e.stablecoinAmount)
    if (acc < target && acc + amount >= target) {
      ret[percentiles[ind].toString()] = new Date(Number(e.ts) * 1000)
      ind += 1
    }
    acc += amount
  }
  return ret as PercentileReport
}

export const computePercentileBurnTime = (events: EventLog[]): PercentileReport => {
  const tss = events.map(e => Number(e.ts))
  return { ...computePercentiles(tss, e => new Date(Math.floor(e) * 1000)), avg: undefined }
}

// async function main () {
//   const r = {
//     PercentileBurnTime: computePercentileBurnTime(),
//     PercentileStablecoinDisburseTime: computePercentileStablecoinDisburseTime(),
//     StablecoinReceivedPerGroup: computeStablecoinReceivedPerGroup(),
//     PercentileWalletAges: computePercentileWalletAges(),
//     PercentilesStablecoinReceived: computePercentilesStablecoinReceived()
//   }
//   console.log(r)
// }
//
// main().catch(console.error)
