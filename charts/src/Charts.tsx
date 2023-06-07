import React, { useEffect, useRef } from 'react'
import { computeBurnAmount, normalizeStablecoinAmount } from './Data'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import groupBy from 'lodash-es/groupBy'
import { type EventLog, type Wallet } from '../../stats/types'
import sum from 'lodash-es/sum'
import countBy from 'lodash-es/countBy'
import sortBy from 'lodash-es/sortBy'

interface ChartProps {
  events: EventLog[]
  wallets: Wallet[]
  [key: string]: any
}
export const DistStablecoinReceived = ({ events, wallets, ...props }: ChartProps): React.FC => {
  const chartComponentRef = useRef<HighchartsReact.RefObject>(null)
  const walletAndTransactions = groupBy(events, (e: EventLog) => e.user.toLowerCase())
  const rawData: number[] = Object.entries(walletAndTransactions).map(([, txs]) =>
    sum((txs as EventLog[]).map(e => normalizeStablecoinAmount(e.stablecoinAmount)))
  )
  const data = countBy(rawData, (e: number) => {
    if (e < 100) {
      return '0-100'
    }
    if (e < 250) {
      return '100-250'
    }
    if (e < 500) {
      return '250-500'
    }
    if (e < 1000) {
      return '500-1000'
    }
    if (e < 2000) {
      return '1000-2000'
    }
    if (e < 5000) {
      return '2000-5000'
    }
    return '5000+'
  })
  const keys = ['0-100', '100-250', '250-500', '500-1000', '1000-2000', '2000-5000', '5000+']
  const options = {
    title: { text: 'Amount of Recovery Funds Received By Users' },
    xAxis: [{ title: { text: 'Amount of Stablecoins' }, categories: keys }],
    yAxis: [{ title: { text: 'Number of Wallets' } }],
    series: [{
      name: 'Wallet Count',
      type: 'column',
      data: keys.map(k => data[k] ?? 0)
    }],
    credits: { enabled: false }
  }
  useEffect(() => {
    chartComponentRef?.current.chart.redraw()
  }, [events, wallets])
  return (
    <HighchartsReact
        containerProps={{ style: { width: '100%' } }}
            highcharts={Highcharts}
            options={options}
            ref={chartComponentRef}
            {...props}
        />
  )
}

export const DistWalletAge = ({ events, wallets, ...props }: ChartProps): React.FC => {
  const chartComponentRef = useRef<HighchartsReact.RefObject>(null)
  const now = Math.floor(Date.now() / 1000)
  const agesInDays = wallets.map(e => (now - e.createdAt) / 86400)
  const labeledData = countBy(agesInDays, (e: number) => {
    const n = Math.floor(e / 90)
    if (n >= 8) {
      return '24:24+'
    }
    return `${n.toString().padStart(2, '0')}:${(n * 3).toString()} - ${((n + 1) * 3).toString()}`
  })
  const entries = sortBy(Object.entries(labeledData), e => e[0])
  const keys = entries.map(e => e[0].slice(3))
  const values = entries.map(e => e[1])
  const options = {
    title: { text: 'Wallet Age of Users Received Stablecoins' },
    xAxis: [{ title: { text: 'Number of Months' }, categories: keys }],
    yAxis: [{ title: { text: 'Number of Wallets' } }],
    series: [{
      name: 'Wallet Count',
      type: 'column',
      data: values
    }],
    credits: { enabled: false }
  }
  useEffect(() => {
    chartComponentRef?.current.chart.redraw()
  }, [events, wallets])
  return (
    <HighchartsReact
        containerProps={{ style: { width: '100%' } }}
          highcharts={Highcharts}
          options={options}
          ref={chartComponentRef}
          {...props}
      />
  )
}

