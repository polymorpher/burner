import dotenv from 'dotenv'
import { type StaticJsonRpcProvider } from '@ethersproject/providers'
import axios from 'axios'
import { WebSocket } from 'ws'
import { type TransactionHistoryQuery, type TransactionHistoryResponse, type Wallet } from './types.ts'

dotenv.config()

const EXPLORER_URL = process.env.EXPLORER_URL ?? 'wss://ws.explorer-v2-api.hmny.io/socket.io/?EIO=4&transport=websocket'

let _ws: WebSocket | null = null
export const initWs = async (): Promise<WebSocket> => {
  if (_ws && _ws.readyState === _ws.OPEN) {
    return _ws
  }
  const ws = new WebSocket(EXPLORER_URL)
  let greeted = false
  // eslint-disable-next-line @typescript-eslint/return-await
  await new Promise<void>((resolve, reject) => {
    ws.on('error', er => {
      console.error(er)
      reject(er)
    })
    ws.on('open', function open () {
      ws.send('40')
      // ws.send('420["getContractsByField",[0,"address","0x041d5200177b91174477ce0badef402d8e8229c3"]]');
    })
    const listener = (data): void => {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      if (data.toString().startsWith('40') && !greeted) {
        greeted = true
        console.debug('WS connected')
        ws.removeListener('message', listener)
        resolve()
      }
    }
    ws.on('message', listener)
  })
  _ws = ws
  return ws
}

const getContractCreateHash = async (address: string): Promise<string> => {
  const ws = await initWs()
  let done = false
  return await new Promise<string>((resolve) => {
    const listener = (data): void => {
      if (done) {
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const s = data.toString()
      // console.log(s)
      if (s.startsWith('430')) {
        const ss = s.slice(3)
        const payload = JSON.parse(ss)?.[0].payload || '{}'
        const { transactionHash } = JSON.parse(payload) || {}
        done = true
        ws.removeListener('message', listener)
        resolve(transactionHash)
      }
    }
    ws.on('message', listener)
    ws.send(`420["getContractsByField",[0,"address","${address}"]]`)
  })
}

// const HACK_TIME = Number(process.env.HACK_TIME ?? '1655982406')

async function parseEOA (address: string, provider: StaticJsonRpcProvider): Promise<Wallet> {
  const q: TransactionHistoryQuery = {
    jsonrpc: '2.0',
    method: 'hmyv2_getTransactionsHistory',
    params: [{
      address,
      pageIndex: 0,
      pagesize: 1,
      fullTx: true,
      txType: 'ALL',
      order: 'ASC'
    }],
    id: 1
  }
  const { data: { result } } = await axios.post<TransactionHistoryResponse>(provider.connection.url, q)

  if (!result.transactions?.[0]?.timestamp) {
    console.error(`Warning: ${address} is parsed as EOA but has no historical transaction`)
  }
  const createdAt = Number(result.transactions?.[0]?.timestamp ?? 0)
  return {
    isEoa: true,
    address,
    createdAt
  }
}

async function parseSC (address: string, provider: StaticJsonRpcProvider): Promise<Wallet> {
  console.error('Function is deprecated and should not be called since smart contract is unable to interact with burner anymore. Please check input')
  process.exit(1)
  const createTx = await getContractCreateHash(address)
  if (!createTx) {
    console.error(`Unable to parse SC wallet ${address}, treating wallet as EOA`)
    return await parseEOA(address, provider)
  }
  const rx = await provider.getTransactionReceipt(createTx)
  const b = await provider.getBlock(rx.blockNumber)
  return {
    isEoa: false,
    address,
    createdAt: b.timestamp
  }
}

export async function parseWallet (address: string, provider: StaticJsonRpcProvider): Promise<Wallet> {
  const code = await provider.getCode(address)
  // const creationHash = await getContractCreateHash(address)
  if (code === '0x') {
    return await parseEOA(address, provider)
  }
  return await parseSC(address, provider)
}

// parseSC('0x041d5200177b91174477ce0badef402d8e8229c3', new ethers.providers.StaticJsonRpcProvider('https://a.api.s0.t.hmny.io/')).catch(console.error).then(console.log)
