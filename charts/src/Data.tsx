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