export const DistStablecoinReceivedWalletAge = ({ events, wallets, ...props }: ChartProps): React.FC => {
  const chartComponentRef = useRef<HighchartsReact.RefObject>(null)
  const walletAndTransactions = groupBy(events, (e: EventLog) => e.user.toLowerCase())
  const walletToSum: Array<[string, number]> = Object.entries(walletAndTransactions).map(([user, txs]) =>
    [user.toLowerCase(), sum((txs as EventLog[]).map(e => normalizeStablecoinAmount(e.stablecoinAmount)))]
  )
  const now = Math.floor(Date.now() / 1000)
  const walletToAge = Object.fromEntries(wallets.map(e => [e.address.toLowerCase(), (now - e.createdAt) / 86400]))
  const ageAndSum = walletToSum.map(([address, sum]) => [walletToAge[address], sum])
  const groupedAgeAndSum = groupBy(ageAndSum, ([age]) => {
    const months = Math.floor(age / 30)
    if (months > 24) {
      return '24+'
    }
    return months.toString()
  })
  const aggAgeAndAggSum: Array<[string, number]> = Object.entries(groupedAgeAndSum)
    .map(([months, group]) => [months, sum((group as Array<[number, number]>).map(e => e[1]))])
  const keys = aggAgeAndAggSum.map(e => e[0])

  const options = {
    title: { text: 'Wallet Age of Users Received Stablecoins' },
    xAxis: [{ title: { text: 'Wallet Age (months)' }, categories: keys }],
    yAxis: [{ title: { text: 'Stablecoins Received' } }],
    series: [{
      name: 'Stablecoin Received v. Wallet Age',
      type: 'column',
      data: aggAgeAndAggSum,
      // eslint-disable-next-line no-template-curly-in-string
      tooltip: { pointFormat: 'wallet age: <b>{point.x} months</b><br/>total stablecoins received: <b>${point.y}</b><br/>', valueDecimals: 0 },
      marker: { radius: 2 }
    }],
    credits: { enabled: false }
  }
  useEffect(() => {
    chartComponentRef?.current.chart.redraw()
  }, [events, wallets])
  return (
    <HighchartsReact
        containerProps={{ style: { width: '100%' } }}
          highcharts={Highcharts}
          options={options}
          ref={chartComponentRef}
          {...props}
      />
  )
}

export const PlotLineStablecoinReceivedOverTime = ({ events, wallets, ...props }: ChartProps): React.FC => {
  const chartComponentRef = useRef<HighchartsReact.RefObject>(null)

  const series = sortBy(events, (e: EventLog) => Number(e.ts))
    .map(e => ({ ts: Number(e.ts), amount: normalizeStablecoinAmount(e.stablecoinAmount) }))
  const bucketed = Object.entries(groupBy(series, e => Math.floor(e.ts / 86400).toString()))
  const agged: Array<[number, number]> = bucketed.map(([day, bucket]) => [Number(day), sum((bucket as any).map(e => e.amount))])
  let s = 0
  const aggedCumu = agged.map(([day, v]) => [day * 86400 * 1000, (s += v)])
  const options = {
    title: { text: 'Stablecoins Disbursed Over Time' },
    xAxis: [{
      title: { text: 'Time' },
      type: 'datetime',
      labels: { format: '{value:%Y-%m-%d}' }
    }],
    yAxis: [{ title: { text: 'Stablecoins Disbursed' } }],
    series: [{
      name: 'Stablecoin Disbursed v. Time',
      // type: 'line',
      data: aggedCumu, // .map(e => e[1]),
      // eslint-disable-next-line no-template-curly-in-string
      tooltip: { pointFormat: 'Total Disbursed <b>${point.y}</b>', valueDecimals: 0 }

      // marker: { radius: 2 }
    }],
    credits: { enabled: false }
  }
  useEffect(() => {
    chartComponentRef?.current.chart.redraw()
  }, [events, wallets])
  return (
    <HighchartsReact
        containerProps={{ style: { width: '100%' } }}
        highcharts={Highcharts}
        options={options}
        ref={chartComponentRef}
        {...props}
      />
  )
}

export const PlotLineBurnTxOverTime = ({ events, wallets, ...props }: ChartProps): React.FC => {
  const chartComponentRef = useRef<HighchartsReact.RefObject>(null)

  const series: number[] = sortBy(events.map(e => ({ ts: Number(e.ts) })))
  const agged = sortBy(
    Object.entries(countBy(series, e => Math.floor(e.ts / 86400).toString()))
      .map(([day, count]) => [Number(day), count]),
    e => e[0])
  let s = 0
  const aggedCumu = agged.map(([day, v]) => [day * 86400 * 1000, (s += v)])
  const options = {
    title: { text: 'Burn Transactions Over Time' },
    xAxis: [{
      title: { text: 'Time' },
      type: 'datetime',
      labels: { format: '{value:%Y-%m-%d}' }
    }],
    yAxis: [{ title: { text: '# Txs' } }],
    series: [{
      name: 'Burn Transactions v. Time',
      data: aggedCumu,
      tooltip: { pointFormat: '# Burn Txs <b>{point.y}</b>', valueDecimals: 0 }
    }],
    credits: { enabled: false }
  }
  useEffect(() => {
    chartComponentRef?.current.chart.redraw()
  }, [events, wallets])
  return (
    <HighchartsReact
          containerProps={{ style: { width: '100%' } }}
          highcharts={Highcharts}
          options={options}
          ref={chartComponentRef}
          {...props}
      />
  )
}

