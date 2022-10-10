import * as dotenv from 'dotenv'
const debug = (process.env.DEBUG === '1') || process.env.DEBUG === 'true'
dotenv.config()

export default {
  debug,
  stablecoinAddress: process.env.STABLECOIN_ADDRESS || '',
  stablecoinHolder: process.env.STABLECOIN_HOLDER || '',
  maxRate: parseFloat(process.env.MAX_RATE || '0.1'),
  minRate: parseFloat(process.env.MIN_RATE || '0.01'),
  resetThresholdAmount: parseFloat(process.env.RESET_THRESHOLD_AMOUNT || (250).toString()),
  resetPeriod: parseInt(process.env.RESET_PERIOD || (3600 * 3).toString()),
  perUserLimitAmount: parseFloat(process.env.PER_USER_LIMIT_AMOUNT || (1000).toString()),
  tokenAssetValue: JSON.parse(process.env.TOKEN_ASSET_VALUE || '{}')

}
