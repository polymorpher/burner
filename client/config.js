const debug = process.env.DEBUG

const config = {
  debug,
  burnerContract: process.env.BURNER_CONTRACT || (debug ? '0xA6d556Ad54F208c10c147D50c463e0C4e3aE4016' : ''),
  explorer: process.env.EXPLORER_URL || 'https://explorer.harmony.one/#/tx/{{txId}}',
  supportedAssets: process.env.SUPPORTED_ASSETS
    ? JSON.parse(process.env.SUPPORTED_ASSETS)
    : [
        '0xc8C3562FF714c110298E1772a7A12e12ecF02a92',
      ],
  chainParameters: process.env.CHAIN_PARAMETERS
    ? JSON.parse(process.env.CHAIN_PARAMETERS)
    : {
        chainId: '0x63564C40', // A 0x-prefixed hexadecimal string
        chainName: 'Harmony Mainnet Shard 0',
        nativeCurrency: {
          name: 'ONE',
          symbol: 'ONE',
          decimals: 18
        },
        rpcUrls: ['https://api.harmony.one'],
        blockExplorerUrls: ['https://explorer.harmony.one/']
      }
}
console.log(config)
export default config
