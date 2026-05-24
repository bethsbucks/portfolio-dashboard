import Papa from 'papaparse'

export const STORAGE_KEYS = {
  positions: 'portfolioDashboard_positions',
  watchlist: 'portfolioDashboard_watchlist',
  settings: 'portfolioDashboard_settings',
  importTimestamp: 'portfolioDashboard_importTimestamp',
  tradePlanNotes: 'portfolioDashboard_tradePlanNotes',
}

export const assetTypes = ['All', 'Stock', 'ETF', 'Option', 'Cash', 'Hedge', 'Other']
export const strategyBuckets = ['All', 'Core Conviction', 'Options', 'Speculative', 'Hedge', 'Cash', 'Watchlist', 'Other']

export const normalizeStrategyBucket = (value) => {
  const text = String(value || '').trim()
  if (!text) return text
  if (text === 'Income/Options') return 'Options'
  return text
}
export const optionTypes = [
  'Long Call',
  'Short Call',
  'Long Put',
  'Short Put',
  'Debit Spread',
  'Credit Spread',
  'Covered Call',
  'PMCC',
  'Other',
]

export const defaultSettings = {
  maxSinglePositionPercent: 15,
  maxTop5ConcentrationPercent: 60,
  minCashPercent: 5,
  minHedgePercent: 5,
  maxSpeculativePercent: 20,
  maxOptionsExposurePercent: 15,
  maxLeveragedExposurePercent: 10,
}

