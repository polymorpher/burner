import dotenv from 'dotenv'
import { ethers } from 'ethers'
import BurnerAbi from '../contract/abi/Burner.json' assert {
        type: 'json'
}
import { parseBlocks } from './events.ts'
import { AsyncParser } from '@json2csv/node'
import { type Burner } from '../contract/typechain'
import fs from 'fs/promises'
import { uniq } from 'lodash-es'
import csvtojson from 'csvtojson'
import { parseWallet } from './wallets.ts'
import { type EventLog, type Wallet } from './types.ts'
dotenv.config()

const provider = new ethers.providers.StaticJsonRpcProvider(process.env.PROVIDER_URL)

const CONTRACT_CONFIGS = JSON.parse(process.env.CONTRACT_CONFIGS ?? '[]') as ContractConfig[]
const OUTPUT_PREFIX = process.env.OUTPUT_PREFIX ?? 'out'
const MODE = process.env.MODE ?? 'events'
const EXISTING_WALLET_FILE = process.env.EXISTING_WALLET_FILE ?? ''

interface ContractConfig {
  address: string
  from: number
  to: number
}
async function getEventsForContractConfig (cc: ContractConfig): Promise<EventLog[]> {
  const c = new ethers.Contract(cc.address, BurnerAbi, provider) as Burner

  const eventLogs = await parseBlocks(cc.from, cc.to, c)

  console.debug(`Retrieved ${eventLogs.length} log rows for config ${JSON.stringify(cc)}`)
  return eventLogs
}
async function dumpEventLogs (): Promise<void> {
  const eventOut = `${OUTPUT_PREFIX}.events.csv`
  const f = await fs.open(eventOut, 'w')
  for (const [i, cc] of CONTRACT_CONFIGS.entries()) {
    const parser = new AsyncParser({ header: i === 0 })
    const eventLogs = await getEventsForContractConfig(cc)
    if (eventLogs.length === 0) {
      console.debug(`Skipping writing to CSV since no data is retrieved from ${cc.address}`)
    } else {
      const csv = await parser.parse(eventLogs).promise()
      await f.write(csv)
    }
    if (i !== CONTRACT_CONFIGS.length - 1) {
      await f.write('\n')
    }
  }
}

async function dumpWallets (): Promise<void> {
  const eventLogsFile = `${OUTPUT_PREFIX}.events.csv`
  const out = `${OUTPUT_PREFIX}.wallets.csv`
  const eventLogs: EventLog[] = await csvtojson().fromFile(eventLogsFile)
  const users = eventLogs.map(e => e.user.toLowerCase())
  const uniqUsers: string[] = uniq(users)
  console.debug(`Found ${uniqUsers.length} unique users out of ${users.length}`)
  const wallets: Wallet[] = []
  const existingWallets = new Set<string>()
  if (EXISTING_WALLET_FILE) {
    const ws: Wallet[] = await csvtojson().fromFile(EXISTING_WALLET_FILE)
    ws.forEach(w => existingWallets.add(w.address.toLowerCase()))
  }
  for (const [i, u] of uniqUsers.entries()) {
    if (i % 50) {
      console.debug(`...processing ${i + 1} out of ${uniqUsers.length} unique users`)
    }
    if (existingWallets.has(u.toLowerCase())) {
      console.debug(`......skipped ${u} (already exists)`)
      continue
    }
    const w: Wallet = await parseWallet(u, provider)
    wallets.push(w)
  }
  const parser = new AsyncParser()
  const csv = await parser.parse(wallets).promise()
  await fs.writeFile(out, csv, { encoding: 'utf-8' })
  console.log('all done')
}

async function main (): Promise<void> {
  if (MODE === 'wallet') {
    await dumpWallets()
    return
  }
  await dumpEventLogs()
}

main().catch(ex => { console.error(ex) })
