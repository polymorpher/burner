import React, { useEffect, useState } from 'react'
import Web3 from 'web3'
import detectEthereumProvider from '@metamask/detect-provider'
import config from '../config'
import { Button, CancelButton, FloatingText, Input, LinkWrarpper } from './components/Controls'
import { BaseText, Desc, DescLeft, SmallText, Title } from './components/Text'
import { Col, FlexColumn, FlexRow, Main, Modal, Row } from './components/Layout'
import styled from 'styled-components'
import { MAPPING, ICONS } from '../constants'
import USDS from '../assets/tokens/usds.png'
import { toast } from 'react-toastify'
import apis, { getBaseStats } from './api'
import { TailSpin } from 'react-loading-icons'
import Cookies from 'js-cookie'
import querystring from 'query-string'

const IconImg = styled.img`
  height: 24px;
  object-fit: contain;
`
const Container = styled(Main)`
  margin: 0 auto;
  max-width: 600px;
  padding-top: 64px;
`

const QA = styled.div`
  margin: 8px 0;
`

const Label = styled(SmallText)`
  margin-right: 16px;
  color: grey;
`

const Burn = () => {
  const [web3, setWeb3] = useState(new Web3(config.defaultRPC))
  const [address, setAddress] = useState()
  const [inputValue, setInputvalue] = useState(0)
  const [inputError, setInputError] = useState('')
  const [outputvalue, setOutputValue] = useState(0)
  const [parameters, setParameters] = useState({ initializing: true })
  const [exchangeRate, setExchangeRate] = useState(0)
  const [assetValueRate, setAssetValueRate] = useState(1)
  const [assetValueRates, setAssetValueRates] = useState({})
  const [client, setClient] = useState(apis({}))
  const supportedAssets = config.supportedAssets.map(k => ({
    key: k, label: MAPPING[k], icon: ICONS[k]
  }))
  // const [assetAddress, setAssetAddress] = useState(supportedAssets[0].key)
  const [selectedAsset, setSelectedAsset] = useState(supportedAssets[0])
  const [canExchange, setCanExchange] = useState(false)
  const [exchangedAmount, setExchangedAmount] = useState(0)
  const [userBalanceFormatted, setUserBalanceFormatted] = useState(0)
  const [userStablecoinBalanceFormatted, setUserStablecoinBalanceFormatted] = useState(0)
  const [treasuryBalanceFormatted, setTreasuryBalanceFormatted] = useState(0)
  const [assetSymbol, setAssetSymbol] = useState(null)
  const [updatingExchangeRate, setUpdatingExchangeRate] = useState(false)
  const [burning, setBurning] = useState(false)
  const [stats, setStats] = useState({})
  const [agreedTos, setAgreedTos] = useState(Cookies.get('burner-agreed-tos'))
  const [tosVisible, setTosVisible] = useState(false)
  const [selectAssetVisible, setSelectAssetVisible] = useState(false)

  async function init () {
    const provider = await detectEthereumProvider()
    const web3 = new Web3(provider)
    setWeb3(web3)
    return { web3, provider }
  }

  const connect = async () => {
    let web3, provider
    try {
      const newInit = await init()
      web3 = newInit.web3
      provider = newInit.provider
    } catch (ex) {
      console.error(ex)
      toast.error('Cannot detect wallet')
      return
    }
    if (!web3) {
      toast.error('Wallet not found')
      return
    }
    try {
      const ethAccounts = await provider.request({ method: 'eth_requestAccounts' })

      if (ethAccounts.length >= 2) {
        return toast.info('Please connect using only one account')
      }
      const address = ethAccounts[0]
      setAddress(address)

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: config.chainParameters.chainId }],
        })
        toast.success(`Switched to network: ${config.chainParameters.chainName}`)
        setClient(apis({ web3, address }))
      } catch (ex) {
        console.error(ex)
        if (ex.code !== 4902) {
          toast.error(`Failed to switch to network ${config.chainParameters.chainName}: ${ex.message}`)
          return
        }
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [config.chainParameters]
          })
          toast.success(`Added ${config.chainParameters.chainName} Network on MetaMask`)
        } catch (ex2) {
          // message.error('Failed to add Harmony network:' + ex.toString())
          toast.error(`Failed to add network ${config.chainParameters.chainName}: ${ex.message}`)
        }
      }

      window.ethereum.on('accountsChanged', accounts => setAddress(accounts[0]))
      window.ethereum.on('networkChanged', networkId => {
        console.log('networkChanged', networkId)
        init()
      })
    } catch (ex) {
      toast.error('Failed to connect wallet')
      console.error(ex)
    }
  }

  const exchange = async () => {
    if (!agreedTos) {
      setTosVisible(true)
      return
    }
    if (!client) {
      return
    }
    const burnAmountFormatted = parseFloat(inputValue)
    if (!burnAmountFormatted) {
      return toast.error('Invalid burn amount')
    }
    if (!canExchange) {
      return toast.error('Your wallet cannot burn or exchange in this portal')
    }
    if (!(exchangedAmount < parameters.perUserLimitAmount)) {
      return toast.error('Your already exceeded the per-user limit')
    }
    const { formatted: userFormattedBalance } = await client.getERC20Balance({ assetAddress: selectedAsset.key })
    if (!(userFormattedBalance > burnAmountFormatted)) {
      return toast.error('You do not have sufficient asset to burn. Please adjust the amount')
    }
    try {
      setBurning(true)
      const approvalTx = await client.approve({
        assetAddress: selectedAsset.key,
        burnAmountFormatted,
        onFailed: ex => toast.error(`Failed to approve burner to act on your behalf. Error: ${ex.toString()}`)
      })
      if (!approvalTx) {
        return
      }
      await client.exchange({
        assetAddress: selectedAsset.key,
        burnAmountFormatted,
        minExchangeRate: exchangeRate,
        stablecoinDecimals: parameters.stablecoin.decimals,
        onFailed: (ex) => {
          toast.error(`Failed to burn. Error: ${ex.toString()}`)
        },
        onSuccess: ({ totalAmountExchanged, burnedAmount, transactionHash }) => {
          toast.success(`Burned ${burnedAmount} ${assetSymbol}. Received ${totalAmountExchanged} ${parameters.stablecoin.symbol}`)
          toast.success(
            <FlexRow>
              <BaseText style={{ marginRight: 8 }}>Done!</BaseText>
              <LinkWrarpper target='_blank' href={client.getExplorerUri(transactionHash)}>
                <BaseText>View transaction</BaseText>
              </LinkWrarpper>
            </FlexRow>)
        }
      })
    } catch (ex) {
      console.error(ex)
      toast.error(`Unexpected error: ${ex.toString()}`)
    } finally {
      setBurning(false)
    }
  }
  const estimateRate = (timeElapsed) => {
    const { resetPeriod, minRate, maxRate, baseRate, lastResetTimestamp } = parameters
    const timeElapsedSinceLastReset = Date.now() - lastResetTimestamp
    const rateIncrease = (timeElapsedSinceLastReset + timeElapsed) / resetPeriod * (maxRate - minRate)
    return Math.min(maxRate, rateIncrease + baseRate).toFixed(5)
  }

  const onInputChange = ({ target: { value } }) => {
    setInputvalue(value)
    setOutputValue(value * exchangeRate * assetValueRate)
  }
  const onOutputChange = ({ target: { value } }) => {
    setOutputValue(value)
    setInputvalue(value / exchangeRate / assetValueRate)
  }

  useEffect(() => {
    if (stats?.totalBurned || !client) {
      return
    }
    async function refreshStats () {
      const baseStats = await getBaseStats()
      const newStats = { totalBurned: { ...baseStats.totalBurned }, totalStablecoinDisbursed: { ...baseStats.totalStablecoinDisbursed }, time: Math.max(baseStats.time, Math.floor(Date.now() / 1000)) }
      const disbursed = await client.getTotalExchanged()
      const [stablecoinSymbol, stablecoinAmountFormatted] = Object.entries(disbursed)[0]
      console.log({ stablecoinSymbol, stablecoinAmountFormatted })
      newStats.totalStablecoinDisbursed[stablecoinSymbol] = (newStats.totalStablecoinDisbursed[stablecoinSymbol] || 0) + stablecoinAmountFormatted
      for (const a of config.supportedAssets) {
        const burned = await client.getTotalBurned({ assetAddress: a })
        const [symbol, amountFormatted] = Object.entries(burned)[0]
        console.log({ symbol, amountFormatted })
        newStats.totalBurned[symbol] = (newStats.totalBurned[symbol] || 0) + amountFormatted
      }
      console.log(newStats)
      setStats(newStats)
    }
    refreshStats()
    const h = setInterval(() => {
      refreshStats()
    }, 10000)
    // return () => {
    //   console.log('cleanup')
    //   clearInterval(h)
    // }
  }, [client, stats?.totalBurned])

  useEffect(() => {
    if (!client) {
      return
    }
    client.getAllParameters().then(p => setParameters(p))
  }, [client])

  useEffect(() => {
    setClient(apis({ web3, address }))
  }, [web3, address])
  useEffect(() => {
    if (!client || !client?.address) {
      return
    }
    client.checkIsAllowed().then(e => setCanExchange(e))
    const refresh = async () => {
      setUpdatingExchangeRate(true)
      await client.getCurrentExchangeRate().then(r => setExchangeRate(r))
      setUpdatingExchangeRate(false)
    }
    const handle = setInterval(refresh, 5000)
    return () => {
      clearInterval(handle)
    }
  }, [client])

  useEffect(() => {
    if (!inputValue) {
      return
    }
    setOutputValue(inputValue * exchangeRate * assetValueRate)
  }, [exchangeRate])

  useEffect(() => {
    if (!client?.address) {
      return
    }
    const decimals = parameters?.stablecoin?.decimals
    if (!decimals) {
      return
    }
    client.getExchangedAmount({ decimals }).then(a => {
      setExchangedAmount(a)
    })
  }, [client, parameters?.stablecoin?.decimals])

  useEffect(() => {
    if (!selectedAsset.key || !client || !client?.address) {
      return
    }
    client.getERC20Balance({ assetAddress: selectedAsset.key }).then(({ formatted, symbol }) => {
      // console.log(assetAddress, formatted)
      setUserBalanceFormatted(formatted)
      setAssetSymbol(symbol)
    })
  }, [selectedAsset.key, client])

  useEffect(() => {
    if (userBalanceFormatted === null || !inputValue) {
      return
    }
    if (!(parseFloat(inputValue) <= parseFloat(userBalanceFormatted))) {
      setInputError('amount exceeds your balance')
    } else {
      setInputError('')
    }
  }, [inputValue, userBalanceFormatted])

  useEffect(() => {
    if (!client?.address || !parameters?.stablecoin?.address) {
      return
    }
    client.getERC20Balance({ assetAddress: parameters.stablecoin.address }).then(({ formatted }) => setUserStablecoinBalanceFormatted(formatted))
  }, [client, parameters?.stablecoin?.address])

  useEffect(() => {
    if (!client || !parameters?.stablecoinHolder || !parameters?.stablecoin?.address) {
      return
    }
    client.getERC20Balance({ assetAddress: parameters.stablecoin.address, from: parameters.stablecoinHolder }).then(({ formatted }) => setTreasuryBalanceFormatted(formatted))
  }, [client, parameters?.stablecoin?.address, parameters?.stablecoinHolder])

  useEffect(() => {
    if (!client || !parameters?.stablecoin?.decimals) {
      return
    }
    client.getAssetValueRate({
      assetAddress: selectedAsset.key,
      stablecoinDecimals: parameters?.stablecoin?.decimals
    }).then(rate => setAssetValueRate(rate))
  }, [client, parameters?.stablecoin?.decimals, selectedAsset?.key])

  useEffect(() => {
    if (!client || !selectAssetVisible || !parameters?.stablecoin?.decimals) {
      return
    }
    async function f () {
      const keys = supportedAssets.map(e => e.key)
      const rates = await Promise.all(keys.map(k => client.getAssetValueRate({
        assetAddress: k,
        stablecoinDecimals: parameters?.stablecoin?.decimals
      })))
      setAssetValueRates(Object.fromEntries(keys.map((k, i) => [k, rates[i]])))
    }
    f()
  }, [client, selectAssetVisible, parameters?.stablecoin?.decimals])

  const qs = querystring.parse(location.search)
  if (!qs?.v) {
    window.location.href = `${window.location.pathname}?v=` + Date.now()
  }

  // console.log(assetValueRate)
  return (
    <>
      <Modal visible={tosVisible} style={{ maxWidth: '80%', width: 1200, margin: '0 auto' }}>
        <Title>Release for Horizon Bridge Hack</Title>
        <DescLeft>
          You ("User"), on behalf of User and User’s assigns, heirs, and estates (the “Releasing Party”) hereby generally release and forever discharge foundations, associations, operating companies and development companies for the Harmony ecosystem and their affiliates, and their respective past and present, core developers, validators, officers, directors, employees, shareholders, partners, agents, principals, managers, attorneys, contractors, contributors, insurers or indemnitors, parent corporations, direct and indirect subsidiaries, affiliates, predecessors, successors, assigns, heirs, and estates (the “Released Parties”), and each of them, separately and collectively, from any and all existing claims, liens, demands, causes of action, obligations, damages, and liabilities of any nature whatsoever, whether or not now known, suspected, or claimed, that the Releasing Party ever had, now has, or may claim to have had, including without limitation those arising from or relating to the Harmony Horizon Bridge Hack (the “Released Claims”). For the purposes of this Agreement, “Horizon Bridge Hack” means the conducting of unauthorized transactions on June 23, 2022, by a malicious third party on the Harmony Horizon bridge that resulted in the transfer of cryptocurrency asset tokens from the Harmony Horizon Bridge to the malicious actor’s wallet.
          <br />
          <br />
          User acknowledges and agrees that we (modulo.so and its affiliates, owners, employees, contractors) are not affiliated with the Released Parties and are the sole party providing the services on our platform as described herein. Nothing herein shall be construed as creating any obligation to User from the Released Parties, nor any agreement between the Released Parties and User, provided however, that User acknowledges and agrees that the Released Parties are intended third-party beneficiaries of this section and the release for the Horizon Bridge Hack contained herein. User further acknowledges and agrees that User shall have no rights in respect of any funds provided to us by the Released Parties to facilitate the development of our platform or delivery of its services or to otherwise enable any contribution made by us to the Harmony ecosystem.
        </DescLeft>
        <Row style={{ justifyContent: 'space-between' }}>
          <CancelButton onClick={() => {
            setTosVisible(false)
            setAgreedTos(false)
          }}
          >CANCEL
          </CancelButton>
          <Button onClick={() => {
            setTosVisible(false)
            setAgreedTos(true)
            Cookies.set('burner-agreed-tos', 'agreed')
          }}
          >I AGREE
          </Button>
        </Row>
      </Modal>
      <Modal visible={selectAssetVisible} style={{ maxWidth: '80%', width: 1200, margin: '0 auto' }}>
        <Title>Choose asset to burn</Title>
        <BaseText>Each asset's original market value at the time of the hack is marked below</BaseText>
        <DescLeft>
          <Row style={{ flexWrap: 'wrap' }}>
            {supportedAssets.map(({ key, label, icon }) => {
              return (
                <div key={key} style={{ display: 'inline-flex', alignItems: 'center', width: 256 }}>
                  <IconImg src={icon} style={{ width: 24 }} />
                  <LinkWrarpper
                    href='#' onClick={e => {
                      e.preventDefault()
                      setSelectedAsset({ key, label, icon })
                      setSelectAssetVisible(false)
                    }} style={{ marginLeft: 16 }}
                  >{label} {assetValueRates[key] ? <>(${assetValueRates[key]})</> : <></>}
                  </LinkWrarpper>
                </div>
              )
            })}
          </Row>
        </DescLeft>
      </Modal>
      <Container style={{ gap: 24 }}>
        <Col style={{ alignItems: 'center' }}>
          <Title style={{ margin: 0 }}>Harmony Recovery Portal</Title>

          <BaseText style={{ fontSize: 12, color: 'grey', transform: 'translateX(128px)' }}>by <LinkWrarpper href='https://modulo.so' target='_blank' style={{ color: 'grey' }}>modulo.so</LinkWrarpper></BaseText>
        </Col>
        <Desc>
          <BaseText style={{ fontSize: 14 }}>Burn depegged tokens such as USDC and 1ETH in exchange for <LinkWrarpper href='https://www.stably.io/post/usds-stablecoin-by-stably-launches-on-harmony/' target='_blank'>USDS</LinkWrarpper></BaseText>
        </Desc>
        {address && <BaseText>Your address: {address}</BaseText>}
        {address &&
          <FlexColumn style={{ gap: 32 }}>
            <Col>
              <Label>burn</Label>
              <Row style={{ gap: 0, position: 'relative' }}>
                <IconImg src={selectedAsset.icon} />
                <LinkWrarpper
                  href='#' onClick={e => {
                    e.preventDefault()
                    setSelectAssetVisible(true)
                  }} style={{ marginLeft: 16 }}
                >{selectedAsset.label}
                </LinkWrarpper>
                <Input disabled={!exchangeRate} $margin='8px' style={{ marginLeft: 24, marginRight: 8 }} value={inputValue} onChange={onInputChange} />
                {!exchangeRate && <TailSpin stroke='grey' width={16} height={16} />}
                {inputError ? <FloatingText $color='red'>{inputError}</FloatingText> : <></>}
              </Row>
            </Col>
            <Col>
              <Label>get</Label>
              <Row style={{ gap: 0 }}>
                <IconImg src={USDS} />
                <BaseText style={{ marginLeft: 16 }}>USDS</BaseText>
                <Input disabled={!exchangeRate} $margin='8px' style={{ marginLeft: 24, marginRight: 8 }} value={outputvalue} onChange={onOutputChange} />
                {!exchangeRate && <TailSpin stroke='grey' width={16} height={16} />}
              </Row>
            </Col>
            <Row style={{ justifyContent: 'center' }}>
              <SmallText style={{ color: 'grey' }}>current rate:</SmallText>
              {(exchangeRate || !updatingExchangeRate) ? <SmallText style={{ color: 'grey' }}>1.0 {selectedAsset.label} ≈ {exchangeRate * assetValueRate} USDS</SmallText> : <TailSpin stroke='grey' width={16} height={16} />}
            </Row>
            <Row style={{ justifyContent: 'center' }}>
              <input
                type='checkbox' checked={agreedTos} onClick={() => {
                  setAgreedTos(e => !e)
                  // if (!agreedTos) {
                  //   setTosVisible(true)
                  // } else {
                  //   setAgreedTos(false)
                  // }
                }}
              /> <SmallText style={{ color: 'grey' }}>I agree to <LinkWrarpper href='#' onClick={() => setTosVisible(true)}> the terms of services</LinkWrarpper></SmallText>
            </Row>
            <Row style={{ justifyContent: 'center' }}>
              <Button onClick={exchange} disabled={burning || inputError || !exchangeRate || inputValue === 0}>BURN</Button>
            </Row>
          </FlexColumn>}
        {!address && <Button onClick={connect} style={{ width: 'auto' }}>CONNECT METAMASK</Button>}
        {stats.totalBurned &&
          <Desc>
            <Title>Statistics</Title>
            <Row style={{ alignItems: 'start' }}>
              <Label style={{ width: 128 }}>total burned</Label>
              <Col>

                {Object.entries(stats.totalBurned).map(([symbol, amountFormatted], i) => {
                  // return amountFormatted > 0 ? <React.Fragment key={symbol}><BaseText>{(amountFormatted || 0).toFixed(3)}</BaseText> <Label>{symbol}</Label></React.Fragment> : <></>
                  return <Row key={symbol} style={{ whiteSpace: 'nowrap' }}><BaseText>{(amountFormatted || 0).toFixed(3)}</BaseText> <Label>{symbol}</Label></Row>
                })}
              </Col>
            </Row>
            <Row>
              <Label>total disbursed</Label>
              {Object.entries(stats.totalStablecoinDisbursed).map(([symbol, amountFormatted]) => {
                return <React.Fragment key={symbol}><BaseText>{(amountFormatted || 0).toFixed(3)}</BaseText> <Label>{symbol}</Label></React.Fragment>
              })}
            </Row>
            <Row>
              <Label>last update time</Label>
              <BaseText>{new Date(stats.time * 1000).toLocaleString()}</BaseText>
            </Row>
          </Desc>}
        {!parameters.initializing &&
          <DescLeft style={{ margin: '0 auto', width: 'auto' }}>
            <Title>Technical Data</Title>
            <Row>
              <Label>current minimum rate</Label>
              <BaseText>{parameters.minRate}</BaseText>
              <Label style={{ marginLeft: 24 }}>maximum rate</Label>
              <BaseText>{parameters.maxRate}</BaseText>
            </Row>
            <Row>
              <Label>last exchange</Label>
              <BaseText>{new Date(parameters.lastResetTimestamp).toLocaleString()}</BaseText>
            </Row>
            <Row>
              <Label>per wallet exchange limit</Label>
              <BaseText>{parameters.perUserLimitAmount} USDS</BaseText>
            </Row>
            <Row>
              <Label>rate resets threshold</Label>
              <BaseText>{parameters.resetThresholdAmount} USDS</BaseText>
            </Row>
            <Row>
              <Label>estimated exchange rate in 30m</Label>
              <BaseText>{estimateRate(60 * 1000 * 30)}</BaseText>
            </Row>
            <Row>
              <Label>in 1h</Label>
              <BaseText>{estimateRate(60 * 1000 * 60)}</BaseText>
              <Label>in 2h</Label>
              <BaseText>{estimateRate(60 * 1000 * 120)}</BaseText>
              <Label>in 3h</Label>
              <BaseText>{estimateRate(60 * 1000 * 180)}</BaseText>
            </Row>
            <Row>
              <Label>your balance</Label>
              <BaseText>{userStablecoinBalanceFormatted.toFixed(2)} USDS</BaseText>
              <Label>/</Label>
              <BaseText>{userBalanceFormatted.toFixed(2)} {assetSymbol}</BaseText>
            </Row>
            <Row>
              <Label>recovery fund</Label>
              <BaseText><LinkWrarpper href={`https://explorer.harmony.one/address/${parameters.stablecoinHolder}`} target='_blank'>{parameters.stablecoinHolder}</LinkWrarpper></BaseText>
            </Row>
            <Row>
              <Label>recovery fund balance</Label>
              <BaseText>{treasuryBalanceFormatted.toFixed(2)} USDS</BaseText>
            </Row>
            <Row>
              <Label>burner contract</Label>
              <BaseText><LinkWrarpper href={`https://explorer.harmony.one/address/${config.burnerContract}`} target='_blank'>{config.burnerContract}</LinkWrarpper></BaseText>
            </Row>
            {config.previousBurnerContracts?.length > 0 &&
              <Row>
                <Label>previous burner contracts</Label>
              </Row>}
            {config.previousBurnerContracts.map(c => {
              return (
                <Row key={c}>
                  <BaseText><LinkWrarpper href={`https://explorer.harmony.one/address/${c}`} target='_blank'>{c}</LinkWrarpper></BaseText>
                </Row>
              )
            })}
          </DescLeft>}
        <DescLeft>
          <Title>FAQ</Title>
          <QA>
            <BaseText>Q: How do I burn something other than USDC?</BaseText>
            <BaseText>A: In the next round (end of Oct 2022) we will add more token types</BaseText>
          </QA>
          <QA>
            <BaseText>Q: How is the rate determined?</BaseText>
            <BaseText>A: It is dynamically computed based on how much and how often other people are making the exchanges. There is a minimum and a maximum rate, updated by us every two weeks. Within this range, the rate automatically decreases when some tokens get burned, and automatically resets to minimum when a threshold is reached. The rate also automatically goes up over time until it reaches the maximum. If you are not happy for the rate right now, you could wait for rate to go up later, but there is a bi-weekly limit of USDS available for exchange, so it is possible that all available USDS will be gone before you can get a rate that you want, and you would have to wait for the next bi-weekly round. For more information, checkout our <LinkWrarpper href='https://github.com/polymorpher/burner' target='_blank'> GitHub </LinkWrarpper> </BaseText>
          </QA>
          <QA>
            <BaseText>Q: Can I review the contract and the website's source code?</BaseText>
            <BaseText>A: Here is <LinkWrarpper href='https://github.com/polymorpher/burner/blob/main/contract/contracts/Burner.sol' target='_blank'>the contract</LinkWrarpper>. See above link for code repository</BaseText>
          </QA>
          <QA>
            <BaseText>Q: Where can I go to get help, or to make suggestions?</BaseText>
            <BaseText>A: Please use the <LinkWrarpper href='https://github.com/polymorpher/burner/issues/' target='_blank'>GitHub issue page</LinkWrarpper>.</BaseText>
          </QA>
        </DescLeft>
      </Container>
    </>
  )
}

export default Burn