const leveragedTickers = ['TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'NAIL', 'TNA', 'LABU', 'SPXL', 'SPXS', 'UPRO', 'UVXY']

const cleanNumeric = (value) => {
  if (value === undefined || value === null) {
    return null
  }

  const text = String(value).trim()

  if (text === '' || text === '-') {
    return null
  }

  let cleaned = text.replace(/\$/g, '').replace(/,/g, '').replace(/%/g, '').replace(/\s+/g, '')
  let negative = false

  if (/^\(.*\)$/.test(cleaned)) {
    negative = true
    cleaned = cleaned.slice(1, -1)
  }

  if (cleaned === '') {
    return null
  }

  const number = Number(cleaned)
  if (Number.isNaN(number)) {
    return null
  }

  return negative ? -number : number
}

const normalizeString = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

const parseExpirationDate = (value) => {
  const text = normalizeString(value)
  if (!text) {
    return ''
  }

  const iso = text.replace(/\//g, '-').replace(/\./g, '-')
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toISOString().split('T')[0]
}

const parseBrokerOptionSymbol = (value, quantity = 0) => {
  const text = normalizeString(value)
  if (!text) return {}

  const match = text.match(/^([A-Za-z0-9.^-]+)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+([\d,]+(?:\.\d+)?)\s+([PC])$/i)
  if (!match) {
    return { fullSymbol: text }
  }

  const [, underlyingTicker, expirationRaw, strikeRaw, rawSide] = match
  const expiration = parseExpirationDate(expirationRaw)
  const strike = parseNumber(strikeRaw)
  const side = rawSide.toUpperCase()
  const optionType = quantity < 0
    ? side === 'P'
      ? 'Short Put'
      : 'Short Call'
    : side === 'P'
      ? 'Long Put'
      : 'Long Call'

  return {
    underlyingTicker: normalizeString(underlyingTicker).toUpperCase(),
    expiration,
    strike,
    optionType,
    rawOptionSide: side,
    fullSymbol: text,
  }
}

export const parseNumber = (value) => {
  return cleanNumeric(value)
}

export const parsePercent = (value) => {
  const parsed = cleanNumeric(value)
  return parsed === null ? 0 : parsed
}

const inferColumn = (header) => {
  const normalized = String(header || '').trim().toLowerCase().replace(/\s+/g, '')

  if (['symbol', 'ticker'].includes(normalized)) return 'ticker'
  if (['description', 'name'].includes(normalized)) return 'description'
  if (normalized.includes('qty') || normalized.includes('quantity') || normalized.includes('shares')) return 'quantity'
  if (['lastprice', 'currentprice', 'price', 'markprice'].includes(normalized)) return 'currentPrice'
  if (['marketvalue', 'currentvalue', 'marketvalueusd'].includes(normalized)) return 'marketValue'
  if (['averagecost', 'avgcost', 'cost/share', 'costpershare', 'avgprice'].includes(normalized)) return 'avgCost'
  if (['costbasis', 'totalcost', 'totalcostbasis', 'investment'].includes(normalized)) return 'costBasis'
  if (['gain/loss', 'unrealizedgain/loss', 'unrealizedp/l', 'unrealizedpl', 'unrealizedgain'].includes(normalized)) return 'unrealizedPL'
  if (['%gain/loss', 'gain/loss%', 'unrealized%', 'unrealizedpl%'].includes(normalized)) return 'unrealizedPLPercent'
  if (['expiration', 'expdate', 'exp'].includes(normalized)) return 'expiration'
  if (['strike'].includes(normalized)) return 'strike'
  if (['type', 'optiontype'].includes(normalized)) return 'optionType'
  if (['assettype'].includes(normalized)) return 'assetType'
  if (['strategybucket', 'bucket', 'strategy'].includes(normalized)) return 'strategyBucket'
  if (['account', 'accountname'].includes(normalized)) return 'accountName'
  if (['notes', 'note'].includes(normalized)) return 'notes'
  return null
}

const detectCash = (ticker, description) => {
  const text = `${ticker} ${description}`.toLowerCase()
  return /cash|money market|sweep|buying power/.test(text)
}

const detectOption = (description, optionType, expiration, strike, rawType) => {
  const text = `${description} ${rawType}`.toUpperCase()
  const hasOptionWord = /(CALL|PUT|COVERED CALL|LEAP|SPREAD)/.test(text)
  const hasExp = /\d{2}[\/\-]\d{2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(description)
  const hasStrike = /\d+\.?\d*/.test(String(strike))
  return Boolean(optionType || hasOptionWord || hasExp || hasStrike)
}

export const detectLeveragedETF = (ticker) => {
  const normalized = String(ticker || '').toUpperCase()
  return leveragedTickers.includes(normalized)
}

const normalizeOptionType = (value) => {
  const text = String(value || '').toLowerCase()
  if (text.includes('long call')) return 'Long Call'
  if (text.includes('short call')) return 'Short Call'
  if (text.includes('long put')) return 'Long Put'
  if (text.includes('short put')) return 'Short Put'
  if (text.includes('debit')) return 'Debit Spread'
  if (text.includes('credit')) return 'Credit Spread'
  if (text.includes('covered call')) return 'Covered Call'
  if (text.includes('pmcc')) return 'PMCC'
  if (text.includes('call')) return 'Other'
  if (text.includes('put')) return 'Other'
  return 'Other'
}

const normalizeAssetType = (value, description, ticker, optionType) => {
  const text = String(value || '').toLowerCase()
  if (detectCash(ticker, description)) return 'Cash'
  if (text.includes('option')) return 'Option'
  if (text.includes('equity')) return 'Stock'
  if (text.includes('stock')) return 'Stock'
  if (text.includes('etf')) return 'ETF'
  if (text.includes('hedge') || text.includes('inverse')) return 'Hedge'
  if (text.includes('cash')) return 'Cash'
  if (optionType) return 'Option'
  if (detectOption(description, optionType, '', '', text)) return 'Option'
  if (detectLeveragedETF(ticker)) return 'ETF'
  return 'Other'
}

const normalizeRow = (row, index) => {
  const normalizedRow = {
    accountName: '',
    ticker: '',
    description: '',
    assetType: '',
    optionType: '',
    strategyBucket: '',
    quantity: 0,
    avgCost: 0,
    currentPrice: 0,
    marketValue: 0,
    costBasis: 0,
    unrealizedPL: 0,
    unrealizedPLPercent: 0,
    portfolioWeightPercent: 0,
    targetWeightPercent: 0,
    expiration: '',
    strike: '',
    delta: 0,
    theta: 0,
    notes: '',
  }

  const direct = {}
  Object.keys(row).forEach((key) => {
    const column = inferColumn(key)
    if (!column) {
      return
    }
    direct[column] = normalizeString(row[key])
  })

  const initialTicker = normalizeString(direct.ticker || row.ticker || row.Symbol)
  const description = normalizeString(direct.description || row.description || row.Name || '')
  const rawType = normalizeString(row.Type || row.type || direct.optionType || '')
  const quantity = parseNumber(direct.quantity || row.Quantity || row.Qty)
  const optionMeta = parseBrokerOptionSymbol(initialTicker, quantity)
  const ticker = optionMeta.underlyingTicker || initialTicker
  const fullSymbol = optionMeta.fullSymbol || ''
  const calculatedOptionType = optionMeta.optionType || normalizeOptionType(direct.optionType || rawType)
  const assetType = normalizeAssetType(direct.assetType || row.assetType || '', description, ticker, calculatedOptionType)

  const currentPrice = parseNumber(direct.currentPrice || row['Last Price'] || row['Price'])
  const avgCost = parseNumber(direct.avgCost || row['Average Cost'] || row['Cost/Share'])
  const marketValue = parseNumber(direct.marketValue || row['Mkt Val (Market Value)'] || row['Market Value'] || row['Current Value'])
  const costBasis = parseNumber(direct.costBasis || row['Cost Basis'] || row['Total Cost'])
  const unrealizedPL = parseNumber(direct.unrealizedPL || row['Gain $ (Gain/Loss $)'] || row['Gain/Loss'] || row['Unrealized Gain/Loss'] || row['Unrealized P/L'])
  const unrealizedPLPercent = parsePercent(direct.unrealizedPLPercent || row['Gain % (Gain/Loss %)'] || row['% Gain/Loss'] || row['Gain/Loss %'] || row['Unrealized %'])
  const expiration = parseExpirationDate(direct.expiration || row.Expiration || row['Exp Date'] || optionMeta.expiration)
  const strike = parseNumber(direct.strike || row.Strike || optionMeta.strike)
  const rawPortfolioWeight = direct.portfolioWeightPercent || row['% of Acct (% of Account)'] || row['% of Account'] || row['% of Acct'] || row['Portfolio %'] || ''
  const providedWeight = parsePercent(rawPortfolioWeight)
  const targetWeightPercent = parsePercent(row['Target %'] || row.targetWeightPercent || row.target || '')
  const delta = parseNumber(row.Delta || row.delta)
  const theta = parseNumber(row.Theta || row.theta)

  const computedMarketValue = marketValue || (quantity && currentPrice ? (assetType === 'Option' ? quantity * currentPrice * 100 : quantity * currentPrice) : 0)
  const computedCostBasis = costBasis || (quantity && avgCost ? quantity * avgCost : 0)
  let finalCurrentPrice = currentPrice
  let finalQuantity = quantity
  let finalMarketValue = computedMarketValue
  let finalCostBasis = computedCostBasis
  let finalUnrealizedPL = typeof unrealizedPL === 'number' ? unrealizedPL : computedMarketValue - computedCostBasis
  let finalUnrealizedPLPercent = typeof unrealizedPLPercent === 'number' ? unrealizedPLPercent : (computedCostBasis ? (finalUnrealizedPL / computedCostBasis) * 100 : 0)

  if (assetType === 'Cash') {
    finalQuantity = 1
    finalMarketValue = marketValue || currentPrice || 0
    finalCostBasis = finalMarketValue
    finalCurrentPrice = finalMarketValue
    finalUnrealizedPL = 0
    finalUnrealizedPLPercent = 0
  }

  let strategyBucket = normalizeString(direct.strategyBucket || row.Strategy || row.strategyBucket || '')
  if (!strategyBucket) {
    if (assetType === 'Cash') strategyBucket = 'Cash'
    else if (assetType === 'Option') strategyBucket = 'Options'
    else if (assetType === 'Stock') strategyBucket = 'Core Conviction'
    else if (assetType === 'Hedge') strategyBucket = 'Hedge'
    else strategyBucket = 'Other'
  }

  strategyBucket = normalizeStrategyBucket(strategyBucket)

  return {
    id: normalizeString(row.id) || `pos-${index}-${Date.now()}`,
    accountName: normalizeString(direct.accountName || row['Account Name'] || row.accountName || 'Main Account'),
    ticker,
    description,
    assetType,
    optionType: calculatedOptionType,
    fullSymbol,
    underlyingTicker: optionMeta.underlyingTicker || '',
    strategyBucket,
    quantity: finalQuantity,
    avgCost,
    currentPrice: finalCurrentPrice,
    marketValue: finalMarketValue,
    costBasis: finalCostBasis,
    unrealizedPL: finalUnrealizedPL,
    unrealizedPLPercent: Number(finalUnrealizedPLPercent.toFixed(2)),
    portfolioWeightPercent: providedWeight,
    rawPortfolioWeight,
    targetWeightPercent,
    expiration,
    strike,
    delta,
    theta,
    notes: normalizeString(direct.notes || row.Notes || row.note || ''),
  }
}

export const normalizePositions = (rows) => {
  const normalized = rows
    .map((row, index) => normalizeRow(row, index))
    .filter((position) => position.ticker || position.description)

  const totalMarketValue = normalized.reduce((sum, position) => sum + position.marketValue, 0)
  const absoluteTotalMarketValue = Math.abs(totalMarketValue) || normalized.reduce((sum, position) => sum + Math.abs(position.marketValue), 0) || 1
  const weightBase = totalMarketValue !== 0 ? totalMarketValue : absoluteTotalMarketValue

  return normalized.map((position) => {
    const explicitWeight = String(position.rawPortfolioWeight || '').trim()
    const useExplicitWeight = explicitWeight !== '' && explicitWeight !== '-'

    return {
      ...position,
      portfolioWeightPercent: useExplicitWeight
        ? Number(position.portfolioWeightPercent.toFixed(2))
        : Number(((position.marketValue / weightBase) * 100).toFixed(2)),
      grossWeightPercent: Number(((Math.abs(position.marketValue) / absoluteTotalMarketValue) * 100).toFixed(2)),
    }
  })
}

export const calculateDte = (expiration) => {
  if (!expiration) return null
  const target = new Date(expiration)
  if (Number.isNaN(target.getTime())) return null

  const today = new Date()
  const delta = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return Number.isNaN(delta) ? null : delta
}

export const formatCurrency = (value) => {
  const number = Number(value || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number)
}

export const formatPercent = (value) => {
  const number = Number(value || 0)
  return `${number.toFixed(1)}%`
}

export const formatNumber = (value) => {
  const number = Number(value || 0)
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(number)
}

export const formatQuantity = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }
  const number = Number(value)
  if (Number.isInteger(number)) {
    return String(number)
  }
  return String(parseFloat(number.toFixed(4)))
}

export const sortByField = (items, key, direction = 'desc') => {
  return [...items].sort((a, b) => {
    const left = a[key] ?? ''
    const right = b[key] ?? ''

    if (typeof left === 'number' && typeof right === 'number') {
      return direction === 'asc' ? left - right : right - left
    }

    return direction === 'asc'
      ? String(left).localeCompare(String(right))
      : String(right).localeCompare(String(left))
  })
}

export const calculatePortfolioMetrics = (positions) => {
  const totalMarketValue = positions.reduce((sum, position) => sum + position.marketValue, 0)
  const absoluteTotalMarketValue = positions.reduce((sum, position) => sum + Math.abs(position.marketValue), 0) || 1
  const cashValue = positions
    .filter((position) => position.assetType === 'Cash')
    .reduce((sum, position) => sum + position.marketValue, 0)
  const unrealizedPL = positions.reduce((sum, position) => sum + position.unrealizedPL, 0)
  const sortedByValue = [...positions].sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue))
  const largestPosition = sortedByValue[0]
  const top5 = sortedByValue.slice(0, 5)
  const top5ConcentrationPercent = absoluteTotalMarketValue ? top5.reduce((sum, position) => sum + Math.abs(position.marketValue), 0) / absoluteTotalMarketValue * 100 : 0
  const top10 = sortedByValue.slice(0, 10)
  const top10ConcentrationPercent = absoluteTotalMarketValue ? top10.reduce((sum, position) => sum + Math.abs(position.marketValue), 0) / absoluteTotalMarketValue * 100 : 0
  const grossOptionValue = positions
    .filter((position) => position.assetType === 'Option')
    .reduce((sum, position) => sum + Math.abs(position.marketValue), 0)
  const netOptionValue = positions
    .filter((position) => position.assetType === 'Option')
    .reduce((sum, position) => sum + position.marketValue, 0)
  const exposureBase = Math.abs(totalMarketValue) || absoluteTotalMarketValue

  const hedgeAllocation = positions
    .filter((position) => position.strategyBucket === 'Hedge' || position.assetType === 'Hedge')
    .reduce((sum, position) => sum + Math.abs(position.marketValue), 0) / absoluteTotalMarketValue * 100
  const optionsExposure = exposureBase ? grossOptionValue / exposureBase * 100 : 0
  const speculativeAllocation = positions
    .filter((position) => position.strategyBucket === 'Speculative')
    .reduce((sum, position) => sum + Math.abs(position.marketValue), 0) / absoluteTotalMarketValue * 100
  const coreAllocation = positions
    .filter((position) => position.strategyBucket === 'Core Conviction')
    .reduce((sum, position) => sum + Math.abs(position.marketValue), 0) / absoluteTotalMarketValue * 100
  const incomeAllocation = positions
    .filter((position) => normalizeStrategyBucket(position.strategyBucket) === 'Options')
    .reduce((sum, position) => sum + Math.abs(position.marketValue), 0) / absoluteTotalMarketValue * 100
  const leveragedExposure = positions
    .filter((position) => detectLeveragedETF(position.ticker))
    .reduce((sum, position) => sum + Math.abs(position.marketValue), 0) / absoluteTotalMarketValue * 100

  const allocationByStrategy = strategyBuckets.slice(1).map((bucket) => ({
    name: bucket,
    value: positions
      .filter((position) => normalizeStrategyBucket(position.strategyBucket) === bucket)
      .reduce((sum, position) => sum + Math.abs(position.marketValue), 0),
  }))

  const allocationByAssetType = assetTypes.slice(1).map((type) => ({
    name: type,
    value: positions
      .filter((position) => position.assetType === type)
      .reduce((sum, position) => sum + Math.abs(position.marketValue), 0),
  }))

  const top10Positions = top10.map((position) => ({
    ticker: position.ticker,
    value: Math.abs(position.marketValue),
    fill: position.assetType === 'Stock' ? '#38bdf8' : position.assetType === 'ETF' ? '#818cf8' : position.assetType === 'fuchsia' ? '#c084fc' : '#facc15',
  }))

  return {
    totalMarketValue,
    absoluteTotalMarketValue,
    grossOptionValue,
    netOptionValue,
    cashValue,
    unrealizedPL,
    largestPositionPercent: largestPosition ? Math.abs(largestPosition.marketValue) / absoluteTotalMarketValue * 100 : 0,
    top5ConcentrationPercent,
    hedgeAllocation,
    optionsExposure,
    speculativeAllocation,
    coreAllocation,
    incomeAllocation,
    leveragedExposure,
    allocationByStrategy,
    allocationByAssetType,
    top10Positions,
    sortedByValue,
    top10ConcentrationPercent,
    positionsCount: positions.length,
  }
}

