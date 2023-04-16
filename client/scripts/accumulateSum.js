const Contract = require('web3-eth-contract')
const Burner = require('../assets/abi/Burner.json')
const BN = require('bn.js')
const Web3 = require('web3')
const fs = require('fs').promises
const path = require('path')
const IERC20Metadata = require('../assets/abi/IERC20Metadata.json')
const CLIENT_PRECISION = 1e+6
require('dotenv').config({ path: 'accumulate.env' })
const web3 = new Web3(process.env.PROVIDER)
const burnerContract = process.env.BURNER_CONTRACT
const statsFilename = process.env.STATS_FILE
Contract.setProvider(web3)

const MAPPING = {
  '0x985458E523dB3d53125813eD68c274899e9DfAb4': '1USDC',
  '0x6983D1E6DEf3690C4d616b13597A09e6193EA013': '1ETH',
  '0x3095c7557bCb296ccc6e363DE01b760bA031F2d9': '1WBTC',
  '0x3C2B8Be99c50593081EAA2A724F0B8285F5aba8f': '1USDT',
  '0xEf977d2f931C1978Db5F6747666fa1eACB0d0339': '1DAI',
  '0xE176EBE47d621b984a73036B9DA5d834411ef734': 'BUSD',
  '0xF720b7910C6b2FF5bd167171aDa211E226740bfe': '1WETH',
  '0xb1f6E61E1e113625593a22fa6aa94F8052bc39E0': 'bscBNB',
  '0x0aB43550A6915F9f67d0c454C2E90385E6497EaA': 'bscBUSD',
  '0xeB6C08ccB4421b6088e581ce04fcFBed15893aC3': '1FRAX',
}

// const REVERSE_MAPPING = Object.fromEntries(Object.entries(MAPPING).map(([a, b]) => [b, a]))

const getMeta = async (address) => {
  const tokenMetadata = new Contract(IERC20Metadata, address)
  const symbol = await tokenMetadata.methods.symbol().call()
  const decimals = await tokenMetadata.methods.decimals().call()
  return { symbol, decimals }
}

async function main () {
  const stats = JSON.parse(await fs.readFile(statsFilename, { encoding: 'utf-8' }))
  console.log('baseStats', stats)
  const ext = path.extname(statsFilename)
  const basename = path.basename(statsFilename, ext)
  await fs.writeFile(path.join(path.dirname(statsFilename), `${basename}.${new Date().toISOString().replaceAll(':', '-').split('.')[0]}${ext}`), JSON.stringify(stats))
  const contract = new Contract(Burner, burnerContract)
  const stableUsed = await contract.methods.stablecoin().call()
  const stableMeta = await getMeta(stableUsed)
  console.log('stableMeta', stableMeta)
  const disbursed = await contract.methods.totalExchanged().call()
  console.log('disbursed', disbursed)
  const burned = Object.fromEntries(await Promise.all(Object.keys(MAPPING).map(k => contract.methods.totalBurned(k).call().then(v => [k, v]))))
  console.log('burned', burned)
  const newStats = { totalBurned: { ...stats.totalBurned }, totalStablecoinDisbursed: { ...stats.totalStablecoinDisbursed }, time: Math.floor(Date.now() / 1000) }
  newStats.totalStablecoinDisbursed[stableMeta.symbol] = (newStats.totalStablecoinDisbursed[stableMeta.symbol] || 0) + new BN(disbursed).muln(CLIENT_PRECISION).div(new BN(10).pow(new BN(stableMeta.decimals))).toNumber() / CLIENT_PRECISION
  for (const [address, amount] of Object.entries(burned)) {
    const symbol = MAPPING[address]
    console.log('processing', { symbol, amount, address })
    if (new BN(amount).eqn(0)) {
      console.log('skipped')
      continue
    }

    const meta = await getMeta(address)
    newStats.totalBurned[symbol] = (newStats.totalBurned[symbol] || 0) + new BN(amount).muln(CLIENT_PRECISION).div(new BN(10).pow(new BN(meta.decimals))).toNumber() / CLIENT_PRECISION
  }
  console.log(newStats)
  await fs.writeFile(statsFilename, JSON.stringify(newStats), { encoding: 'utf-8' })
  console.log('all done')
}

main().catch(ex => console.error(ex)).then(e => process.exit(0))
