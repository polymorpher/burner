import dotenv from 'dotenv'
import fs from 'fs/promises'
import csvtojson from 'csvtojson'
dotenv.config()
async function main (): Promise<void> {
  const OUTPUT_PREFIX = process.env.OUTPUT_PREFIX ?? 'out'
  const eventLogsFile = `${OUTPUT_PREFIX}.events.csv`
  const walletFile = `${OUTPUT_PREFIX}.wallets.csv`
  const eventLogs = await csvtojson().fromFile(eventLogsFile)
  const wallets = await csvtojson({ colParser: { isEoa: (e) => e === 'true', createdAt: e => Number(e) } }).fromFile(walletFile)
  await fs.writeFile('events.json', JSON.stringify(eventLogs), { encoding: 'utf-8' })
  await fs.writeFile('wallets.json', JSON.stringify(wallets), { encoding: 'utf-8' })
}

main().catch(ex => { console.error(ex) })
