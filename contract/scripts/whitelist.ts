import { ethers, getNamedAccounts } from 'hardhat'
import assert from 'assert'
import { Burner } from '../typechain'
import { readFile } from 'fs/promises'
import lodash from 'lodash'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.whitelist' })

const BURNER = process.env.BURNER ?? ''
const ALLOWLIST_FILE = process.env.ALLOWLIST_FILE ?? 'pre-recovery.wallets.json'
console.log({ BURNER, ALLOWLIST_FILE })
async function main () {
  assert(!!BURNER, 'BURNER is not set')
  const allowList = JSON.parse(await readFile(ALLOWLIST_FILE, { encoding: 'utf-8' })) as string[]
  assert(allowList.length > 0, 'Allow list is empty')

  console.log('allowList', allowList)
  const { deployer } = await getNamedAccounts()
  const signer = await ethers.getSigner(deployer)
  const burner = (await ethers.getContractAt('Burner', BURNER) as Burner).connect(signer)
  const chunks: string[][] = lodash.chunk(allowList, 50)
  for (const [i, chunk] of chunks.entries()) {
    console.log(`Updating batch ${i} (size: ${chunk.length}): ${chunk}`)
    const allowed = Array.from({ length: chunk.length }).fill(true) as boolean[]
    await burner.updateAllowList(chunk, allowed, true)
  }
  console.log('Verifying allow list...')
  for (const a of allowList) {
    const allowed = await burner.allowList(a)
    console.log(`address ${a} allowed: ${allowed}`)
    assert(allowed, `error: address ${a} should be allowed`)
  }
  const useAllowlist = await burner.useAllowList()
  console.log(`useAllowlist ${useAllowlist}`)
  assert(useAllowlist, 'error: not using useAllowlist')
}

main().catch(console.error)
