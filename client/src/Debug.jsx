import React, { useEffect, useState } from 'react'
import Web3 from 'web3'
import detectEthereumProvider from '@metamask/detect-provider'
import config from '../config'
import { Button, FloatingSwitch, FloatingText, Input, LinkWrarpper } from './components/Controls'
import { BaseText, Desc, DescLeft, SmallText, Title } from './components/Text'
import { Col, FlexColumn, FlexRow, Main, Row } from './components/Layout'
import styled from 'styled-components'

import { toast } from 'react-toastify'
import apis from './api'

const Container = styled(Main)`
  margin: 0 auto;
  max-width: 600px;
  padding-top: 64px;
`

const Debug = () => {
  const [web3, setWeb3] = useState()
  const [provider, setProvider] = useState()
  const [address, setAddress] = useState()
  const [inputValue, setInputvalue] = useState(0)
  const [fakeUSDCInputValue, setFakeUSDCInputvalue] = useState(0)
  const [usdcBalanceFormatted, setUsdcBalanceFormatted] = useState(0)
  const [usdsBalanceFormatted, setUsdsBalanceFormatted] = useState(0)
  const [client, setClient] = useState(apis({}))
  const [parameters, setParameters] = useState(apis({}))
  const [assetAddress] = useState(config.supportedAssets[0])

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

  const onInputChange = ({ target: { value } }) => {
    setInputvalue(value)
  }
  const onFakeUSDCInputChange = ({ target: { value } }) => {
    setFakeUSDCInputvalue(value)
  }

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    setClient(apis({ web3, address }))
  }, [web3, address])

  useEffect(() => {
    const stablecoin = parameters?.stablecoin?.address
    if (!client?.address || !stablecoin) {
      return
    }
    client.getERC20Balance({ assetAddress: stablecoin }).then(({ formatted }) => setUsdsBalanceFormatted(formatted))
    client.getERC20Balance({ assetAddress }).then(({ formatted }) => setUsdcBalanceFormatted(formatted))
  }, [client, parameters?.stablecoin?.address])

  useEffect(() => {
    if (!client) {
      return
    }
    client._getApprvalAmount().then(a => setInputvalue(a))
    client.getAllParameters().then(p => setParameters(p))
  }, [client])

  const onApprove = async () => {
    try {
      const tx = await client._approveStablecoin({ amountFormatted: inputValue })
      if (!tx) {
        return toast.error('Failed to approve')
      }
      console.log(tx)
      const { transactionHash } = tx
      toast.success(
        <FlexRow>
          <BaseText style={{ marginRight: 8 }}>Done!</BaseText>
          <LinkWrarpper target='_blank' href={client.getExplorerUri(transactionHash)}>
            <BaseText>View transaction</BaseText>
          </LinkWrarpper>
        </FlexRow>)
    } catch (ex) {
      console.error(ex)
      toast.error('Had error during approval: ', ex.toString())
    }
  }

  const getFakeAsset = async () => {
    try {
      const tx = await client._getFakeAsset({ assetAddress, amountFormatted: fakeUSDCInputValue })
      if (!tx) {
        return toast.error('Failed to mint fake asset')
      }
      console.log(tx)
      const { transactionHash } = tx
      toast.success(
        <FlexRow>
          <BaseText style={{ marginRight: 8 }}>Done!</BaseText>
          <LinkWrarpper target='_blank' href={client.getExplorerUri(transactionHash)}>
            <BaseText>View transaction</BaseText>
          </LinkWrarpper>
        </FlexRow>)
    } catch (ex) {
      console.error(ex)
      toast.error('Had error during approval: ', ex.toString())
    }
  }

  return (
    <Container style={{ gap: 24 }}>
      <Col style={{ alignItems: 'center' }}>
        <Title style={{ margin: 0 }}>Harmony Recovery Debugger</Title>
        <BaseText style={{ fontSize: 12, color: 'grey', transform: 'translateX(128px)' }}>by <LinkWrarpper href='https://modulo.so' target='_blank' style={{ color: 'grey' }}>modulo.so</LinkWrarpper></BaseText>
      </Col>
      {address && <BaseText>Your address: {address}</BaseText>}
      {address &&
        <Desc>
          <BaseText>burner authorized stablecoin amount</BaseText>
          <Input $margin='16px' value={inputValue} onChange={onInputChange} />
          <Button onClick={onApprove}>APPROVE</Button>
          <BaseText>Treasury: {parameters?.stablecoinHolder}</BaseText>
        </Desc>}
      {!address && <Button onClick={connect} style={{ width: 'auto' }}>CONNECT METAMASK</Button>}
      {address && config.debug &&
        <Desc>
          <BaseText>get fake USDC</BaseText>
          <Input $margin='16px' value={fakeUSDCInputValue} onChange={onFakeUSDCInputChange} />
          <Button onClick={getFakeAsset} style={{ width: 'auto' }}>GET FAKE USDC</Button>
        </Desc>}
      {address && config.debug &&
        <Desc>
          <BaseText>You have {usdcBalanceFormatted} Fake USDC (FUSDC)</BaseText>
          <BaseText>You have {usdsBalanceFormatted} Fake USD Coin (FUSDS)</BaseText>
        </Desc>}
      {address && !config.debug &&
        <Desc>
          <BaseText>You have {usdcBalanceFormatted} 1USDC</BaseText>
          <BaseText>You have {usdsBalanceFormatted} USD Coin</BaseText>
        </Desc>}
    </Container>
  )
}

export default Debug