export const getActionWarnings = (metrics, settings, positions) => {
  const warnings = []
  const { maxSinglePositionPercent, maxTop5ConcentrationPercent, minCashPercent, minHedgePercent, maxSpeculativePercent, maxOptionsExposurePercent, maxLeveragedExposurePercent } = settings

  if (metrics.sortedByValue[0] && metrics.largestPositionPercent > maxSinglePositionPercent) {
    warnings.push({
      message: `Largest position is ${formatPercent(metrics.largestPositionPercent)}, above max ${formatPercent(maxSinglePositionPercent)}.`,
      type: 'danger',
    })
  }

  const overTarget = positions.filter((position) => position.targetWeightPercent > 0 && position.portfolioWeightPercent > position.targetWeightPercent)
  if (overTarget.length) {
    warnings.push({
      message: `There are ${overTarget.length} positions above target weight.`,
      type: 'warning',
    })
  }

  if (metrics.hedgeAllocation < minHedgePercent) {
    warnings.push({
      message: `Hedge allocation is ${formatPercent(metrics.hedgeAllocation)}, below minimum ${formatPercent(minHedgePercent)}.`,
      type: 'danger',
    })
  }

  const cashPercent = metrics.totalMarketValue ? (Math.abs(metrics.cashValue) / Math.abs(metrics.totalMarketValue)) * 100 : 0
  if (cashPercent < minCashPercent) {
    warnings.push({
      message: `Cash allocation is ${formatPercent(cashPercent)}, below minimum ${formatPercent(minCashPercent)}.`,
      type: 'warning',
    })
  }

  if (metrics.speculativeAllocation > maxSpeculativePercent) {
    warnings.push({
      message: `Speculative allocation is ${formatPercent(metrics.speculativeAllocation)}, above maximum ${formatPercent(maxSpeculativePercent)}.`,
      type: 'warning',
    })
  }

  if (metrics.optionsExposure > maxOptionsExposurePercent) {
    warnings.push({
      message: `Options exposure is ${formatPercent(metrics.optionsExposure)}, above maximum ${formatPercent(maxOptionsExposurePercent)}.`,
      type: 'warning',
    })
  }

  if (metrics.leveragedExposure > maxLeveragedExposurePercent) {
    warnings.push({
      message: `Leveraged ETF exposure is ${formatPercent(metrics.leveragedExposure)}, above maximum ${formatPercent(maxLeveragedExposurePercent)}.`,
      type: 'warning',
    })
  }

  if (metrics.top5ConcentrationPercent > maxTop5ConcentrationPercent) {
    warnings.push({
      message: `Top 5 concentration is ${formatPercent(metrics.top5ConcentrationPercent)}, above max ${formatPercent(maxTop5ConcentrationPercent)}.`,
      type: 'danger',
    })
  }

  return warnings
}

