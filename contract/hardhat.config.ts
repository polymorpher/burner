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
import 'hardhat-abi-exporter'

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
    local: {
      url: process.env.LOCAL_URL,
      accounts: { mnemonic: process.env.TEST_MNEMONIC },
      live: false
    },
    testnet: {
      url: process.env.TESTNET_URL,
      accounts: { mnemonic: process.env.TEST_MNEMONIC },
      chainId: 1666700000,
      live: true,
      gasMultiplier: 2
    },
    mainnet: {
      url: process.env.MAINNET_URL,
      accounts: { mnemonic: process.env.MNEMONIC },
      chainId: 1666600000,
      live: true,
      gasPrice: 150e+9,
      gasMultiplier: 2,
      gas: 10e+6
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
  },
  abiExporter: {
    path: './abi',
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
    format: 'json',
    only: [':Burner$']
  }
}

export default hardhatUserconfig
