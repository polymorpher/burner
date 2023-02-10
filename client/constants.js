import USDC from './assets/tokens/usdc.svg'
import ETH from './assets/tokens/eth.svg'
import BTC from './assets/tokens/btc.svg'
import USDT from './assets/tokens/tether.svg'
import DAI from './assets/tokens/dai.svg'
import BUSD from './assets/tokens/busd.svg'
import BNB from './assets/tokens/bnb.svg'
import FRAX from './assets/tokens/frax.svg'
const debug = process.env.DEBUG

export const MAPPING = debug
  ? { '0xB1626DE9Fd57CD26BB5909e398032CE91FDb3ceb': 'FUSDC', '0xeE6cAc909FBB541ca5425A017B5e1F3F86B5cf77': 'FETH' }
  : {
      '0x985458E523dB3d53125813eD68c274899e9DfAb4': '1USDC',
      '0x6983D1E6DEf3690C4d616b13597A09e6193EA013': '1ETH',
      '0x3095c7557bCb296ccc6e363DE01b760bA031F2d9': '1WBTC',
      '0x3C2B8Be99c50593081EAA2A724F0B8285F5aba8f': '1USDT',
      '0xEf977d2f931C1978Db5F6747666fa1eACB0d0339': '1DAI',
      '0xE176EBE47d621b984a73036B9DA5d834411ef734': '1BUSD',
      '0xF720b7910C6b2FF5bd167171aDa211E226740bfe': '1WETH',
      '0xb1f6E61E1e113625593a22fa6aa94F8052bc39E0': 'bscBNB',
      '0x0aB43550A6915F9f67d0c454C2E90385E6497EaA': 'bscBUSD',
      '0xeB6C08ccB4421b6088e581ce04fcFBed15893aC3': '1FRAX',
    }

export const ICONS = debug
  ? { '0xB1626DE9Fd57CD26BB5909e398032CE91FDb3ceb': USDC, '0xeE6cAc909FBB541ca5425A017B5e1F3F86B5cf77': ETH }
  : {
      '0x985458E523dB3d53125813eD68c274899e9DfAb4': USDC,
      '0x6983D1E6DEf3690C4d616b13597A09e6193EA013': ETH,
      '0x3095c7557bCb296ccc6e363DE01b760bA031F2d9': BTC,
      '0x3C2B8Be99c50593081EAA2A724F0B8285F5aba8f': USDT,
      '0xEf977d2f931C1978Db5F6747666fa1eACB0d0339': DAI,
      '0xE176EBE47d621b984a73036B9DA5d834411ef734': BUSD,
      '0xF720b7910C6b2FF5bd167171aDa211E226740bfe': ETH,
      '0xb1f6E61E1e113625593a22fa6aa94F8052bc39E0': BNB,
      '0x0aB43550A6915F9f67d0c454C2E90385E6497EaA': BUSD,
      '0xeB6C08ccB4421b6088e581ce04fcFBed15893aC3': FRAX,
    }