export const getRiskStatus = (value, threshold, invert = false) => {
  if (invert) {
    if (value < threshold * 0.75) return 'danger'
    if (value < threshold) return 'warning'
    return 'good'
  }

  if (value > threshold * 1.2) return 'danger'
  if (value > threshold) return 'warning'
  return 'good'
}

export const getRiskCards = (metrics, settings) => {
  return [
    {
      label: 'Largest position %',
      value: formatPercent(metrics.largestPositionPercent),
      status: getRiskStatus(metrics.largestPositionPercent, settings.maxSinglePositionPercent),
      detail: `Max ${formatPercent(settings.maxSinglePositionPercent)}`,
    },
    {
      label: 'Top 5 concentration %',
      value: formatPercent(metrics.top5ConcentrationPercent),
      status: getRiskStatus(metrics.top5ConcentrationPercent, settings.maxTop5ConcentrationPercent),
      detail: `Max ${formatPercent(settings.maxTop5ConcentrationPercent)}`,
    },
    {
      label: 'Core allocation %',
      value: formatPercent(metrics.coreAllocation),
      status: metrics.coreAllocation > 30 ? 'good' : 'warning',
      detail: 'Core bucket',
    },
    {
      label: 'Options allocation %',
      value: formatPercent(metrics.incomeAllocation),
      status: metrics.incomeAllocation > settings.maxOptionsExposurePercent ? 'warning' : 'good',
      detail: 'Options bucket',
    },
    {
      label: 'Speculative allocation %',
      value: formatPercent(metrics.speculativeAllocation),
      status: getRiskStatus(metrics.speculativeAllocation, settings.maxSpeculativePercent),
      detail: `Max ${formatPercent(settings.maxSpeculativePercent)}`,
    },
    {
      label: 'Hedge allocation %',
      value: formatPercent(metrics.hedgeAllocation),
      status: getRiskStatus(metrics.hedgeAllocation, settings.minHedgePercent, true),
      detail: `Min ${formatPercent(settings.minHedgePercent)}`,
    },
    {
      label: 'Cash allocation %',
      value: formatPercent(metrics.totalMarketValue ? (Math.abs(metrics.cashValue) / Math.abs(metrics.totalMarketValue)) * 100 : 0),
      status: getRiskStatus(metrics.totalMarketValue ? (Math.abs(metrics.cashValue) / Math.abs(metrics.totalMarketValue)) * 100 : 0, settings.minCashPercent, true),
      detail: `Min ${formatPercent(settings.minCashPercent)}`,
    },
    {
      label: 'Leveraged ETF %',
      value: formatPercent(metrics.leveragedExposure),
      status: getRiskStatus(metrics.leveragedExposure, settings.maxLeveragedExposurePercent),
      detail: `Max ${formatPercent(settings.maxLeveragedExposurePercent)}`,
    },
    {
      label: 'Options exposure %',
      value: formatPercent(metrics.optionsExposure),
      status: getRiskStatus(metrics.optionsExposure, settings.maxOptionsExposurePercent),
      detail: `Max ${formatPercent(settings.maxOptionsExposurePercent)}`,
    },
  ]
}

