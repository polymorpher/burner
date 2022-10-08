import 'dotenv/config'
import { HardhatUserConfig } from 'hardhat/config'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-ethers'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'hardhat-deploy'
import 'solidity-coverage'
import '@atixlabs/hardhat-time-n-mine'
import 'hardhat-contract-sizer'

const hardhatUserconfig: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  namedAccounts: {
    deployer: 0,
    operator: 1
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      accounts: {
        count: 10
      },
      mining: {
        auto: true
      },
      saveDeployments: false
    },
    ethlocal: {
      url: process.env.ETH_LOCAL_URL,
      gasPrice: 20000000000,
      gas: 6000000,
      live: false,
      saveDeployments: true,
      tags: ['local']
    },
    testnet: {
      url: process.env.TESTNET_URL,
      accounts: [process.env.PRIVATE_KEY || ''],
      chainId: 1666700000,
      live: true,
      saveDeployments: true,
      tags: ['staging'],
      gas: 2100000,
      gasPrice: 5000000000,
      gasMultiplier: 2
    },
    mainnet: {
      url: process.env.MAINNET_URL,
      accounts: [process.env.PRIVATE_KEY || ''],
      chainId: 1666600000
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD'
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './build'
  },
  mocha: {
    timeout: 20000
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [':Burner$']
  }
}

export default hardhatUserconfig
