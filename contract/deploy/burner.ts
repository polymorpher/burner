import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'
import config from '../config'
import BN from 'bn.js'
const PRECISION_FACTOR = new BN(10).pow(new BN(18))
const PARAMETER_PRECISION = 1e+6

const f = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments: { deploy }, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const Burner = await deploy('Burner', {
    from: deployer,
    args: [
      config.stablecoinAddress,
      new BN(config.maxRate * PARAMETER_PRECISION).mul(PRECISION_FACTOR).div(new BN(PARAMETER_PRECISION)).toString(),
      Object.keys(config.tokenAssetValue),
      // @ts-ignore
      Object.values(config.tokenAssetValue).map(e => new BN(e).mul(PRECISION_FACTOR).toString())
    ],
    log: true,
    autoMine: true
  })
  const stablecoinContract = await ethers.getContractAt('IERC20Metadata', config.stablecoinAddress)
  const decimals = await stablecoinContract.decimals()
  const name = await stablecoinContract.name()
  const symbol = await stablecoinContract.symbol()
  console.log('Stablecoin stats:', { name, symbol, decimals })
  const burner = await ethers.getContractAt('Burner', Burner.address)
  console.log('Burner deployed to:', burner.address)
  let tx, receipt
  tx = await burner.setStablecoinHolder(config.stablecoinHolder)
  receipt = await tx.wait()
  console.log(`Set stablecoin holder - tx: ${tx.hash}`, receipt)
  tx = await burner.setParameters(
    new BN(config.minRate * PARAMETER_PRECISION).mul(PRECISION_FACTOR).div(new BN(PARAMETER_PRECISION)).toString(),
    new BN(config.resetThresholdAmount * PARAMETER_PRECISION).mul(new BN(10).pow(new BN(decimals))).div(new BN(PARAMETER_PRECISION)).toString(),
    config.resetPeriod,
    new BN(config.perUserLimitAmount * PARAMETER_PRECISION).mul(new BN(10).pow(new BN(decimals))).div(new BN(PARAMETER_PRECISION)).toString()
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
  const displayObj = {
    perUserLimitAmount,
    minRate,
    maxRate,
    baseRate,
    lastResetTimestamp,
    stablecoin,
    stablecoinHolder,
    resetThresholdAmount,
    resetPeriod,
    isShutdown
  }
  Object.keys(displayObj).forEach(k => {
    displayObj[k] = displayObj[k].toString()
  })
  console.log('Please manually verify parameters:', displayObj)
}
f.tags = ['Burner']
export default f
