import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'
import config from '../config'
import BN from 'bn.js'
import { Burner } from '../typechain'
const PRECISION_FACTOR = new BN(10).pow(new BN(18))
const PARAMETER_PRECISION = 1e+9

const getMeta = async (address) => {
  const tokenMetadata = await ethers.getContractAt('IERC20Metadata', address)
  const symbol = await tokenMetadata.symbol()
  const name = await tokenMetadata.name()
  const decimals = await tokenMetadata.decimals()
  return { name, symbol, decimals }
}

const exp10BN = n => new BN(10).pow(new BN(n))
const f = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments: { deploy }, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const { decimals: stableDecimals, symbol: stableSymbol, name: stableName } = await getMeta(config.stablecoinAddress)
  console.log('Stablecoin stats:', { stableName, stableSymbol, stableDecimals })
  const tokenValueAmounts: string[] = []
  const tokenLabels: string[] = [] // for debugging
  const tokenAddresses: string[] = [] // for debugging
  for (const [key, value] of Object.entries(config.tokenAssetValue)) {
    const { decimals, symbol } = await getMeta(key)
    tokenLabels.push(symbol)
    tokenAddresses.push(key)
    // @ts-ignore
    const amount = new BN(value * PARAMETER_PRECISION).mul(PRECISION_FACTOR).div(exp10BN(decimals)).mul(exp10BN(stableDecimals)).div(new BN(PARAMETER_PRECISION))
    tokenValueAmounts.push(amount.toString())
  }
  let initDistributionTokenValueRate = new BN(0)

  if (config.distributionToken) {
    const { decimals, name, symbol } = await getMeta(config.distributionToken)
    initDistributionTokenValueRate = exp10BN(decimals - stableDecimals).mul(new BN(1 / config.distributionTokenPrice * PARAMETER_PRECISION)).mul(PRECISION_FACTOR).div(new BN(PARAMETER_PRECISION))
    console.log('initDistributionTokenValueRate', initDistributionTokenValueRate.toString())
    console.log('distributionToken stats:', { name, symbol, decimals })
  }
  const Burner = await deploy('Burner', {
    from: deployer,
    args: [
      config.stablecoinAddress,
      new BN(config.maxRate * PARAMETER_PRECISION).mul(PRECISION_FACTOR).div(new BN(PARAMETER_PRECISION)).toString(),
      tokenAddresses,
      tokenValueAmounts,
      config.distributionToken || ethers.constants.AddressZero,
      initDistributionTokenValueRate.toString()
    ],
    log: true,
    autoMine: true
  })

  const burner = await ethers.getContractAt('Burner', Burner.address) as Burner
  console.log('Burner deployed to:', burner.address)
  let tx, receipt
  tx = await burner.setStablecoinHolder(config.stablecoinHolder)
  receipt = await tx.wait()
  console.log(`Set stablecoin holder - tx: ${tx.hash}`, receipt)
  tx = await burner.setParameters(
    new BN(config.minRate * PARAMETER_PRECISION).mul(PRECISION_FACTOR).div(new BN(PARAMETER_PRECISION)).toString(),
    new BN(config.resetThresholdAmount * PARAMETER_PRECISION).mul(new BN(10).pow(new BN(stableDecimals))).div(new BN(PARAMETER_PRECISION)).toString(),
    config.resetPeriod,
    new BN(config.perUserLimitAmount * PARAMETER_PRECISION).mul(new BN(10).pow(new BN(stableDecimals))).div(new BN(PARAMETER_PRECISION)).toString()
  )
  receipt = await tx.wait()
  console.log(`Set parameters - tx: ${tx.hash}`, receipt)

  const perUserLimitAmount = await burner.perUserLimitAmount()
  const minRate = await burner.minRate()
  const maxRate = await burner.maxRate()
  const baseRate = await burner.baseRate()
  const lastResetTimestamp = await burner.lastResetTimestamp()
  const stablecoin = await burner.stablecoin()
  const stablecoinHolder = await burner.stablecoinHolder()
  const resetThresholdAmount = await burner.resetThresholdAmount()
  const resetPeriod = await burner.resetPeriod()
  const isShutdown = await burner.isShutdown()
  const tokenValueRates = (await Promise.all(tokenAddresses.map(k => burner.tokenValueRate(k)))).map(e => e.toString())
  const distributionToken = await burner.distributionToken()
  const distributionTokenValueRate = await burner.distributionTokenValueRate()
  const displayObj = {
    perUserLimitAmount,
    minRate,
    maxRate,
    baseRate,
    lastResetTimestamp,
    stablecoin,
    stablecoinHolder,
    distributionToken,
    distributionTokenValueRate,
    resetThresholdAmount,
    resetPeriod,
    isShutdown,
    tokenValues: JSON.stringify(Object.fromEntries(tokenAddresses.map((k, i) => [k, tokenValueRates[i]])))
  }
  Object.keys(displayObj).forEach(k => {
    displayObj[k] = displayObj[k].toString()
  })
  console.log('Please manually verify parameters:', displayObj)
}
f.tags = ['Burner']
export default f