export const getMarketShockResetList = (positions, metrics, settings) => {
  const overTarget = positions
    .filter((position) => position.targetWeightPercent > 0 && position.portfolioWeightPercent > position.targetWeightPercent)
    .sort((a, b) => b.portfolioWeightPercent - a.portfolioWeightPercent)

  const speculative = positions.filter((position) => position.strategyBucket === 'Speculative').sort((a, b) => b.portfolioWeightPercent - a.portfolioWeightPercent)
  const leveraged = positions.filter((position) => detectLeveragedETF(position.ticker)).sort((a, b) => b.portfolioWeightPercent - a.portfolioWeightPercent)
  const largePositions = positions.filter((position) => position.portfolioWeightPercent > settings.maxSinglePositionPercent).sort((a, b) => b.portfolioWeightPercent - a.portfolioWeightPercent)

  const ordered = [...overTarget, ...speculative, ...leveraged, ...largePositions]
  const unique = []
  const seen = new Set()

  ordered.forEach((position) => {
    if (!seen.has(position.id)) {
      seen.add(position.id)
      unique.push(position)
    }
  })

  return unique.slice(0, 6).map((position) => ({
    id: position.id,
    ticker: position.ticker,
    reason: position.targetWeightPercent > 0 && position.portfolioWeightPercent > position.targetWeightPercent
      ? 'Over target'
      : position.strategyBucket === 'Speculative'
      ? 'Speculative bucket'
      : detectLeveragedETF(position.ticker)
      ? 'Leveraged ETF'
      : position.portfolioWeightPercent > settings.maxSinglePositionPercent
      ? 'Size over threshold'
      : 'Review',
    weight: position.portfolioWeightPercent,
  }))
}

