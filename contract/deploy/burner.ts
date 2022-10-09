import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'
import config from '../config'
import BN from 'bn.js'
const PRECISION_FACTOR = new BN(10).pow(new BN(18))

const f = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments: { deploy }, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const Burner = await deploy('Burner', {
    from: deployer,
    args: [
      config.stablecoinAddress,
      new BN(config.maxRate).mul(PRECISION_FACTOR),
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
  receipt = tx.wait()
  console.log(`Set stablecoin holder - tx: ${tx.hash}`, receipt)
  tx = await burner.setParameters(
    new BN(config.minRate).mul(PRECISION_FACTOR).toString(),
    new BN(config.resetThresholdAmount).mul(new BN(10).pow(new BN(decimals))).toString(),
    config.resetPeriod,
    new BN(config.perUserLimitAmount).mul(new BN(10).pow(new BN(decimals))).toString()
  )
  receipt = tx.wait()
  console.log(`Set parameters - tx: ${tx.hash}`, receipt)

  const perUserLimitAmount = await burner.perUserLimitAmount()
  const minRate = await burner.minRate()
  const maxRate = await burner.maxRate()
  const baseRate = await burner.lastRate()
  const lastResetTimestamp = await burner.lastResetTimestamp()
  const stablecoin = await burner.stablecoin()
  const stablecoinHolder = await burner.stablecoinHolder()
  const resetThresholdAmount = await burner.resetThresholdAmount()
  const resetPeriod = await burner.resetPeriod()
  const isShutdown = await burner.isShutdown()

  console.log('Please manually verify parameters:', { perUserLimitAmount, minRate, maxRate, baseRate, lastResetTimestamp, stablecoin, stablecoinHolder, resetThresholdAmount, resetPeriod, isShutdown })
}
f.tags = ['Burner']
export default f
