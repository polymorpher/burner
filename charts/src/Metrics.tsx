import _Events from '../assets/data/events.json' assert {
        type: 'json',
        integrity: 'sha384-ABC123'
}
import _Wallets from '../assets/data/wallets.json' assert {
        type: 'json',
        integrity: 'sha384-ABC123'
}
import { type EventLog, type Wallet } from '../../stats/types.ts'
import groupBy from 'lodash-es/groupBy.js'
import sum from 'lodash-es/sum.js'
import mean from 'lodash-es/mean.js'
import sortBy from 'lodash-es/sortBy.js'
import config from '../config.ts'

const Wallets: Wallet[] = _Wallets
const Events: EventLog[] = _Events

export const NumWallets = (): number => {
  return Wallets.length
}

interface PercentileReport {
  '10': number
  '25': number
  '50': number
  '75': number
  '90': number
  'avg'?: number
}

const normalizeStablecoinAmount = (e: string): number => Number(BigInt(e) / BigInt(1e+6))

const computePercentiles = (values: number[], transformer = e => e): PercentileReport => {
  const sorted = sortBy(values)
  const len = sorted.length
  const percs = [10, 25, 50, 75, 90]
  const indexes = percs.map(e => Math.floor(e / 100 * len))
  return Object.fromEntries([...indexes.map((pos, i) => [percs[i], transformer(sorted[pos])]), ['avg', transformer(mean(sorted))]])
}
export const computePercentilesStablecoinReceived = (): PercentileReport => {
  const walletAndTransactions = groupBy(Events, (e: EventLog) => e.user.toLowerCase())
  const sums: number[] = Object.entries(walletAndTransactions).map(([, txs]) =>
    sum((txs as EventLog[]).map(e => normalizeStablecoinAmount(e.stablecoinAmount)))
  )
  return computePercentiles(sums)
}

export const computePercentileWalletAges = (): PercentileReport => {
  const now = Math.floor(Date.now() / 1000)
  const ages = Wallets.map(e => (now - e.createdAt) / 86400)
  return computePercentiles(ages)
}

const getWalletGroup = (createdAt: number): string => {
  if (createdAt < config.hackTime) {
    return 'pre-hack'
  }
  if (createdAt < config.hackTime + 86400 * 90) {
    return 'pre-recovery'
  }
  return 'post-recovery'
}

export const computeStablecoinReceivedPerGroup = (): Record<string, number> => {
  const groups = groupBy(Wallets, (w: Wallet) => getWalletGroup(w.createdAt))
  const walletToGroup = Object.fromEntries(
    Object.entries(groups)
      .map(([group, wallets]) =>
        (wallets as Wallet[]).map(e => [e.address.toLowerCase(), group])
      ).flat()
  )
  const groupAndTransactions = groupBy(Events, (e: EventLog) => walletToGroup[e.user.toLowerCase()])
  const groupAndSum: Array<[string, number]> = Object.entries(groupAndTransactions).map(([group, txs]) =>
    [group, sum((txs as EventLog[]).map(e => normalizeStablecoinAmount(e.stablecoinAmount)))]
  )
  return Object.fromEntries(groupAndSum)
}

export const computePercentileStablecoinDisburseTime = (): PercentileReport => {
  const sortedEvents: EventLog[] = sortBy(Events, (e: EventLog) => Number(e.ts))
  const total = sum(Events.map(e => normalizeStablecoinAmount(e.stablecoinAmount)))
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

export const computePercentileBurnTime = (): PercentileReport => {
  const tss = Events.map(e => Number(e.ts))
  return computePercentiles(tss, e => new Date(Math.floor(e) * 1000))
}

async function main () {
  const r = {
    PercentileBurnTime: computePercentileBurnTime(),
    PercentileStablecoinDisburseTime: computePercentileStablecoinDisburseTime(),
    StablecoinReceivedPerGroup: computeStablecoinReceivedPerGroup(),
    PercentileWalletAges: computePercentileWalletAges(),
    PercentilesStablecoinReceived: computePercentilesStablecoinReceived()
  }
  console.log(r)
}

main().catch(console.error)
