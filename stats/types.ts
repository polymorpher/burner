
export interface EventLog {
  burner: string
  from: string
  to: string
  user: string
  stablecoin: string
  stablecoinAmount: string
  burned: string
  burnedAmount: string
  tx: string
  ts: string
  gasPrice: string
  gasUsed: string
  gasLimit: string
  v: string
  block: string
}

export interface Wallet {
  address: string
  isEoa: boolean
  createdAt: number
}
