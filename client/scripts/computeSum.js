const Contract = require('web3-eth-contract')
const Burner = require('../assets/abi/Burner.json')
const BN = require('bn.js')
const Web3 = require('web3')
const fs = require('fs').promises
const IERC20Metadata = require('../assets/abi/IERC20Metadata.json')
const CLIENT_PRECISION = 1e+6
require('dotenv').config({ path: 'script.env' })
const web3 = new Web3(process.env.PROVIDER)
const burnerContract = process.env.BURNER_CONTRACT
const burnerContractBlock = parseInt(process.env.BURNER_CONTRACT_BLOCK)
const previousBurnerContracts = JSON.parse(process.env.PREVIOUS_BURNER_CONTRACTS)
const outputFilename = process.env.OUTPUT_FILE
Contract.setProvider(web3)

const getCumulativeStats = async ({ address = burnerContract, from = burnerContractBlock, to }) => {
  if (!to) {
    to = parseInt(await web3.eth.getBlockNumber())
  }
  const toBlock = await web3.eth.getBlock(to)
  const fromBlock = await web3.eth.getBlock(from)
  const contract = new Contract(Burner, address)
  let b = from
  const burnSums = {}
  const stableSums = {}
  while (b < to) {
    console.log('processing', { blockFrom: b, blockTo: to })
    const b1 = Math.min(b + 1024, to)
    const events = await contract.getPastEvents('Burned', { fromBlock: b, toBlock: b1 })
    events.forEach(e => {
      const { asset, burnedAmount, stablecoin, stablecoinAmount } = e.returnValues
      burnSums[asset] = (burnSums[asset] || new BN(0)).add(new BN(burnedAmount))
      stableSums[stablecoin] = (stableSums[stablecoin] || new BN(0)).add(new BN(stablecoinAmount))
    })
    b = b1
  }
  const processSum = async ([assetAddress, amount]) => {
    const metadata = new Contract(IERC20Metadata, assetAddress)
    const decimals = await metadata.methods.decimals().call()
    const symbol = await metadata.methods.symbol().call()
    const amountFormatted = new BN(amount).muln(CLIENT_PRECISION).div(new BN(10).pow(new BN(decimals))).toNumber() / CLIENT_PRECISION
    return { assetAddress, amountFormatted, decimals, symbol }
  }
  const assets = await Promise.all(Object.entries(burnSums).map(processSum))
  const stablecoins = await Promise.all(Object.entries(stableSums).map(processSum))
  return { assets, stablecoins, fromTime: fromBlock.timestamp, toTime: toBlock.timestamp }
}

async function main () {
  const totalBurned = {}
  const totalStablecoinDisbursed = {}
  const contractStats = []
  const process = (stats) => {
    stats.assets.forEach(({ symbol, amountFormatted }) => { totalBurned[symbol] = (totalBurned[symbol] || 0) + amountFormatted })
    stats.stablecoins.forEach(({ symbol, amountFormatted }) => { totalStablecoinDisbursed[symbol] = (totalStablecoinDisbursed[symbol] || 0) + amountFormatted })
  }
  const stats0 = await getCumulativeStats({})
  process(stats0)
  contractStats.push(stats0)
  console.log('current', stats0)
  for (const contract of previousBurnerContracts) {
    console.log(contract)
    const { address, from, to } = contract
    try {
      const stats = await getCumulativeStats({ address, from, to })
      process(stats)
      contractStats.push(stats)
      console.log('previous contract', address, stats)
    } catch (ex) {
      console.error(ex)
    }
  }
  if (outputFilename) {
    await fs.writeFile(outputFilename, JSON.stringify({ totalBurned, totalStablecoinDisbursed, time: stats0.toTime, contractStats }), { encoding: 'utf-8' })
  }
  console.log('all done')
}

main().catch(ex => console.error(ex)).then(e => process.exit(0))
