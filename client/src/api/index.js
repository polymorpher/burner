import Burner from '../../assets/abi/Burner.json'
import IERC20Metadata from '../../assets/abi/IERC20Metadata.json'
import IERC20 from '../../assets/abi/IERC20.json'
import Contract from 'web3-eth-contract'
import BN from 'bn.js'
import config from '../../config'
const PRECISION_FACTOR = new BN(10).pow(new BN(18))
const CLIENT_PRECISION = 1e+6
const apis = ({ web3, address }) => {
  if (!web3 || !address) {
    return
  }
  Contract.setProvider(web3.currentProvider)
  const burnerContract = new Contract(Burner, config.burnerContract)
  return {
    getCurrentExchangeRate: async () => {
      const rate = await burnerContract.methods.getCurrentExchangeRate().call()
      return new BN(rate).muln(CLIENT_PRECISION).div(PRECISION_FACTOR).toNumber() / CLIENT_PRECISION
    },
    getNewRateAfterExchange: async ({ amount }) => {
      const rate = await burnerContract.methods.getNewRateAfterExchange(amount).call()
      return new BN(rate).muln(CLIENT_PRECISION).div(PRECISION_FACTOR).toNumber() / CLIENT_PRECISION
    },

    getAllParameters: async () => {
      const perUserLimitAmountP = burnerContract.methods.perUserLimitAmount().call()
      const minRateP = burnerContract.methods.minRate().call()
      const maxRateP = burnerContract.methods.maxRate().call()
      const baseRateP = burnerContract.methods.baseRate().call()
      const lastResetTimestampP = burnerContract.methods.lastResetTimestamp().call()
      const stablecoinP = burnerContract.methods.stablecoin().call()
      const stablecoinHolderP = burnerContract.methods.stablecoinHolder().call()
      const resetThresholdAmountP = burnerContract.methods.resetThresholdAmount().call()
      const resetPeriodP = burnerContract.methods.resetPeriod().call()
      const isShutdownP = burnerContract.methods.isShutdown().call()
      const [
        perUserLimitAmount,
        minRate, maxRate, baseRate, lastResetTimestamp, stablecoin, stablecoinHolder, resetThresholdAmount, resetPeriod,
        isShutdown
      ] = await Promise.all([perUserLimitAmountP,
        minRateP, maxRateP, baseRateP, lastResetTimestampP, stablecoinP, stablecoinHolderP, resetThresholdAmountP, resetPeriodP,
        isShutdownP])
      const tokenMetadata = new Contract(IERC20Metadata, stablecoin)
      const nameP = tokenMetadata.methods.name().call()
      const symbolP = tokenMetadata.methods.symbol().call()
      const decimalsP = tokenMetadata.methods.decimals().call()
      const [decimals, symbol, name] = await Promise.all([decimalsP, symbolP, nameP])
      return {
        minRate: new BN(minRate).muln(CLIENT_PRECISION).div(PRECISION_FACTOR).toNumber() / CLIENT_PRECISION,
        maxRate: new BN(maxRate).muln(CLIENT_PRECISION).div(PRECISION_FACTOR).toNumber() / CLIENT_PRECISION,
        baseRate: new BN(baseRate).muln(CLIENT_PRECISION).div(PRECISION_FACTOR).toNumber() / CLIENT_PRECISION,
        lastResetTimestamp: parseInt(lastResetTimestamp) * 1000,
        stablecoin: {
          address: stablecoin,
          name,
          symbol,
          decimals,
        },
        stablecoinHolder,
        perUserLimitAmount: new BN(perUserLimitAmount).muln(CLIENT_PRECISION).div(new BN(10).pow(new BN(decimals))).toNumber() / CLIENT_PRECISION,
        resetThresholdAmount: new BN(resetThresholdAmount).muln(CLIENT_PRECISION).div(new BN(10).pow(new BN(decimals))).toNumber() / CLIENT_PRECISION,
        resetPeriod: parseInt(resetPeriod) * 1000,
        isShutdown
      }
    },

    checkIsAllowed: async () => {
      const isAllowed = await burnerContract.methods.allowList(address).call()
      const useAllowList = await burnerContract.methods.useAllowList().call()
      return !useAllowList || isAllowed
    },

    getExchangedAmount: async ({ decimals }) => {
      if (!decimals) {
        return 0
      }
      const amount = await burnerContract.methods.exchangedAmounts(address).call()
      return new BN(amount).muln(CLIENT_PRECISION).div(new BN(10).pow(new BN(decimals))).toNumber() / CLIENT_PRECISION
    },

    getERC20Balance: async ({ assetAddress }) => {
      const tokenMetadata = new Contract(IERC20Metadata, assetAddress)
      const tokenContract = new Contract(IERC20, assetAddress)
      const balance = await tokenContract.methods.balanceOf(address).call()
      const decimals = await tokenMetadata.methods.decimals().call()
      const formatted = new BN(balance).muln(CLIENT_PRECISION).div(new BN(10).pow(new BN(decimals))).toNumber() / CLIENT_PRECISION
      return { formatted, balance, decimals }
    },

    exchange: async ({ assetAddress, burnAmountFormatted, minExchangeRate, onFailed, onSubmitted, onSuccess }) => {
      minExchangeRate = new BN(minExchangeRate).mul(PRECISION_FACTOR)
      const tokenMetadata = new Contract(IERC20Metadata, assetAddress)
      try {
        const decimals = await tokenMetadata.methods.decimals().call()
        burnAmountFormatted = new BN(burnAmountFormatted).mul(new BN(10).pow(new BN(decimals)))
      } catch (ex) {
        throw new Error(`Cannot read from token contract ${assetAddress}`)
      }
      console.log('Exchanging with parameters', { minExchangeRate: minExchangeRate.toString(), burnAmount: burnAmountFormatted.toString(), assetAddress })
      try {
        const testTx = await burnerContract.methods.exchange(assetAddress, burnAmountFormatted, minExchangeRate).call({ from: address })
        if (config.debug) {
          console.log('testTx', testTx)
        }
      } catch (ex) {
        const err = ex.toString()
        console.error('testTx Error', err)
        onFailed && onFailed(ex)
        return null
      }
      onSubmitted && onSubmitted()
      try {
        const tx = await burnerContract.methods.exchange(assetAddress, burnAmountFormatted, minExchangeRate).send({ from: address })
        if (config.debug) {
          console.log(JSON.stringify(tx))
        }
        console.log(tx?.events)
        const burned = tx?.events.Burned
        if (onSuccess) {
          const totalAmountExchanged = burned?.returnValues?.totalAmountExchanged
          const burnedAmount = burned?.returnValues?.burnedAmount
          onSuccess({ totalAmountExchanged, burnedAmount })
        }
      } catch (ex) {
        onFailed && onFailed(ex, true)
      }
    },
    getExplorerUri: (txHash) => {
      return config.explorer.replace('{{txId}}', txHash)
    },
  }
}

export default apis
