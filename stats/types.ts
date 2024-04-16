
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

export interface TransactionHistoryQuery {
  jsonrpc: string
  method: string
  params: [{
    address: string
    pageIndex: number
    pagesize: number
    fullTx: boolean
    txType: string
    order: string
  }]
  id: number
}

export interface TransactionHistoryResponse {
  jsonrpc: string
  id: string
  result: {
    transactions: [{
      blockHash: string
      blockNumber: number
      from: string
      gas: number
      gasPrice: number
      hash: string
      input: string
      nonce: number
      timestamp: number
      to: string
      transactionIndex: number
      value: number
      shardID: number
      toShardID: number
      v: string
      r: string
      s: string
    }]
  }
}