export const parseCsvWithDiagnostics = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: false,
      complete: (results) => {
        try {
          const raw = results.data || []
          const errors = results.errors || []

          const maxScan = Math.min(20, raw.length)
          let headerRowIndex = -1
          let bestIndex = 0
          let bestScore = 0

          for (let i = 0; i < maxScan; i++) {
            const row = raw[i]
            if (!row || !Array.isArray(row)) continue
            const cells = row.map((cell) => String(cell || '').trim().toLowerCase())
            const hasSymbol = cells.some((cell) => cell === 'symbol')
            const hasDescription = cells.some((cell) => cell === 'description')
            const hasMarketValue = cells.some((cell) => cell === 'mkt val (market value)' || cell === 'market value' || cell.includes('market value'))
            if (hasSymbol && hasDescription && hasMarketValue) {
              headerRowIndex = i
              break
            }

            let score = 0
            for (const cell of cells) {
              if (/symbol|ticker|description|name|quantity|qty|price|market value|cost basis|average cost|gain|loss|expiration|exp/i.test(cell)) {
                score += 1
              }
            }
            if (score > bestScore) {
              bestScore = score
              bestIndex = i
            }
          }

          if (headerRowIndex === -1) {
            headerRowIndex = bestScore > 0 ? bestIndex : 0
          }

          const rawHeaders = (raw[headerRowIndex] || []).map((c) => String(c || '').trim())
          const filteredHeaders = rawHeaders
            .map((header, index) => ({ header, index }))
            .filter((item) => item.header !== '')

          const dataRows = raw.slice(headerRowIndex + 1)

          const preview = dataRows.slice(0, 5).map((r) => (Array.isArray(r) ? r.map((c) => String(c)) : r))

          const mappedRows = []
          const diagnostics = {
            fileName: file.name || 'uploaded.csv',
            detectedRows: raw.length,
            headerRowIndex,
            detectedHeaders: rawHeaders,
            preview,
            autoMappedFields: {},
            normalizedCount: 0,
            totalImportedPositions: 0,
            skippedCount: 0,
            skippedRows: [],
            parseErrors: errors,
            ignoredSummaryRowsCount: 0,
            cashImported: false,
            optionRowsImported: 0,
            equityRowsImported: 0,
            formatName: /symbol/i.test(rawHeaders.join(' ')) && /description/i.test(rawHeaders.join(' ')) && /market value/i.test(rawHeaders.join(' ')) ? 'AAA positions CSV' : 'Unknown CSV',
          }

          rawHeaders.forEach((h) => {
            if (h) {
              diagnostics.autoMappedFields[h] = inferColumn(h)
            }
          })

          for (let r = 0; r < dataRows.length; r++) {
            const rowArr = dataRows[r]
            if (!rowArr || (Array.isArray(rowArr) && rowArr.every((c) => String(c || '').trim() === ''))) {
              diagnostics.skippedCount++
              diagnostics.skippedRows.push({ rowIndex: headerRowIndex + 1 + r, reason: 'blank row', raw: rowArr })
              continue
            }

            const obj = {}
            filteredHeaders.forEach(({ header, index }) => {
              obj[header] = String((rowArr && rowArr[index]) || '').trim()
            })

            const symbolValue = normalizeString(obj.Symbol || obj.symbol || obj.ticker || '')
            const descriptionValue = normalizeString(obj.Description || obj.description || obj.Name || '')
            const assetTypeValue = normalizeString(obj['Asset Type'] || obj.assetType || '')
            const isSummaryRow = /positions total|total$/i.test(symbolValue) || /positions total|total$/i.test(descriptionValue) || /summary/i.test(symbolValue) || /summary/i.test(descriptionValue)
            if (isSummaryRow) {
              diagnostics.skippedCount++
              diagnostics.ignoredSummaryRowsCount++
              diagnostics.skippedRows.push({ rowIndex: headerRowIndex + 1 + r, reason: 'summary row', raw: obj })
              continue
            }

            if (/cash & cash investments/i.test(symbolValue) || /cash and money market/i.test(assetTypeValue)) {
              obj.Symbol = 'CASH'
              obj.Description = 'Cash & Cash Investments'
              obj['Asset Type'] = 'Cash'
              obj.Quantity = '1'
              const marketVal = obj['Mkt Val (Market Value)'] || obj['Market Value'] || obj['Price'] || ''
              obj.Price = marketVal
            }

            try {
              const normalized = normalizeRow(obj, r)
              if (!normalized.ticker && !normalized.description) {
                diagnostics.skippedCount++
                diagnostics.skippedRows.push({ rowIndex: headerRowIndex + 1 + r, reason: 'no ticker or description', raw: obj })
                continue
              }

              if (normalized.assetType === 'Cash') {
                diagnostics.cashImported = true
              }
              if (normalized.assetType === 'Option') {
                diagnostics.optionRowsImported += 1
              }
              if (normalized.assetType === 'Stock') {
                diagnostics.equityRowsImported += 1
              }

              if ((!normalized.marketValue || normalized.marketValue === 0) && normalized.quantity && normalized.currentPrice) {
                normalized.marketValue = normalized.quantity * normalized.currentPrice
              }
              if ((!normalized.costBasis || normalized.costBasis === 0) && normalized.quantity && normalized.avgCost) {
                normalized.costBasis = normalized.quantity * normalized.avgCost
              }

              mappedRows.push(normalized)
            } catch (err) {
              diagnostics.skippedCount++
              diagnostics.skippedRows.push({ rowIndex: headerRowIndex + 1 + r, reason: String(err && err.message ? err.message : err), raw: obj })
            }
          }

          const normalizedPositions = normalizePositions(mappedRows)
          diagnostics.normalizedCount = normalizedPositions.length
          diagnostics.totalImportedPositions = normalizedPositions.length

          resolve({ positions: normalizedPositions, diagnostics })
        } catch (err) {
          reject(err)
        }
      },
      error: (error) => reject(error),
    })
  })
}

// backward-compatible wrapper: returns positions array only
export const parseCsvFile = async (file) => {
  const { positions } = await parseCsvWithDiagnostics(file)
  return positions
}