export const PlotLineBurnAmountOverTime = ({ events, wallets, ...props }: ChartProps): React.FC => {
  const chartComponentRef = useRef<HighchartsReact.RefObject>(null)

  const series: number[] = sortBy(events.map(e => ({ ts: Number(e.ts), amount: computeBurnAmount(e) })))
  const bucketed = Object.entries(groupBy(series, e => Math.floor(e.ts / 86400).toString()))
  const agged: Array<[number, number]> = bucketed.map(([day, bucket]) => [Number(day), sum((bucket as any).map(e => e.amount))])
  let s = 0
  const aggedCumu = agged.map(([day, v]) => [day * 86400 * 1000, (s += v)])

  const options = {
    title: { text: 'Burn Amount (USD) Over Time' },
    xAxis: [{
      title: { text: 'Time' },
      type: 'datetime',
      labels: { format: '{value:%Y-%m-%d}' }
    }],
    yAxis: [{ title: { text: 'USD Burned' } }],
    series: [{
      name: 'Burn Amount (USD) v. Time',
      data: aggedCumu,
      // eslint-disable-next-line no-template-curly-in-string
      tooltip: { pointFormat: 'Total Burned <b>${point.y}</b>', valueDecimals: 0 }
    }],
    credits: { enabled: false }
  }
  useEffect(() => {
    chartComponentRef?.current.chart.redraw()
  }, [events, wallets])
  return (
    <HighchartsReact
          containerProps={{ style: { width: '100%' } }}
          highcharts={Highcharts}
          options={options}
          ref={chartComponentRef}
          {...props}
      />
  )
}

export const PlotLineBurnEfficiencyOverTime = ({ events, wallets, ...props }: ChartProps): React.FC => {
  const chartComponentRef = useRef<HighchartsReact.RefObject>(null)

  const series: number[] = sortBy(events.map(e => ({ ts: Number(e.ts), amount: computeBurnAmount(e) })))
  const bucketed = Object.entries(groupBy(series, e => Math.floor(e.ts / 86400).toString()))
  const agged: Array<[number, number]> = bucketed.map(([day, bucket]) => [Number(day), sum((bucket as any).map(e => e.amount))])
  let s = 0
  const aggedCumu = agged.map(([day, v]) => [day * 86400 * 1000, (s += v)])

  const series2: number[] = sortBy(events.map(e => ({ ts: Number(e.ts), amount: normalizeStablecoinAmount(e.stablecoinAmount) })))
  const bucketed2 = Object.entries(groupBy(series2, e => Math.floor(e.ts / 86400).toString()))
  const agged2: Array<[number, number]> = bucketed2.map(([day, bucket]) => [Number(day), sum((bucket as any).map(e => e.amount))])
  let s2 = 0
  const aggedCumu2 = agged2.map(([day, v]) => [day * 86400 * 1000, (s2 += v)])
  const finalAggCumu = aggedCumu.map(([ts, c], i) => [ts, aggedCumu2[i][1] / c])

  const options = {
    title: { text: 'Aggregated Burn Rate Over Time (a.k.a burn efficiency, lower is more efficient)' },
    xAxis: [{
      title: { text: 'Time' },
      type: 'datetime',
      labels: { format: '{value:%Y-%m-%d}' }
    }],
    yAxis: [{ title: { text: 'USD Burned' } }],
    series: [{
      name: 'Burn Efficiency v. Time',
      data: finalAggCumu,
      // eslint-disable-next-line no-template-curly-in-string
      tooltip: { pointFormat: 'Burn efficiency <b>{point.y}</b>', valueDecimals: 3 }
    }],
    credits: { enabled: false }
  }
  useEffect(() => {
    chartComponentRef?.current.chart.redraw()
  }, [events, wallets])
  return (
    <HighchartsReact
          containerProps={{ style: { width: '100%' } }}
          highcharts={Highcharts}
          options={options}
          ref={chartComponentRef}
          {...props}
      />
  )
}
