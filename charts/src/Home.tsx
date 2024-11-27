import React, { createRef, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import {
  DistStablecoinReceived, DistStablecoinReceivedWalletAge,
  DistWalletAge, PlotLineBurnAmountOverTime, PlotLineBurnEfficiencyOverTime, PlotLineBurnTxOverTime,
  PlotLineStablecoinReceivedOverTime
} from './Charts'
import { Col, Main, Row } from './components/Layout'
import {
  computeNumWallets,
  computePercentileBurnTime, computePercentilesStablecoinReceived,
  computePercentileStablecoinDisburseTime, computePercentileWalletAges,
  computeStablecoinReceivedPerGroup, computeWalletTypes, type PercentileReport
} from './Metrics'
import { BaseText, Desc, DescLeft, Title } from './components/Text'
import { Events, Wallets } from './Data'
import { Button } from './components/Controls'

const Container = styled(Main)`
  margin: 0 auto;
  padding: 0 16px;
  max-width: 900px;
`

interface PercentileDisplayProps {
  report: PercentileReport
  title: string
  desc: string
  decimals?: number
  transformer?: (number, string?) => any
}

interface KeyValueDisplayProps {
  kv: Record<string, number>
  title: string
  desc: string
  decimals?: number
}

const KeyValueDisplay = ({ kv, title, desc, decimals = 2 }: KeyValueDisplayProps): React.FC => {
  return <DescLeft>
    <Title style={{ marginLeft: 0 }}>{title}</Title>
    <BaseText>{desc}</BaseText>
    <Row style={{ gap: 48, justifyContent: 'center' }}>
      {Object.entries(kv).map(([k, v]) => {
        return <BaseText key={k}><Col>{k}</Col> <Col>{v.toFixed(decimals)}</Col></BaseText>
      })}
    </Row>
  </DescLeft>
}
const PercentileDisplay = ({ report, title, desc, decimals = 2, transformer = v => v.toFixed(decimals ?? 2) }: PercentileDisplayProps): React.FC => {
  report = Object.fromEntries(Object.entries(report).filter(([,v]) => v).map(([k, v]) => [k, transformer(v, k)])) as PercentileReport

  return <DescLeft>
    <Title style={{ marginLeft: 0 }}>{title}</Title>
    <BaseText>{desc}</BaseText>
    {report.avg && <BaseText>Average: {report.avg}</BaseText>}
    <BaseText>Percentiles:</BaseText>
    <Row style={{ gap: 48 }}>
      <BaseText><Col>10%</Col> <Col>{report['10']}</Col></BaseText>
      <BaseText><Col>25%</Col> <Col>{report['25']}</Col></BaseText>
      <BaseText><Col>50%</Col> <Col>{report['50']}</Col></BaseText>
      <BaseText><Col>75%</Col> <Col>{report['75']}</Col></BaseText>
      <BaseText><Col>90%</Col> <Col>{report['90']}</Col></BaseText>
    </Row>

  </DescLeft>
}

const ROUND_CONTRACTS = {
  19: ['0xa9E55fDae2E5f1e88a931e2F4f82Df43EeD8C715', '0x98040362FC708f80d87108fCDE7dc31DD305Ad74'].map(e => e.toLowerCase()),
  18: ['0x86574B1E22cf13a8dC02b1c6599E5EF21033334E', '0x254FF07D102c9EeAB30530578B7135208b8DDfF7', '0x4064AD4f7513EDa1C4ebd4BAD637284dd8af6eF1'].map(e => e.toLowerCase()),
  17: ['0x66a57F53CEB46De83313c23861739dF6E1Dfff93', '0xCF76620cD2AbBDdbd7cD3b3913B13A5600B30C58', '0x607e0e650D70dc2F54855d5F81C18A7E97bAf14a', '0x6d6481e80e894e0F545B060e2AaFaC3C46473094', '0xbCD9daB28Ce59D3Df3e96FEF3EFa5A8aB1f74b96', '0x219Cf0eA0cddb9770c2b9AA31426712347342E14', '0x5F8bA450A4326818b0f670257CcA762C012fa6DA', '0xF7Ed30D0a030662Ca28242816a8fd92C20b424d5', '0x7781b3686079F3286Aa490E4a7aeC36Fa1896837', '0x42D2c66F9D934f6bEA4815DB5f280C211CAFF80C'].map(e => e.toLowerCase()),
  16: ['0x7a2D7513f5fCaaD2cf2e3438CbCb786474d9fE4D', '0x161aBCDE65c76Ae3489A0732386b0e5041334261', '0x24E4F1f87A53FeC0EE05f5e392332d55b97A2FF6'].map(e => e.toLowerCase()),
  14: '0xc9aFd7b4f658EA3B56bCA685C66F5Ed2eB018BF4'.toLowerCase(),
  13: '0x6Cffea1d811d96C52750D23D9f49B3868F036E8B'.toLowerCase(),
  12: '0x4684C204DD149C679B4ABfF3A4e7d19C34a4EDE4'.toLowerCase(),
  11: '0x8Ba8fa550861fCA4615a82E2bc9cf9C197Cd54ec'.toLowerCase(),
  10: '0x3023dB7206a05d46F1b4A6CF4F8d6183aCD78051'.toLowerCase(),
  9: '0x5f2d3CDCF69bFdBCc480F407b0a0E92D683a200b'.toLowerCase(),
  8: '0x31a67DDeE24bCdFA04745DBC6955d92f8F5512dA'.toLowerCase(),
  7: '0x4F73aC44EB143834e8D609aEa07C86470CEea75a'.toLowerCase(),
  6: '0xc8D772b9c504697B30E950374751E81e9E628BD6'.toLowerCase(),
  5: '0x6CAABebD4d1250E38a189D164AA5f32389e5D1C1'.toLowerCase()
}

const getSelectedRound = (): string => {
  const parts = window.location.pathname.split('/')
  const last = parts[parts.length - 1]
  // eslint-disable-next-line no-self-compare
  if (Number(last) !== Number(last)) {
    return ''
  }
  return last
}

const getRoundContract = (round): null | string | string[] => {
  if (!round) {
    return null
  }
  return ROUND_CONTRACTS[round.toString()] ?? null
}

const RButton = styled(Button)`
  width: 80px;
`

const Home = (): React.FC => {
  const [round, setRound] = useState(getSelectedRound())
  const contractFilter = getRoundContract(round)
  useEffect(() => {
    if (round && !contractFilter) {
      history.pushState({}, '', '/')
    }
  }, [round, contractFilter])

  const events = useMemo(() => {
    if (!contractFilter) {
      return Events
    }
    if (typeof contractFilter === 'string') {
      return Events.filter(e => e.burner.toLowerCase() === contractFilter)
    } else {
      return Events.filter(e => contractFilter.includes(e.burner.toLowerCase()))
    }
  }, [contractFilter])

  const metrics = useMemo(() => {
    return ({
      PercentileBurnTime: computePercentileBurnTime(events),
      PercentileStablecoinDisburseTime: computePercentileStablecoinDisburseTime(events),
      StablecoinReceivedPerGroup: computeStablecoinReceivedPerGroup(events, Wallets),
      PercentileWalletAges: computePercentileWalletAges(Wallets),
      PercentilesStablecoinReceived: computePercentilesStablecoinReceived(events),
      NumWallets: computeNumWallets(events),
      WalletTypes: computeWalletTypes(events, Wallets)
    })
  }, [events])
  const redirect = (r) => (): void => {
    setRound(r.toString())
    history.pushState({}, '', `/${r}`)
  }
  return <Container>
    <Row style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap', position: 'fixed', maxWidth: 800, zIndex: 10, background: '#fff', padding: 16 }}>
      <RButton $selected={!contractFilter} onClick={redirect('')}>ALL</RButton>
      <RButton $selected={round === '5'} onClick={redirect(5)}>R5</RButton>
      <RButton $selected={round === '6'} onClick={redirect(6)}>R6</RButton>
      <RButton $selected={round === '7'} onClick={redirect(7)}>R7</RButton>
      <RButton $selected={round === '8'} onClick={redirect(8)}>R8</RButton>
      <RButton $selected={round === '9'} onClick={redirect(9)}>R9</RButton>
      <RButton $selected={round === '10'} onClick={redirect(10)}>R10</RButton>
      <RButton $selected={round === '11'} onClick={redirect(11)}>R11</RButton>
      <RButton $selected={round === '12'} onClick={redirect(12)}>R12</RButton>
      <RButton $selected={round === '13'} onClick={redirect(13)}>R13</RButton>
      <RButton $selected={round === '14'} onClick={redirect(14)}>R14</RButton>
      <RButton $selected={round === '16'} onClick={redirect(16)}>R16</RButton>
      <RButton $selected={round === '17'} onClick={redirect(17)}>R17</RButton>
      <RButton $selected={round === '18'} onClick={redirect(18)}>R18</RButton>
    </Row>
    <div style={{ padding: 64 }}/>
    <KeyValueDisplay title={'Stablecoin Received Per Wallet Group'} desc={'Wallets are divided into three groups: (1) pre-hacked, those wallets created before the time when the bridge hack took place (2022-06-23T11:06:46.000Z); (2) pre-recovery, meaning those wallets created within 100 days after the time of the bridge hack; and (3) post-recovery, covering all the rest of the wallets'} kv={metrics.StablecoinReceivedPerGroup}/>
    <DescLeft>
      <BaseText>{metrics.NumWallets} wallets participated | {metrics.WalletTypes.eoa} EOA wallets, {metrics.WalletTypes.sc} smart contract wallets (or bots)</BaseText>
    </DescLeft>
    <DistStablecoinReceivedWalletAge events={events} wallets={Wallets}/>
    <PercentileDisplay title={'Stablecoin Received Per Wallet'} desc={'The total amount of stablecoin received by each user across selected recovery round(s)'} report={metrics.PercentilesStablecoinReceived}/>
    <DistStablecoinReceived events={events} wallets={Wallets}/>
    <PercentileDisplay title={'Wallet Age'} desc={'Age is defined by the number of days elapsed since the time when the first transaction of the wallet was executed. For smart contract wallet, the first transaction is when the contract was deployed'} report={metrics.PercentileWalletAges}/>
    <DistWalletAge events={events} wallets={Wallets}/>
    <PercentileDisplay title={'Stablecoin Disbursements'} desc={'The timestamps when the given percentage of stablecoin in the selected round(s) finishes being disbursed'} report={metrics.PercentileStablecoinDisburseTime} transformer={v => new Date(v).toLocaleString()}/>
    <PlotLineStablecoinReceivedOverTime events={events} wallets={Wallets}/>
    <PercentileDisplay title={'Burn Transactions'} desc={'The timestamps when the given percentage of burn transactions in the selected round(s) are completed'} report={metrics.PercentileBurnTime} transformer={v => new Date(v).toLocaleString()}/>
    <PlotLineBurnTxOverTime events={events} wallets={Wallets}/>
    <PlotLineBurnAmountOverTime events={events} wallets={Wallets}/>
    <PlotLineBurnEfficiencyOverTime events={events} wallets={Wallets}/>
  </Container>
}

export default Home
