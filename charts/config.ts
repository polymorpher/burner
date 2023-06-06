const debug = process.env.DEBUG

const config = {
  debug,
  defaultRpc: process.env.DEFAULT_RPC ?? 'https://api.harmony.one',
  hackTime: Number(process.env.HACK_TIME ?? '1655982406')
}

export default config
