import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'
dotenv.config({ path: 'mocks.env' })

const f = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments: { deploy }, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const FakeUSDC = await deploy('FakeUSDC', {
    from: deployer,
    args: [10000e+6],
    log: true,
    autoMine: true
  })
  const FakeUSDS = await deploy('FakeUSDS', {
    from: deployer,
    args: [10000e+6],
    log: true,
    autoMine: true
  })
  const usdc = await ethers.getContractAt('FakeUSDC', FakeUSDC.address)
  const usds = await ethers.getContractAt('FakeUSDS', FakeUSDS.address)
  console.log('FakeUSDC deployed to:', usdc.address)
  console.log('FakeUSDS deployed to:', usds.address)
  let tx, receipt
  tx = await usds.transfer(process.env.USDS_HOLDER, 10000e+6)
  receipt = await tx.wait()
  console.log(`Transfer 10000 USDS to holder - tx: ${tx.hash}`, JSON.stringify(receipt))
  tx = await usdc.transfer(process.env.USDC_HOLDER, 10000e+6)
  receipt = await tx.wait()
  console.log(`Transfer 10000 USDC to holder - tx: ${tx.hash}`, JSON.stringify(receipt))
}
f.tags = ['Mocks']
export default f
