import React, { useEffect, useState } from 'react'
import Web3 from 'web3'
import detectEthereumProvider from '@metamask/detect-provider'
import config from '../config'
import { Button, FloatingSwitch, FloatingText, Input, LinkWrarpper } from './components/Controls'
import { BaseText, Desc, DescLeft, SmallText, Title } from './components/Text'
import { Col, FlexColumn, FlexRow, Main, Row } from './components/Layout'
import styled from 'styled-components'
import USDC from '../assets/tokens/usdc.svg'
import USDS from '../assets/tokens/usds.png'
import { toast } from 'react-toastify'
import apis from './api'
import { TailSpin } from 'react-loading-icons'

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
  const [web3, setWeb3] = useState()
  const [provider, setProvider] = useState()
  const [address, setAddress] = useState()
  const [inputValue, setInputvalue] = useState(0)
  const [inputError, setInputError] = useState('')
  const [outputvalue, setOutputValue] = useState(0)
  const [parameters, setParameters] = useState({ initializing: true })
  const [exchangeRate, setExchangeRate] = useState(0)
  const [client, setClient] = useState(apis({}))
  const [assetAddress] = useState(config.supportedAssets[0])
  const [canExchange, setCanExchange] = useState(false)
  const [exchangedAmount, setExchangedAmount] = useState(0)
  const [userBalanceFormatted, setUserBalanceFormatted] = useState(0)
  const [userStablecoinBalanceFormatted, setUserStablecoinBalanceFormatted] = useState(0)
  const [treasuryBalanceFormatted, setTreasuryBalanceFormatted] = useState(0)
  const [assetSymbol, setAssetSymbol] = useState(null)
  const [updatingExchangeRate, setUpdatingExchangeRate] = useState(false)
  const [burning, setBurning] = useState(false)

  // console.log(parameters)

  async function init () {
    const provider = await detectEthereumProvider()
    setProvider(provider)
    setWeb3(new Web3(provider))
  }

  const connect = async () => {
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
      console.error(ex)
    }
  }

  const exchange = async () => {
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
    const { formatted: userFormattedBalance } = await client.getERC20Balance({ assetAddress })
    if (!(userFormattedBalance > burnAmountFormatted)) {
      return toast.error('You do not have sufficient asset to burn. Please adjust the amount')
    }
    try {
      setBurning(true)
      const approvalTx = await client.approve({
        assetAddress,
        burnAmountFormatted,
        onFailed: ex => toast.error(`Failed to approve burner to act on your behalf. Error: ${ex.toString()}`)
      })
      if (!approvalTx) {
        return
      }
      await client.exchange({
        assetAddress,
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
    setOutputValue(value * exchangeRate)
  }
  const onOutputChange = ({ target: { value } }) => {
    setOutputValue(value)
    setInputvalue(value / exchangeRate)
  }

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    setClient(apis({ web3, address }))
    apis({ web3, address })
  }, [web3, address])
  useEffect(() => {
    if (!client) {
      return
    }
    client.getAllParameters().then(p => setParameters(p))
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
    setOutputValue(inputValue * exchangeRate)
  }, [exchangeRate])

  useEffect(() => {
    const decimals = parameters?.stablecoin?.decimals
    if (!decimals) {
      return
    }
    client.getExchangedAmount({ decimals }).then(a => {
      setExchangedAmount(a)
    })
  }, [parameters?.stablecoin?.decimals])

  useEffect(() => {
    if (!assetAddress || !client) {
      return
    }
    client.getERC20Balance({ assetAddress }).then(({ formatted, symbol }) => {
      // console.log(assetAddress, formatted)
      setUserBalanceFormatted(formatted)
      setAssetSymbol(symbol)
    })
  }, [assetAddress, client])

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
    if (!parameters?.stablecoinHolder || !parameters?.stablecoin?.address) {
      return
    }
    client.getERC20Balance({ assetAddress: parameters.stablecoin.address }).then(({ formatted }) => setUserStablecoinBalanceFormatted(formatted))
    client.getERC20Balance({ assetAddress: parameters.stablecoin.address, from: parameters.stablecoinHolder }).then(({ formatted }) => setTreasuryBalanceFormatted(formatted))
  }, [parameters?.stablecoin?.address, parameters?.stablecoinHolder])
  return (
    <Container style={{ gap: 24 }}>
      <Col style={{ alignItems: 'center' }}>
        <Title style={{ margin: 0 }}>Harmony Recovery Portal</Title>

        <BaseText style={{ fontSize: 12, color: 'grey', transform: 'translateX(128px)' }}>by <LinkWrarpper href='https://modulo.so' target='_blank' style={{ color: 'grey' }}>modulo.so</LinkWrarpper></BaseText>
      </Col>
      <Desc>
        <BaseText>Burn depegged tokens such as USDC in exchange for <LinkWrarpper href='https://www.stably.io/post/usds-stablecoin-by-stably-launches-on-harmony/' target='_blank'>USDS</LinkWrarpper></BaseText>
      </Desc>
      {address && <BaseText>Your address: {address}</BaseText>}
      {address &&
        <FlexColumn style={{ gap: 32 }}>
          <Col>
            <Label>burn</Label>
            <Row style={{ gap: 0, position: 'relative' }}>
              <IconImg src={USDC} />
              <LinkWrarpper href='#' onClick={e => e.preventDefault()} style={{ marginLeft: 16, cursor: 'not-allowed' }}>USDC</LinkWrarpper>
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
            {(exchangeRate || !updatingExchangeRate) ? <SmallText style={{ color: 'grey' }}>1.0 1USDC ≈ {exchangeRate} USDS</SmallText> : <TailSpin stroke='grey' width={16} height={16} />}
          </Row>
          <Row style={{ justifyContent: 'center' }}>
            <Button onClick={exchange} disabled={burning || inputError || !exchangeRate || inputValue === 0}>BURN</Button>
          </Row>
        </FlexColumn>}
      {!address && <Button onClick={connect} style={{ width: 'auto' }}>CONNECT METAMASK</Button>}
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
  )
}

export default Burn
