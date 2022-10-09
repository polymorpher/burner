const debug = process.env.DEBUG

export default {
  debug,
  burnerContract: process.env.BURNER_CONTRACT || (debug ? '' : ''),
  explorer: process.env.EXPLORER_URL || 'https://explorer.harmony.one/#/tx/{{txId}}',
}
