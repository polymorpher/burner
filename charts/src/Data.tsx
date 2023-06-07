import _Events from '../assets/data/events.json' assert {
        type: 'json',
        integrity: 'sha384-ABC123'
}
import _Wallets from '../assets/data/wallets.json' assert {
        type: 'json',
        integrity: 'sha384-ABC123'
}
import { type EventLog, type Wallet } from '../../stats/types'

export const Wallets: Wallet[] = _Wallets
export const Events: EventLog[] = _Events

export const normalizeStablecoinAmount = (e: string): number => Number(e) / 1e+6

export const Rates = {
  '0x985458e523db3d53125813ed68c274899e9dfab4': 1,
  '0x6983d1e6def3690c4d616b13597a09e6193ea013': 1100,
  '0x3095c7557bcb296ccc6e363de01b760ba031f2d9': 20000,
  '0x3c2b8be99c50593081eaa2a724f0b8285f5aba8f': 1,
  '0xef977d2f931c1978db5f6747666fa1eacb0d0339': 1,
  '0xe176ebe47d621b984a73036b9da5d834411ef734': 1,
  '0xf720b7910c6b2ff5bd167171ada211e226740bfe': 1100,
  '0xb1f6e61e1e113625593a22fa6aa94f8052bc39e0': 220,
  '0x0ab43550a6915f9f67d0c454c2e90385e6497eaa': 1,
  '0xeb6c08ccb4421b6088e581ce04fcfbed15893ac3': 1
}

export const Decimals = {
  '0x985458e523db3d53125813ed68c274899e9dfab4': 6,
  '0x6983d1e6def3690c4d616b13597a09e6193ea013': 18,
  '0x3095c7557bcb296ccc6e363de01b760ba031f2d9': 8,
  '0x3c2b8be99c50593081eaa2a724f0b8285f5aba8f': 6,
  '0xef977d2f931c1978db5f6747666fa1eacb0d0339': 18,
  '0xe176ebe47d621b984a73036b9da5d834411ef734': 18,
  '0xf720b7910c6b2ff5bd167171ada211e226740bfe': 18,
  '0xb1f6e61e1e113625593a22fa6aa94f8052bc39e0': 18,
  '0x0ab43550a6915f9f67d0c454c2e90385e6497eaa': 18,
  '0xeb6c08ccb4421b6088e581ce04fcfbed15893ac3': 18
}

export const computeBurnAmount = (e: EventLog): number => {
  const decimals = Decimals[e.burned.toLowerCase()]
  const rate = Rates[e.burned.toLowerCase()]
  const amount = Number(BigInt(e.burnedAmount) * BigInt(rate) * BigInt(100000) / (10n ** BigInt(decimals))) / 100000
  return amount
}
