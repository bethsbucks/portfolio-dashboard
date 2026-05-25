import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  CircleDollarSign,
  Download,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { samplePositions } from './data/sampleData.js'
import {
  STORAGE_KEYS,
  assetTypes,
  defaultSettings,
  strategyBuckets,
  calculateDte,
  calculatePortfolioMetrics,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatQuantity,
  getActionWarnings,
  getMarketShockResetList,
  getRiskCards,
  normalizePositions,
  parseCsvWithDiagnostics,
  detectLeveragedETF,
} from './utils/portfolioUtils.js'
import trailerTrashLogo from './assets/trailer-trash-trading-header-logo.webp'

const navTabs = ['Overview', 'Positions', 'Options', 'Watchlist', 'Trade Plan', 'Settings']

const navIcons = {
  Overview: Sparkles,
  Positions: BarChart3,
  Options: CircleDollarSign,
  Watchlist: Bell,
  'Trade Plan': ArrowUpRight,
  Settings: RefreshCcw,
}

const badgeClasses = {
  good: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/10',
  warning: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/10',
  danger: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/10',
}

const strategyColorMap = {
  Core: '#38bdf8',
  Options: '#8b5cf6',
  Cash: '#22c55e',
  Speculative: '#f97316',
  Hedge: '#06b6d4',
  'Leveraged ETF': '#f59e0b',
  Other: '#64748b',
}

const optionCallTypes = ['Long Call', 'Short Call']
const optionPutTypes = ['Long Put', 'Short Put']

const isCallOption = (position) => position.assetType === 'Option' && optionCallTypes.includes(position.optionType)
const isPutOption = (position) => position.assetType === 'Option' && optionPutTypes.includes(position.optionType)
const isTradePlanEligiblePosition = (position) => position.assetType === 'Stock' || position.assetType === 'ETF' || isCallOption(position)
const getUnderlyingGroupKey = (position) => (position.underlyingTicker || position.ticker || '').toUpperCase()

const getPositionMixLabel = (group) => {
  const hasStock = group.some((position) => position.assetType === 'Stock')
  const hasEft = group.some((position) => position.assetType === 'ETF')
  const hasCalls = group.some(isCallOption)

  if (hasStock) {
    return hasCalls ? 'Stock + Calls' : 'Stock'
  }
  if (hasEft) {
    return hasCalls ? 'ETF + Calls' : 'ETF'
  }
  return 'Calls only'
}

const getGroupDescription = (group, underlying) => {
  const stockOrEft = group.find((position) => position.assetType === 'Stock' || position.assetType === 'ETF')
  const callPositions = group.filter(isCallOption)
  const hasStockOrEft = Boolean(stockOrEft)
  const callCount = callPositions.length

  if (hasStockOrEft && callCount > 0) {
    return `${stockOrEft.description || underlying} + ${callCount} call position${callCount === 1 ? '' : 's'}`
  }
  if (hasStockOrEft) {
    return stockOrEft.description || underlying
  }
  return `${callCount} call position${callCount === 1 ? '' : 's'}`
}

const getDteBadgeClass = (dte) => {
  if (dte === null) return 'is-muted'
  if (dte <= 14) return 'is-danger'
  if (dte <= 45) return 'is-warning'
  return 'is-safe'
}

const initialWatchlistForm = {
  ticker: '',
  companyName: '',
  currentPrice: '',
  buyZone: '',
  strongBuyZone: '',
  targetPositionPercent: '',
  strategyBucket: 'Core',
  notes: '',
}

function App() {
  const [activeTab, setActiveTab] = useState('Overview')
  const [positions, setPositions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [settings, setSettings] = useState(defaultSettings)
  const [importTimestamp, setImportTimestamp] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [assetFilter, setAssetFilter] = useState('All')
  const [strategyFilter, setStrategyFilter] = useState('All')
  const [sortConfig, setSortConfig] = useState({ key: 'portfolioWeightPercent', direction: 'desc' })
  const [optionSortConfig, setOptionSortConfig] = useState({ key: 'dte', direction: 'asc' })
  const [csvMessage, setCsvMessage] = useState('')
  const [jsonMessage, setJsonMessage] = useState('')
  const [csvDiagnostics, setCsvDiagnostics] = useState(null)
  const [watchlistForm, setWatchlistForm] = useState(initialWatchlistForm)
  const [tradePlanNotes, setTradePlanNotes] = useState('')
  const [showTargetsOnly, setShowTargetsOnly] = useState(false)

  useEffect(() => {
    try {
      const storedPositions = localStorage.getItem(STORAGE_KEYS.positions)
      const storedWatchlist = localStorage.getItem(STORAGE_KEYS.watchlist)
      const storedSettings = localStorage.getItem(STORAGE_KEYS.settings)
      const storedTimestamp = localStorage.getItem(STORAGE_KEYS.importTimestamp)

      if (storedPositions) {
        const parsed = JSON.parse(storedPositions)
        setPositions(normalizePositions(Array.isArray(parsed) ? parsed : []))
      }
      if (storedWatchlist) {
        setWatchlist(JSON.parse(storedWatchlist) || [])
      }
      if (storedSettings) {
        setSettings({ ...defaultSettings, ...JSON.parse(storedSettings) })
      }
      if (storedTimestamp) {
        setImportTimestamp(storedTimestamp)
      }
    } catch (error) {
      console.error('Failed to load local storage', error)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.positions, JSON.stringify(positions))
  }, [positions])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(watchlist))
  }, [watchlist])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.importTimestamp, importTimestamp)
  }, [importTimestamp])

  useEffect(() => {
    const storedNotes = localStorage.getItem(STORAGE_KEYS.tradePlanNotes)
    if (storedNotes != null) {
      setTradePlanNotes(storedNotes)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.tradePlanNotes, tradePlanNotes)
  }, [tradePlanNotes])

  const metrics = useMemo(() => calculatePortfolioMetrics(positions), [positions])
  const warnings = useMemo(() => getActionWarnings(metrics, settings, positions), [metrics, settings, positions])
  const riskCards = useMemo(() => getRiskCards(metrics, settings), [metrics, settings])
  const marketShock = useMemo(() => getMarketShockResetList(positions, metrics, settings), [positions, metrics, settings])

  const loadSamplePortfolio = () => {
    const confirmed = window.confirm('This will replace your current portfolio data with sample data. Continue?')
    if (!confirmed) return
    setPositions(normalizePositions(samplePositions))
    setImportTimestamp(new Date().toISOString())
    setCsvMessage('Sample portfolio loaded')
  }

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      const { positions: parsedRows, diagnostics } = await parseCsvWithDiagnostics(file)
      setPositions(normalizePositions(parsedRows))
      setImportTimestamp(new Date().toISOString())
      setCsvMessage(`Imported ${parsedRows.length} rows from CSV`)
      setCsvDiagnostics(diagnostics)
      event.target.value = ''
    } catch (error) {
      setCsvMessage('CSV import failed. See diagnostics for details.')
      setCsvDiagnostics({
        fileName: file.name || 'uploaded.csv',
        detectedRows: 0,
        detectedHeaders: [],
        preview: [],
        autoMappedFields: {},
        normalizedCount: 0,
        skippedCount: 0,
        skippedRows: [{ reason: error.message || String(error) }],
        parseErrors: [],
      })
      console.error(error)
    }
  }

  const handleJsonImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      if (payload.positions && Array.isArray(payload.positions)) {
        setPositions(normalizePositions(payload.positions))
      }
      if (payload.watchlist && Array.isArray(payload.watchlist)) {
        setWatchlist(payload.watchlist)
      }
      if (payload.settings) {
        setSettings({ ...defaultSettings, ...payload.settings })
      }
      if (payload.importTimestamp) {
        setImportTimestamp(payload.importTimestamp)
      }
      setJsonMessage('JSON backup restored successfully')
      event.target.value = ''
    } catch (error) {
      setJsonMessage('Failed to parse JSON backup.')
      console.error(error)
    }
  }

  const handleExportBackup = () => {
    const payload = {
      positions,
      watchlist,
      settings,
      importTimestamp: importTimestamp || new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'portfolio-backup.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadDiagnostics = () => {
    if (!csvDiagnostics) return
    const blob = new Blob([JSON.stringify(csvDiagnostics, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `csv-diagnostics-${csvDiagnostics.fileName || 'diagnostics'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleResetAll = () => {
    setPositions([])
    setWatchlist([])
    setSettings(defaultSettings)
    setImportTimestamp('')
    setCsvMessage('Application data has been reset')
    setJsonMessage('')
  }

  const handlePositionChange = (id, field, value) => {
    const updated = positions.map((position) => {
      if (position.id !== id) return position
      if (field === 'targetWeightPercent') {
        const normalizedValue = value === '' || value === null ? '' : Number(value)
        return {
          ...position,
          [field]: Number.isFinite(normalizedValue) ? normalizedValue : '',
        }
      }
      return {
        ...position,
        [field]: value,
      }
    })

    if (field === 'targetWeightPercent') {
      setPositions(updated)
    } else {
      setPositions(normalizePositions(updated))
    }
  }

  const handleGroupedTargetChange = (underlying, value) => {
    const normalizedValue = value === '' || value === null ? '' : Number(value)
    setPositions((current) => {
      const groupedIds = current
        .filter((position) => isTradePlanEligiblePosition(position) && getUnderlyingGroupKey(position) === underlying)
        .map((position) => position.id)

      const primaryGroupId = current
        .find((position) => groupedIds.includes(position.id) && (position.assetType === 'Stock' || position.assetType === 'ETF'))
        ?.id || groupedIds[0]

      if (!primaryGroupId) return current

      return current.map((position) => {
        if (position.id !== primaryGroupId) return position
        return {
          ...position,
          targetWeightPercent: Number.isFinite(normalizedValue) ? normalizedValue : '',
        }
      })
    })
  }

  const handleWatchlistChange = (id, field, value) => {
    setWatchlist((current) =>
      current.map((row) => (row.id !== id ? row : { ...row, [field]: value })),
    )
  }

  const handleInlineTargetChange = (source, id, value) => {
    const num = value === '' || value === null ? '' : Number(value)
    if (source === 'position') {
      handlePositionChange(id, 'targetWeightPercent', num === '' ? '' : num)
    } else if (source === 'watchlist') {
      handleWatchlistChange(id, 'targetPositionPercent', num === '' ? 0 : num)
    }
  }

  const addWatchlistItem = () => {
    if (!watchlistForm.ticker) {
      return
    }
    setWatchlist((current) => [
      ...current,
      {
        id: `watch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ticker: watchlistForm.ticker.toUpperCase(),
        companyName: watchlistForm.companyName,
        currentPrice: Number(watchlistForm.currentPrice) || 0,
        buyZone: watchlistForm.buyZone,
        strongBuyZone: watchlistForm.strongBuyZone,
        targetPositionPercent: Number(watchlistForm.targetPositionPercent) || 0,
        strategyBucket: watchlistForm.strategyBucket,
        notes: watchlistForm.notes,
      },
    ])
    setWatchlistForm(initialWatchlistForm)
  }

  const removeWatchlistItem = (id) => {
    setWatchlist((current) => current.filter((row) => row.id !== id))
  }

  const filteredPositions = useMemo(() => {
    return positions
      .filter((position) => {
        const query = searchTerm.trim().toLowerCase()
        if (!query) return true
        return [position.ticker, position.description, position.strategyBucket, position.assetType, position.notes, position.accountName]
          .join(' ')
          .toLowerCase()
          .includes(query)
      })
      .filter((position) => (assetFilter === 'All' ? true : position.assetType === assetFilter))
      .filter((position) => (strategyFilter === 'All' ? true : position.strategyBucket === strategyFilter))
  }, [positions, searchTerm, assetFilter, strategyFilter])

  const sortedPositions = useMemo(() => {
    return [...filteredPositions].sort((a, b) => {
      const left = a[sortConfig.key]
      const right = b[sortConfig.key]
      if (typeof left === 'number' && typeof right === 'number') {
        return sortConfig.direction === 'asc' ? left - right : right - left
      }
      return sortConfig.direction === 'asc'
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left))
    })
  }, [filteredPositions, sortConfig])

  const optionRows = positions.filter((position) => position.assetType === 'Option')
  const sortedOptionRows = useMemo(() => {
    const getOptionSortValue = (position) => {
      if (optionSortConfig.key === 'underlying') return position.underlyingTicker || position.ticker
      if (optionSortConfig.key === 'fullSymbol') return position.fullSymbol || position.description
      if (optionSortConfig.key === 'dte') return calculateDte(position.expiration)
      return position[optionSortConfig.key]
    }

    return [...optionRows].sort((a, b) => {
      const left = getOptionSortValue(a)
      const right = getOptionSortValue(b)

      if (left === null || left === undefined || left === '') return 1
      if (right === null || right === undefined || right === '') return -1
      if (typeof left === 'number' && typeof right === 'number') {
        return optionSortConfig.direction === 'asc' ? left - right : right - left
      }
      return optionSortConfig.direction === 'asc'
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left))
    })
  }, [optionRows, optionSortConfig])
  const top10Overview = useMemo(() => {
    const portfolioBase = metrics.absoluteTotalMarketValue || 1
    const groupedRows = positions.reduce((acc, position) => {
      const key = getUnderlyingGroupKey(position)
      if (!key) return acc
      if (!acc[key]) {
        acc[key] = {
          id: `value-leader-${key}`,
          ticker: key,
          marketValue: 0,
          absoluteMarketValue: 0,
        }
      }
      acc[key].marketValue += position.marketValue
      acc[key].absoluteMarketValue += Math.abs(position.marketValue)
      return acc
    }, {})

    return Object.values(groupedRows)
      .map((group) => ({
        ...group,
        portfolioWeightPercent: portfolioBase ? (group.absoluteMarketValue / portfolioBase) * 100 : 0,
      }))
      .sort((a, b) => b.absoluteMarketValue - a.absoluteMarketValue)
      .slice(0, 10)
  }, [positions, metrics.absoluteTotalMarketValue])
  const shortOptionCount = optionRows.filter((position) => position.quantity < 0).length
  const cashPercent = metrics.totalMarketValue ? (Math.abs(metrics.cashValue) / Math.abs(metrics.totalMarketValue)) * 100 : 0
  const largestNonCashPosition =
    metrics.sortedByValue.find((position) => position.assetType !== 'Cash' && position.ticker?.toUpperCase() !== 'CASH') ||
    metrics.sortedByValue[0] ||
    { ticker: 'N/A', portfolioWeightPercent: 0 }
  const largestPositionLabel = largestNonCashPosition.ticker || 'N/A'
  const largestPositionPercentDisplay = formatPercent(largestNonCashPosition.portfolioWeightPercent || 0)
  const lastImportLabel = importTimestamp ? new Date(importTimestamp).toLocaleString() : 'Never'

  const trimmedPositions = useMemo(() => {
    const portfolioBase = Math.abs(metrics.totalMarketValue) || metrics.absoluteTotalMarketValue || 1

    const groupedRows = positions
      .filter((position) => isTradePlanEligiblePosition(position))
      .reduce((acc, position) => {
        const key = getUnderlyingGroupKey(position)
        if (!key) return acc
        if (!acc[key]) acc[key] = []
        acc[key].push(position)
        return acc
      }, {})

    return Object.entries(groupedRows)
      .map(([underlying, group]) => {
        const targetWeightPercent = group.map((position) => Number(position.targetWeightPercent)).find((value) => value > 0) || 0
        const currentPercent = portfolioBase ? (group.reduce((sum, position) => sum + Math.abs(position.marketValue), 0) / portfolioBase) * 100 : 0
        const hasCalls = group.some(isCallOption)
        const hasValidTarget = targetWeightPercent > 0
        const isAboveTarget = hasValidTarget && currentPercent > targetWeightPercent

        const reasons = []
        if (isAboveTarget) reasons.push('Above target allocation')
        if (currentPercent > settings.maxSinglePositionPercent) reasons.push('Above max position size')
        if (metrics.optionsExposure > settings.maxOptionsExposurePercent && hasCalls) reasons.push('Options exposure review')
        if (!reasons.length) return null

        const positionMix = getPositionMixLabel(group)
        const description = getGroupDescription(group, underlying)
        const marketValue = group.reduce((sum, position) => sum + position.marketValue, 0)
        const unrealizedPL = group.reduce((sum, position) => sum + position.unrealizedPL, 0)

        return {
          id: `trade-plan-group-${underlying}`,
          ticker: underlying,
          positionMix,
          description,
          currentPercent: Number(currentPercent.toFixed(2)),
          targetWeightPercent,
          displayTarget: hasValidTarget ? formatPercent(targetWeightPercent) : 'Not set',
          displayOverTarget: hasValidTarget && isAboveTarget ? formatPercent(currentPercent - targetWeightPercent) : 'N/A',
          marketValue,
          unrealizedPL,
          trimReasons: reasons,
          suggestedAction: reasons.includes('Above max position size')
            ? 'Review oversized position'
            : reasons.includes('Options exposure review')
            ? 'Review options exposure'
            : reasons.includes('Above target allocation')
            ? 'Trim back toward target'
            : null,
        }
      })
      .filter(Boolean)
  }, [positions, settings.maxSinglePositionPercent, settings.maxOptionsExposurePercent, metrics.optionsExposure, metrics.absoluteTotalMarketValue, metrics.totalMarketValue])

  const underweightPositions = useMemo(() => {
    return positions.filter((position) => Number(position.targetWeightPercent) > 0 && position.portfolioWeightPercent < position.targetWeightPercent)
  }, [positions])

  const watchlistAddCandidates = useMemo(() => {
    return watchlist
      .filter((item) => Number(item.targetPositionPercent) > 0)
      .map((item) => {
      const currentPrice = Number(item.currentPrice) || 0
      const strongBuy = item.strongBuyZone && Number(item.strongBuyZone) && currentPrice <= Number(item.strongBuyZone)
      const inBuyZone = item.buyZone && Number(item.buyZone) && currentPrice <= Number(item.buyZone)
      const suggestedAction = strongBuy
        ? 'Below strong buy zone'
        : inBuyZone
        ? 'In buy zone'
        : 'Watch for buy zone'

      return {
        id: item.id,
        ticker: item.ticker,
        description: item.companyName,
        currentPrice: currentPrice || 0,
        buyZone: item.buyZone || 'N/A',
        strongBuyZone: item.strongBuyZone || 'N/A',
        targetPercent: item.targetPositionPercent || 0,
        currentPercent: 0,
        strategy: item.strategyBucket,
        suggestedAction,
        source: 'watchlist',
        sourceId: item.id,
      }
    })
  }, [watchlist])

  const overweightCount = useMemo(() => {
    return positions.filter((position) => Number(position.targetWeightPercent) > 0 && position.portfolioWeightPercent > Number(position.targetWeightPercent)).length
  }, [positions])

  const addCandidates = useMemo(() => {
    const positionCandidates = underweightPositions.map((position) => ({
      id: position.id,
      ticker: position.ticker,
      description: position.description || position.fullSymbol || position.assetType,
      currentPrice: position.currentPrice || 0,
      buyZone: 'N/A',
      strongBuyZone: 'N/A',
      targetPercent: position.targetWeightPercent || 0,
      currentPercent: position.portfolioWeightPercent || 0,
      strategy: position.strategyBucket,
      suggestedAction: 'Below target allocation',
      source: 'position',
      sourceId: position.id,
    }))

    const cashCandidate = Math.abs(metrics.totalMarketValue) && Math.abs(metrics.cashValue) / Math.abs(metrics.totalMarketValue) * 100 > settings.minCashPercent
      ? [{
          id: 'cash-available',
          ticker: 'CASH',
          description: 'Available cash',
          currentPrice: 0,
          buyZone: 'N/A',
          strongBuyZone: 'N/A',
          targetPercent: 0,
          currentPercent: cashPercent,
          strategy: 'Cash',
          suggestedAction: 'Potential add if cash available',
        }]
      : []

    return [...watchlistAddCandidates, ...positionCandidates, ...cashCandidate]
  }, [underweightPositions, watchlistAddCandidates, metrics.cashValue, metrics.totalMarketValue, settings.minCashPercent, cashPercent])

  const filteredTrimmedPositions = useMemo(() => {
    if (!showTargetsOnly) return trimmedPositions
    return trimmedPositions.filter((position) => position.targetWeightPercent > 0)
  }, [trimmedPositions, showTargetsOnly])

  const filteredAddCandidates = useMemo(() => {
    if (!showTargetsOnly) return addCandidates
    return addCandidates.filter((item) => item.targetPercent > 0)
  }, [addCandidates, showTargetsOnly])

  const hedgePositions = useMemo(() => {
    return positions.filter((position) => position.strategyBucket === 'Hedge' || position.assetType === 'Hedge')
  }, [positions])

  const hedgeStatus = metrics.hedgeAllocation < settings.minHedgePercent
    ? 'Under target'
    : metrics.hedgeAllocation <= settings.minHedgePercent
    ? 'At target'
    : 'Above target'

  const cashMinimumAmount = Math.abs(metrics.totalMarketValue) * (settings.minCashPercent / 100)
  const cashExcess = Math.max(0, Math.abs(metrics.cashValue) - cashMinimumAmount)
  const deployment25 = cashExcess * 0.25
  const deployment50 = cashExcess * 0.5
  const deployment100 = cashExcess

  // Short put assignment exposure
  const shortPutAssignmentExposure = optionRows
    .filter((p) => p.optionType === 'Short Put' && typeof p.strike === 'number' && typeof p.quantity === 'number')
    .reduce((sum, p) => sum + Math.abs(p.quantity) * (p.strike || 0) * 100, 0)
  const shortPutAssignmentExposurePercent = metrics.totalMarketValue ? (shortPutAssignmentExposure / metrics.totalMarketValue) * 100 : 0

  // Local action warnings for short put assignment exposure
  const localWarnings = []
  if (shortPutAssignmentExposure > 0) {
    if (metrics.totalMarketValue && shortPutAssignmentExposure > Math.abs(metrics.totalMarketValue) * 0.5) {
      localWarnings.push({ message: 'Short put assignment exposure is high relative to portfolio value.', type: 'danger' })
    } else if (shortPutAssignmentExposure > Math.abs(metrics.cashValue)) {
      localWarnings.push({ message: 'Short put assignment exposure exceeds cash.', type: 'warning' })
    }
  }
  const displayWarnings = [...warnings, ...localWarnings]

  const handleSort = (key) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'desc' }
    })
  }

  const sortArrow = (key) => {
    if (sortConfig.key !== key) return null
    return sortConfig.direction === 'asc' ? '↑' : '↓'
  }

  const handleOptionSort = (key) => {
    setOptionSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: key === 'dte' ? 'asc' : 'desc' }
    })
  }

  const optionSortArrow = (key) => {
    if (optionSortConfig.key !== key) return null
    return optionSortConfig.direction === 'asc' ? '↑' : '↓'
  }

  return (
    <div className="theme-neon min-h-screen text-slate-100">
      <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="brand-header mb-5 rounded-[2rem] border border-cyan-400/15 bg-slate-950/85 p-3 shadow-[0_0_80px_rgba(6,182,212,0.14)] ring-1 ring-cyan-300/10 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-[280px] items-center">
              <img src={trailerTrashLogo} alt="Trailer Trash Trading Portfolio Cockpit" className="h-24 w-auto max-w-full rounded-[1.25rem] object-contain drop-shadow-[0_0_28px_rgba(34,211,238,0.28)]" />
            </div>

            <div className="flex flex-1 flex-wrap items-center justify-center gap-3">
              <nav className="flex flex-wrap items-center justify-center gap-2">
                {navTabs.map((tab) => {
                  const Icon = navIcons[tab]
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`neon-nav rounded-3xl border px-4 py-2 text-sm font-semibold transition duration-200 ${
                        activeTab === tab
                          ? 'is-active border-cyan-300/70 bg-cyan-400/10 text-white shadow-[0_0_24px_rgba(34,211,238,0.28)] ring-1 ring-cyan-300/40'
                          : 'border-white/10 bg-black/45 text-slate-300 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${activeTab === tab ? 'text-cyan-200' : 'text-slate-500'}`} />
                        {tab}
                      </span>
                    </button>
                  )
                })}
              </nav>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-3xl border border-cyan-300/20 bg-black/45 px-4 py-2 text-sm font-semibold text-slate-100 shadow-[0_0_18px_rgba(34,211,238,0.12)] ring-1 ring-cyan-300/10 hover:bg-cyan-400/10">
                <Download className="h-4 w-4 text-cyan-300" />
                <span>Import CSV</span>
                <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
              </label>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/15 px-3 py-2 text-xs font-semibold text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)] ring-1 ring-cyan-400/20">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                Local only
              </div>
            </div>
          </div>
        </div>

        <main className="space-y-8">
          {activeTab === 'Overview' && (
            <section className="space-y-3">
              <div className="grid gap-3 xl:grid-cols-[repeat(5,minmax(0,1fr))] items-start">
                <div className="metric-card metric-card-cyan rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-4 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-cyan-400/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Total portfolio</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{formatCurrency(metrics.totalMarketValue)}</h2>
                    </div>
                    <div className="rounded-3xl bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 ring-1 ring-cyan-400/15">Net market value</div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Updated locally with current cash, stock and option exposure.</p>
                </div>

                <div className="metric-card metric-card-emerald rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-4 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-emerald-400/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Cash & short-term</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{formatCurrency(metrics.cashValue)}</h2>
                    </div>
                    <div className="rounded-3xl bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-400/15">Cash allocation</div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">{formatPercent(cashPercent)} of portfolio</p>
                </div>

                <div className="metric-card metric-card-emerald rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-4 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-slate-800/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Unrealized P/L</p>
                      <h2 className={`mt-2 text-2xl font-semibold ${metrics.unrealizedPL >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(metrics.unrealizedPL)}</h2>
                    </div>
                    <div className={`rounded-3xl px-3 py-1.5 text-[11px] font-semibold ${metrics.unrealizedPL >= 0 ? 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/15' : 'bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/15'}`}>
                      {metrics.unrealizedPL >= 0 ? 'Positive' : 'Negative'} gain
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Net performance across current positions.</p>
                </div>

                <div className="metric-card metric-card-violet rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-4 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-fuchsia-400/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Largest position</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{largestPositionPercentDisplay}</h2>
                    </div>
                    <div className="rounded-3xl bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/15">Primary holding</div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">{largestPositionLabel}</p>
                </div>

                <div className="metric-card metric-card-amber rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-4 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-amber-400/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300">Short Put Exposure</p>
                      <h2 className="mt-2 text-2xl font-semibold text-amber-200">{formatCurrency(shortPutAssignmentExposure)}</h2>
                    </div>
                    <div className="rounded-3xl bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-400/12">If assigned</div>
                  </div>
                  <p className="mt-3 text-xs text-amber-200">If all short puts are assigned - {formatPercent(shortPutAssignmentExposurePercent)}</p>
                </div>
              </div>

              {/* Full-width Action Needed panel placed under top summary cards */}
              <div className="mt-3 rounded-[1.5rem] border border-slate-800/90 bg-slate-900/80 p-3 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.7)] ring-1 ring-slate-800/60">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/20">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Action needed</p>
                      <h3 className="mt-0.5 text-sm font-semibold text-white">Priority warnings</h3>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {displayWarnings.length ? (
                    displayWarnings.map((warning) => (
                      <div key={warning.message} className={`flex-1 min-w-[220px] max-w-[480px] rounded-3xl border px-3 py-2 text-sm shadow-sm ${warning.type === 'danger' ? 'border-rose-500/20 bg-rose-500/10 text-rose-100' : 'border-amber-400/20 bg-amber-500/10 text-amber-100'}`}>
                        <div className="inline-flex items-center gap-2 font-semibold text-slate-100">
                          <AlertTriangle className={`h-3.5 w-3.5 ${warning.type === 'danger' ? 'text-rose-300' : 'text-amber-300'}`} />
                          {warning.type === 'danger' ? 'Critical' : 'Warning'}
                        </div>
                        <p className="mt-2 text-slate-200 text-xs leading-5">{warning.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-slate-700/70 bg-slate-950/80 px-3 py-3 text-sm text-slate-300">No immediate concerns. Portfolio is within configured thresholds.</div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_0.9fr]">
                <div className="allocation-card flex h-full flex-col rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-5 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-slate-800/60 backdrop-blur-xl">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="allocation-kicker text-xs uppercase tracking-[0.3em] text-slate-400">Allocation by strategy</p>
                      <h3 className="allocation-title mt-1 text-2xl font-black uppercase text-white">Strategy mix</h3>
                    </div>
                    <div className="live-pill rounded-3xl bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 ring-1 ring-slate-800/40">Live snapshot</div>
                  </div>
                  <div className="allocation-body sm:grid sm:grid-cols-[0.95fr_1.05fr] gap-4 items-center">
                    <div className="allocation-donut-shell relative h-60 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={metrics.allocationByStrategy.filter((slice) => slice.value > 0)} dataKey="value" nameKey="name" innerRadius={58} outerRadius={98} paddingAngle={5} stroke="#020617" strokeWidth={4}>
                            {metrics.allocationByStrategy.filter((slice) => slice.value > 0).map((entry) => {
                              const fill = strategyColorMap[entry.name] || '#94a3b8'
                              return <Cell key={entry.name} fill={fill} />
                            })}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Center total overlay */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total</div>
                          <div className="mt-1 text-xl font-semibold text-white">{formatCurrency(metrics.totalMarketValue)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="space-y-2">
                        {metrics.allocationByStrategy.filter((slice) => slice.value > 0).map((entry) => {
                          const fill = strategyColorMap[entry.name] || '#94a3b8'
                          const pct = metrics.absoluteTotalMarketValue ? (entry.value / metrics.absoluteTotalMarketValue) * 100 : 0
                          return (
                            <div key={entry.name} className="strategy-row rounded-2xl border border-white/5 bg-slate-950/35 px-3 py-2" style={{ '--strategy-color': fill }}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="strategy-row-mark h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]" style={{ background: fill, color: fill }} />
                                  <div className="truncate">
                                    <div className="strategy-row-name truncate text-sm font-semibold text-slate-100">{entry.name}</div>
                                    <div className="truncate text-xs text-slate-500">{formatCurrency(entry.value)}</div>
                                  </div>
                                </div>
                                <div className="strategy-row-percent text-sm font-semibold text-slate-100">{formatPercent(pct)}</div>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/80">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: fill }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto grid gap-2 pt-5 text-xs text-slate-300 sm:grid-cols-3">
                    {(() => {
                      const nonZero = metrics.allocationByStrategy.filter((s) => s.value > 0)
                      const largest = nonZero.reduce((a, b) => (a.value >= b.value ? a : b), { name: 'N/A', value: 0 })
                      const cashPct = metrics.totalMarketValue ? (Math.abs(metrics.cashValue) / Math.abs(metrics.totalMarketValue)) * 100 : 0
                      return (
                        <>
                          <div className="allocation-mini allocation-mini-cyan rounded-2xl border border-cyan-400/10 bg-cyan-400/10 px-3 py-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Lead strategy</p>
                            <div className="mt-1 flex items-baseline justify-between gap-2">
                              <strong className="truncate text-sm text-white">{largest.name}</strong>
                              <span className="text-sm font-semibold text-cyan-100">{formatPercent(metrics.absoluteTotalMarketValue ? (largest.value / metrics.absoluteTotalMarketValue) * 100 : 0)}</span>
                            </div>
                          </div>
                          <div className="allocation-mini allocation-mini-emerald rounded-2xl border border-emerald-400/10 bg-emerald-400/10 px-3 py-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">Cash ready</p>
                            <div className="mt-1 flex items-baseline justify-between gap-2">
                              <strong className="text-sm text-white">{formatCurrency(metrics.cashValue)}</strong>
                              <span className="text-sm font-semibold text-emerald-100">{formatPercent(cashPct)}</span>
                            </div>
                          </div>
                          <div className="allocation-mini allocation-mini-violet rounded-2xl border border-violet-400/10 bg-violet-400/10 px-3 py-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-violet-200/70">Options income</p>
                            <strong className="mt-1 block text-sm text-white">{formatPercent(metrics.incomeAllocation)}</strong>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-5 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-slate-800/60 backdrop-blur-xl overflow-hidden">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Top 10 positions</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Value leaders</h3>
                    </div>
                    <div className="rounded-3xl bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 ring-1 ring-slate-800/40">Compact view</div>
                  </div>
                  <div className="data-table-panel overflow-hidden">
                    <table className="data-table w-full table-fixed divide-y divide-slate-800 text-sm">
                      <colgroup>
                        <col className="w-[28%]" />
                        <col className="w-[42%]" />
                        <col className="w-[30%]" />
                      </colgroup>
                      <thead className="bg-slate-950/70 text-slate-400">
                        <tr>
                          <th className="px-2 py-2 text-left uppercase tracking-[0.18em]">Ticker</th>
                          <th className="px-2 py-2 text-right uppercase tracking-[0.18em]">Market Value</th>
                          <th className="px-2 py-2 text-right uppercase tracking-[0.18em]">% Portfolio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {top10Overview.map((position) => (
                          <tr key={position.id} className="data-row hover:bg-slate-900/80 transition-colors duration-150">
                            <td className="px-2 py-2 text-slate-100 font-medium"><span className="ticker-chip">{position.ticker}</span></td>
                            <td className="px-2 py-2 text-right text-slate-100">{formatCurrency(position.marketValue)}</td>
                            <td className="px-2 py-2 text-right text-slate-100">{formatPercent(position.portfolioWeightPercent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-5 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-slate-800/60 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Portfolio diagnostics</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Health overview</h3>
                    </div>
                    <BarChart3 className="h-5 w-5 text-slate-300" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { label: 'Positions', value: metrics.positionsCount },
                      { label: 'Option positions', value: optionRows.length },
                      { label: 'Short options', value: shortOptionCount },
                      { label: 'Short put exposure', value: formatCurrency(shortPutAssignmentExposure) },
                      { label: 'Short put exposure %', value: formatPercent(shortPutAssignmentExposurePercent) },
                      { label: 'Cash value', value: formatCurrency(metrics.cashValue) },
                      { label: 'Gross exposure', value: formatCurrency(metrics.absoluteTotalMarketValue) },
                      { label: 'Net value', value: formatCurrency(metrics.totalMarketValue) },
                      { label: 'Unrealized P/L', value: formatCurrency(metrics.unrealizedPL) },
                      { label: 'Cash %', value: formatPercent(cashPercent) },
                    ].map((item) => (
                      <div key={item.label} className="signal-strip rounded-3xl p-3 text-sm text-slate-300">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                        <p className={`mt-1 text-base font-semibold ${item.label === 'Short put exposure' ? 'text-amber-300' : 'text-white'}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-5 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-slate-800/60 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Risk dashboard</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Portfolio posture</h3>
                    </div>
                    <div className="rounded-3xl bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 ring-1 ring-slate-800/40">Status</div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
                    {riskCards.map((card) => (
                      <div key={card.label} className={`signal-strip rounded-3xl p-3 ${badgeClasses[card.status]}`}>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{card.label}</p>
                        <p className="mt-2 text-xl font-semibold text-white">{card.value}</p>
                        <p className="mt-1 text-xs text-slate-300">{card.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <div className="min-h-[260px] rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-5 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-slate-800/60 backdrop-blur-xl">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Options exposure</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">Options position</h3>
                      </div>
                      <div className="rounded-3xl bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 ring-1 ring-slate-800/40">Current</div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="signal-strip rounded-3xl p-4 text-sm">
                        <p className="text-slate-400">Exposure%</p>
                        <p className="mt-3 text-3xl font-semibold text-cyan-300">{formatPercent(metrics.optionsExposure)}</p>
                      </div>
                      <div className="signal-strip rounded-3xl p-4 text-sm">
                        <p className="text-slate-400">Gross options</p>
                        <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(metrics.grossOptionValue)}</p>
                      </div>
                      <div className="signal-strip rounded-3xl p-4 text-sm">
                        <p className="text-slate-400">Net options</p>
                        <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(metrics.netOptionValue)}</p>
                      </div>
                      <div className="signal-strip rounded-3xl p-4 text-sm">
                        <p className="text-slate-400">Max allowed</p>
                        <p className="mt-3 text-2xl font-semibold text-white">{formatPercent(settings.maxOptionsExposurePercent)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-[260px] rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-5 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-slate-800/60 backdrop-blur-xl">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Market shock</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">Risk outlook</h3>
                      </div>
                      <div className="rounded-3xl bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 ring-1 ring-slate-800/40">Guidance</div>
                    </div>
                    <p className="text-sm leading-6 text-slate-400">This panel reflects current risk posture based on existing portfolio metrics. No additional scenario calculations are added.</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                        <div className="flex items-center justify-between gap-3">
                          <span>Top 5 concentration</span>
                          <strong>{formatPercent(metrics.top5ConcentrationPercent)}</strong>
                        </div>
                      </div>
                      <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                        <div className="flex items-center justify-between gap-3">
                          <span>Hedge allocation</span>
                          <strong>{formatPercent(metrics.hedgeAllocation)}</strong>
                        </div>
                      </div>
                      <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                        <div className="flex items-center justify-between gap-3">
                          <span>{marketShock.length ? 'Trim candidates' : 'Stable posture'}</span>
                          <strong>{marketShock.length ? marketShock.length : 'None'}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'Positions' && (
            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Positions</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">Portfolio table</h2>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="field-label text-sm text-slate-400">Search</span>
                      <div className="control-shell mt-2 flex items-center rounded-3xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 shadow-sm ring-1 ring-slate-800/40">
                        <Search className="mr-2 h-4 w-4 text-slate-400" />
                        <input
                          type="search"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Ticker, description, notes"
                          className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className="field-label text-sm text-slate-400">Asset type</span>
                      <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)} className="control-shell mt-2 block w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-slate-800/40">
                        {assetTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="field-label text-sm text-slate-400">Strategy bucket</span>
                      <select value={strategyFilter} onChange={(e) => setStrategyFilter(e.target.value)} className="control-shell mt-2 block w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-slate-800/40">
                        {strategyBuckets.map((bucket) => (
                          <option key={bucket} value={bucket}>{bucket}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="data-panel data-table-panel overflow-hidden rounded-[2rem] border border-slate-800/90 bg-slate-900/80 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-slate-800/60 backdrop-blur-xl">
                <table className="data-table w-full table-fixed divide-y divide-slate-800 text-[11px]">
                  <colgroup>
                    <col className="w-[8%]" />
                    <col className="w-[19%]" />
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <thead className="bg-slate-950/70 text-slate-400">
                    <tr>
                      {['Ticker', 'Description', 'Asset Type', 'Strategy Bucket', 'Quantity', 'Avg Cost', 'Current Price', 'Market Value', 'Unrealized P/L', 'Portfolio %'].map((label) => (
                        <th key={label} className="px-2 py-3 align-middle text-left text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-slate-400">
                          <button type="button" onClick={() => handleSort(label.replace(/\s+/g, '').charAt(0).toLowerCase() + label.replace(/\s+/g, '').slice(1))} className="inline-flex min-h-7 items-center gap-2 leading-tight">
                            {label}
                            <span>{sortArrow(label.replace(/\s+/g, '').charAt(0).toLowerCase() + label.replace(/\s+/g, '').slice(1))}</span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sortedPositions.length ? sortedPositions.map((position) => {
                      return (
                        <tr key={position.id} className="data-row hover:bg-slate-900/80 transition-colors duration-150">
                          <td className="px-2 py-3 text-slate-100">
                            {position.assetType === 'Option' && position.fullSymbol ? (
                              <div className="space-y-1">
                                <span className="ticker-chip">{position.underlyingTicker || position.ticker}</span>
                                <div className="text-xs text-slate-500">{position.fullSymbol}</div>
                              </div>
                            ) : (
                              <span className="ticker-chip">{position.ticker}</span>
                            )}
                          </td>
                          <td className="truncate px-2 py-3 text-slate-300">{position.description}</td>
                          <td className="px-2 py-3">
                            <select value={position.assetType} onChange={(e) => handlePositionChange(position.id, 'assetType', e.target.value)} className="table-select w-full rounded-2xl border border-slate-800 bg-slate-950 px-2 py-2 text-[11px] text-slate-100 outline-none ring-1 ring-slate-800/40">
                              {assetTypes.slice(1).map((value) => (
                                <option key={value} value={value}>{value}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-3">
                            <select value={position.strategyBucket} onChange={(e) => handlePositionChange(position.id, 'strategyBucket', e.target.value)} className="table-select w-full rounded-2xl border border-slate-800 bg-slate-950 px-2 py-2 text-[10px] text-slate-100 outline-none ring-1 ring-slate-800/40">
                              {strategyBuckets.slice(1).map((value) => (
                                <option key={value} value={value}>{value}</option>
                              ))}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-2 py-3 text-right text-slate-100">{formatQuantity(position.quantity)}</td>
                          <td className="whitespace-nowrap px-2 py-3 text-right text-slate-100">{formatCurrency(position.avgCost)}</td>
                          <td className="whitespace-nowrap px-2 py-3 text-right text-slate-100">{formatCurrency(position.currentPrice)}</td>
                          <td className="whitespace-nowrap px-2 py-3 text-right text-slate-100">{formatCurrency(position.marketValue)}</td>
                          <td className={`whitespace-nowrap px-2 py-3 text-right ${position.unrealizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(position.unrealizedPL)}</td>
                          <td className="whitespace-nowrap px-2 py-3 text-right text-slate-100">{formatPercent(position.portfolioWeightPercent)}</td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                          No positions found. Upload a CSV or load sample data to begin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'Options' && (
            <section className="space-y-6">
              <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-slate-800/60 backdrop-blur-xl">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Options</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Option exposure</h2>
                  </div>
                  <div className="control-shell rounded-3xl bg-slate-950/70 px-4 py-3 text-sm text-slate-300 ring-1 ring-white/10">
                    Total options value {formatCurrency(optionRows.reduce((sum, row) => sum + Math.abs(row.marketValue), 0))}
                  </div>
                </div>
                <div className="data-table-panel overflow-hidden">
                  <table className="data-table w-full table-fixed divide-y divide-slate-800 text-sm">
                    <colgroup>
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[6%]" />
                      <col className="w-[8%]" />
                      <col className="w-[13%]" />
                      <col className="w-[7%]" />
                      <col className="w-[11%]" />
                      <col className="w-[12%]" />
                      <col className="w-[11%]" />
                    </colgroup>
                    <thead className="bg-slate-950/70 text-slate-400">
                      <tr>
                        {[
                          ['Underlying', 'underlying'],
                          ['Full symbol', 'fullSymbol'],
                          ['Option Type', 'optionType'],
                          ['QTY', 'quantity'],
                          ['Strike', 'strike'],
                          ['Expiration', 'expiration'],
                          ['DTE', 'dte'],
                          ['Current Price', 'currentPrice'],
                          ['Market Value', 'marketValue'],
                          ['Unrealized P/L', 'unrealizedPL'],
                        ].map(([label, key]) => (
                          <th key={key} className={`px-3 py-3 uppercase leading-tight tracking-[0.16em] text-slate-400 ${['quantity', 'strike', 'dte', 'currentPrice', 'marketValue', 'unrealizedPL'].includes(key) ? 'text-right' : 'text-left'}`}>
                            <button type="button" onClick={() => handleOptionSort(key)} className={`inline-flex items-center gap-2 ${['quantity', 'strike', 'dte', 'currentPrice', 'marketValue', 'unrealizedPL'].includes(key) ? 'justify-end' : 'justify-start'} w-full`}>
                              {label}
                              <span>{optionSortArrow(key)}</span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {sortedOptionRows.length ? sortedOptionRows.map((position) => {
                        const dte = calculateDte(position.expiration)
                        const rowStyle = dte === null ? 'bg-slate-950/80' : dte <= 7 ? 'bg-rose-500/10' : dte <= 14 ? 'bg-amber-500/10' : dte <= 30 ? 'bg-slate-600/10' : 'bg-transparent'
                        return (
                          <tr key={position.id} className={`data-row ${rowStyle} hover:bg-slate-900/80 transition-colors duration-150`}>
                            <td className="truncate px-3 py-3 text-slate-100"><span className="ticker-chip">{position.underlyingTicker || position.ticker}</span></td>
                            <td className="truncate px-3 py-3 text-slate-300">{position.fullSymbol || position.description}</td>
                            <td className="truncate px-3 py-3 text-slate-300">{position.optionType}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">{formatQuantity(position.quantity)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">{position.strike}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-slate-100">{position.expiration || 'N/A'}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">
                              <span className={`dte-badge ${getDteBadgeClass(dte)}`}>{dte === null ? 'N/A' : `${dte}d`}</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">{formatCurrency(position.currentPrice)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">{formatCurrency(position.marketValue)}</td>
                            <td className={`whitespace-nowrap px-3 py-3 text-right ${position.unrealizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(position.unrealizedPL)}</td>
                          </tr>
                        )
                      }) : (
                        <tr>
                          <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                            No option positions available. Load sample portfolio or import your CSV data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'Watchlist' && (
            <section className="space-y-6">
              <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Watchlist</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Manual watchlist</h2>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  <label className="block">
                    <span className="field-label text-sm text-slate-400">Ticker</span>
                    <input type="text" value={watchlistForm.ticker} onChange={(e) => setWatchlistForm((current) => ({ ...current, ticker: e.target.value }))} className="control-shell mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/5" />
                  </label>
                  <label className="block">
                    <span className="field-label text-sm text-slate-400">Current price</span>
                    <input type="number" value={watchlistForm.currentPrice} onChange={(e) => setWatchlistForm((current) => ({ ...current, currentPrice: e.target.value }))} className="control-shell mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/5" />
                  </label>
                  <label className="block">
                    <span className="field-label text-sm text-slate-400">Buy zone</span>
                    <input type="text" value={watchlistForm.buyZone} onChange={(e) => setWatchlistForm((current) => ({ ...current, buyZone: e.target.value }))} className="control-shell mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/5" />
                  </label>
                  <label className="block">
                    <span className="field-label text-sm text-slate-400">Strong buy zone</span>
                    <input type="text" value={watchlistForm.strongBuyZone} onChange={(e) => setWatchlistForm((current) => ({ ...current, strongBuyZone: e.target.value }))} className="control-shell mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/5" />
                  </label>
                  <label className="block">
                    <span className="field-label text-sm text-slate-400">Target %</span>
                    <input type="number" value={watchlistForm.targetPositionPercent} onChange={(e) => setWatchlistForm((current) => ({ ...current, targetPositionPercent: e.target.value }))} className="control-shell mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/5" />
                  </label>
                  <label className="block">
                    <span className="field-label text-sm text-slate-400">Strategy bucket</span>
                    <select value={watchlistForm.strategyBucket} onChange={(e) => setWatchlistForm((current) => ({ ...current, strategyBucket: e.target.value }))} className="control-shell mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/5">
                      {strategyBuckets.slice(1).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block lg:col-span-3">
                    <span className="field-label text-sm text-slate-400">Notes</span>
                    <input type="text" value={watchlistForm.notes} onChange={(e) => setWatchlistForm((current) => ({ ...current, notes: e.target.value }))} className="control-shell mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/5" />
                  </label>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={addWatchlistItem} className="action-button gap-2 px-5 py-3 text-sm">
                    <Plus className="h-4 w-4" /> Add watchlist row
                  </button>
                  <p className="text-sm text-slate-400">Store watchlist entries locally for later review.</p>
                </div>
              </div>

              <div className="data-panel data-table-panel overflow-hidden rounded-[2rem] border border-slate-800/90 bg-slate-900/80 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                <table className="data-table w-full table-fixed divide-y divide-slate-800 text-sm">
                  <colgroup>
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[20%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead className="bg-slate-950/70 text-slate-400">
                    <tr>
                      {['Ticker', 'Price', 'Buy Zone', 'Strong Buy', 'Target %', 'Bucket', 'Notes', 'Actions'].map((label) => (
                        <th key={label} className="px-3 py-3 text-left uppercase tracking-[0.16em] text-slate-400">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {watchlist.length ? watchlist.map((item) => (
                      <tr key={item.id} className="data-row hover:bg-slate-900/80 transition-colors duration-150">
                        <td className="px-3 py-3 text-slate-100"><span className="ticker-chip">{item.ticker}</span></td>
                        <td className="px-3 py-3"><input type="number" value={item.currentPrice} onChange={(e) => handleWatchlistChange(item.id, 'currentPrice', Number(e.target.value))} className="table-input w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-white/5" /></td>
                        <td className="px-3 py-3"><input type="text" value={item.buyZone} onChange={(e) => handleWatchlistChange(item.id, 'buyZone', e.target.value)} className="table-input w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-white/5" /></td>
                        <td className="px-3 py-3"><input type="text" value={item.strongBuyZone} onChange={(e) => handleWatchlistChange(item.id, 'strongBuyZone', e.target.value)} className="table-input w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-white/5" /></td>
                        <td className="px-3 py-3"><input type="number" value={item.targetPositionPercent} onChange={(e) => handleWatchlistChange(item.id, 'targetPositionPercent', Number(e.target.value))} className="table-input w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-white/5" /></td>
                        <td className="px-3 py-3"><select value={item.strategyBucket} onChange={(e) => handleWatchlistChange(item.id, 'strategyBucket', e.target.value)} className="table-select w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-white/5">{strategyBuckets.slice(1).map((value) => <option key={value} value={value}>{value}</option>)}</select></td>
                        <td className="px-3 py-3 text-slate-300"><input type="text" value={item.notes} onChange={(e) => handleWatchlistChange(item.id, 'notes', e.target.value)} className="table-input w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-white/5" /></td>
                        <td className="px-3 py-3">
                          <button type="button" onClick={() => removeWatchlistItem(item.id)} className="action-button is-danger px-3 py-2 text-sm">Delete</button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                          Add a watchlist row to save manual ticker ideas locally.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'Trade Plan' && (
            <section className="space-y-6">
              <div className="grid gap-2 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
                <div className="data-panel rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-3 shadow-[0_8px_32px_-16px_rgba(15,23,42,0.6)] ring-1 ring-slate-800/40 col-span-full">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Planning targets</p>
                      <p className="mt-1 text-sm text-slate-300">Set target percentages on positions or watchlist items to generate better trim/add suggestions.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="control-shell inline-flex items-center gap-2 rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                        <input type="checkbox" checked={showTargetsOnly} onChange={(e) => setShowTargetsOnly(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 accent-cyan-300" />
                        Show only positions with targets
                      </label>
                    </div>
                  </div>
                </div>
                <div className="plan-card metric-card-cyan rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-4 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-slate-800/60">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Portfolio value</p>
                  <h3 className="mt-2 text-3xl font-semibold text-white">{formatCurrency(metrics.totalMarketValue)}</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div className="signal-strip flex items-center justify-between px-3 py-2">
                      <span>Unrealized P/L</span>
                      <span className={`${metrics.unrealizedPL >= 0 ? 'text-emerald-300' : 'text-rose-300'} font-semibold`}>{formatCurrency(metrics.unrealizedPL)}</span>
                    </div>
                    <div className="signal-strip flex items-center justify-between px-3 py-2">
                      <span>Unrealized %</span>
                      <span className={`${metrics.unrealizedPL >= 0 ? 'text-emerald-300' : 'text-rose-300'} font-semibold`}>{formatPercent(metrics.totalMarketValue ? (metrics.unrealizedPL / metrics.totalMarketValue) * 100 : 0)}</span>
                    </div>
                  </div>
                </div>
                <div className="plan-card metric-card-emerald rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-4 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-slate-800/60">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cash available</p>
                  <h3 className="mt-2 text-3xl font-semibold text-white">{formatCurrency(metrics.cashValue)}</h3>
                  <p className="mt-1 text-sm text-slate-300">{formatPercent(cashPercent)} of portfolio</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div className="signal-strip flex items-center justify-between px-3 py-2">
                      <span>Short Put Exposure</span>
                      <span className="font-semibold text-amber-300">{formatCurrency(shortPutAssignmentExposure)}</span>
                    </div>
                    <div className="signal-strip flex items-center justify-between px-3 py-2">
                      <span>Cash After Assignment</span>
                      <span className={`${metrics.cashValue - shortPutAssignmentExposure >= 0 ? 'text-cyan-300' : 'text-rose-300'} font-semibold`}>{formatCurrency(metrics.cashValue - shortPutAssignmentExposure)}</span>
                    </div>
                    <p className={`text-sm font-semibold ${metrics.cashValue - shortPutAssignmentExposure >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>{metrics.cashValue - shortPutAssignmentExposure >= 0 ? 'Covered' : 'Cash shortfall'}</p>
                  </div>
                </div>
                <div className="plan-card metric-card-violet rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-4 shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)] ring-1 ring-slate-800/60">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Plan indicators</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div className="signal-strip flex items-center justify-between px-3 py-2">
                      <span>Overweight positions</span>
                      <strong className="text-white">{overweightCount}</strong>
                    </div>
                    <div className="signal-strip flex items-center justify-between px-3 py-2">
                      <span>Underweight/watchlist</span>
                      <strong className="text-white">{underweightPositions.length + watchlistAddCandidates.length}</strong>
                    </div>
                    <div className="signal-strip flex items-center justify-between px-3 py-2">
                      <span>Hedge status</span>
                      <strong className="text-white">{hedgeStatus}</strong>
                    </div>
                    <div className="signal-strip flex items-center justify-between px-3 py-2">
                      <span>Options exposure</span>
                      <strong className="text-white">{metrics.optionsExposure > settings.maxOptionsExposurePercent ? 'High' : 'Normal'}</strong>
                    </div>
                    <div className="signal-strip flex items-center justify-between px-3 py-2">
                      <span>Short put exposure</span>
                      <strong className="text-amber-300">{shortPutAssignmentExposure > 0 ? formatCurrency(shortPutAssignmentExposure) : 'None'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-5 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Trim Candidates</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Positions to review</h2>
                    <p className="mt-1 text-sm text-slate-400">Trade Plan groups stocks and calls by ticker. Puts are excluded here and tracked separately in short put exposure.</p>
                  </div>
                </div>
                <div className="data-table-panel overflow-hidden">
                  <table className="data-table w-full table-fixed divide-y divide-slate-800 text-[12px]">
                    <colgroup>
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                      <col className="w-[15%]" />
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[11%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className="bg-slate-950/70 text-slate-400">
                      <tr>
                        <th className="px-3 py-3 text-left uppercase leading-tight tracking-[0.16em] text-slate-400">Ticker</th>
                        <th className="px-3 py-3 text-left uppercase leading-tight tracking-[0.16em] text-slate-400">Mix</th>
                        <th className="px-3 py-3 text-left uppercase leading-tight tracking-[0.16em] text-slate-400">Description</th>
                        <th className="px-3 py-3 text-right uppercase leading-tight tracking-[0.16em] text-slate-400">Current %</th>
                        <th className="px-3 py-3 text-right uppercase leading-tight tracking-[0.16em] text-slate-400">Target %</th>
                        <th className="px-3 py-3 text-right uppercase leading-tight tracking-[0.16em] text-slate-400">Over %</th>
                        <th className="px-3 py-3 text-right uppercase leading-tight tracking-[0.16em] text-slate-400">Market Value</th>
                        <th className="px-3 py-3 text-right uppercase leading-tight tracking-[0.16em] text-slate-400">Unrealized</th>
                        <th className="px-3 py-3 text-left uppercase leading-tight tracking-[0.16em] text-slate-400">Reason</th>
                        <th className="px-3 py-3 text-left uppercase leading-tight tracking-[0.16em] text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredTrimmedPositions.length ? filteredTrimmedPositions.map((position) => (
                        <tr key={position.id} className="data-row hover:bg-slate-900/80 transition-colors duration-150">
                          <td className="px-3 py-3 text-slate-100"><span className="ticker-chip">{position.ticker}</span></td>
                          <td className="truncate px-3 py-3 text-slate-300">{position.positionMix}</td>
                          <td className="truncate px-3 py-3 text-slate-300">{position.description}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">{formatPercent(position.currentPercent)}</td>
                          <td className="px-3 py-3 text-slate-100">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              placeholder="Set %"
                              value={position.targetWeightPercent > 0 ? position.targetWeightPercent : ''}
                              onChange={(e) => handleGroupedTargetChange(position.ticker, e.target.value)}
                              className="table-input w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-right text-slate-100 outline-none ring-1 ring-slate-800/40 placeholder:text-slate-500"
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-amber-200">{position.displayOverTarget}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">{formatCurrency(position.marketValue)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">{formatCurrency(position.unrealizedPL)}</td>
                          <td className="truncate px-3 py-3 text-slate-300">{position.trimReasons.join(' - ')}</td>
                          <td className="truncate px-3 py-3 text-slate-100">{position.suggestedAction}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={10} className="px-3 py-12 text-center text-slate-400">No trim candidates detected based on current thresholds.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-5 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Add Candidates</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Opportunities to add</h2>
                  </div>
                </div>
                <div className="data-table-panel overflow-hidden">
                  <table className="data-table w-full table-fixed divide-y divide-slate-800 text-[12px]">
                    <colgroup>
                      <col className="w-[8%]" />
                      <col className="w-[18%]" />
                      <col className="w-[11%]" />
                      <col className="w-[12%]" />
                      <col className="w-[13%]" />
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                    </colgroup>
                    <thead className="bg-slate-950/70 text-slate-400">
                      <tr>
                        {['Ticker', 'Company / Description', 'Current Price', 'Buy Zone', 'Strong Buy Zone', 'Target %', 'Current %', 'Strategy', 'Suggested Action'].map((label) => (
                          <th key={label} className={`px-3 py-3 uppercase leading-tight tracking-[0.16em] text-slate-400 ${['Current Price', 'Target %', 'Current %'].includes(label) ? 'text-right' : 'text-left'}`}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {addCandidates.length ? addCandidates.map((item) => (
                        <tr key={item.id} className="data-row hover:bg-slate-900/80 transition-colors duration-150">
                          <td className="px-3 py-3 text-slate-100"><span className="ticker-chip">{item.ticker}</span></td>
                          <td className="truncate px-3 py-3 text-slate-300">{item.description}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">{item.currentPrice ? formatCurrency(item.currentPrice) : 'N/A'}</td>
                          <td className="truncate px-3 py-3 text-slate-100">{item.buyZone}</td>
                          <td className="truncate px-3 py-3 text-slate-100">{item.strongBuyZone}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">{formatPercent(item.targetPercent)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-slate-100">{formatPercent(item.currentPercent)}</td>
                          <td className="truncate px-3 py-3 text-slate-100">{item.strategy}</td>
                          <td className="truncate px-3 py-3 text-slate-300">{item.suggestedAction}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={9} className="px-3 py-12 text-center text-slate-400">No add candidates available yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Hedge / Protection Plan</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">Hedge posture</h3>
                    </div>
                    <span className="rounded-3xl bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-400/15">{hedgeStatus}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Current hedge %</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(metrics.hedgeAllocation)}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Minimum hedge</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(settings.minHedgePercent)}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div>
                      <p className="text-slate-400">Current hedge positions</p>
                      <p className="mt-2 text-white">{hedgePositions.length ? hedgePositions.map((position) => position.ticker).join(', ') : 'None'}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4">
                      <p className="text-slate-300">Consider adding hedge exposure, but keep position sizing controlled.</p>
                    </div>
                  </div>
                </div>

                <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Cash Deployment Plan</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">Deploy excess cash</h3>
                    </div>
                    <span className="rounded-3xl bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/15">{formatPercent(settings.minCashPercent)} min cash</span>
                  </div>
                  <div className="grid gap-3">
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Cash value</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(metrics.cashValue)}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Required minimum cash</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(cashMinimumAmount)}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Excess cash</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(cashExcess)}</p>
                    </div>
                    <div className="signal-strip space-y-2 rounded-3xl p-4 text-sm text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>25% deployment</span>
                        <strong className="text-white">{formatCurrency(deployment25)}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>50% deployment</span>
                        <strong className="text-white">{formatCurrency(deployment50)}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>100% deployment</span>
                        <strong className="text-white">{formatCurrency(deployment100)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                <div className="mb-4">
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Manual Trade Plan Notes</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Current strategy notes</h3>
                </div>
                <textarea
                  value={tradePlanNotes}
                  onChange={(e) => setTradePlanNotes(e.target.value)}
                  placeholder="Capture your current trade plan, ideas and reminders."
                  className="control-shell min-h-[220px] w-full rounded-[1.5rem] border border-slate-800 bg-slate-950/90 px-5 py-4 text-sm text-slate-100 outline-none ring-1 ring-slate-800/40 shadow-sm focus:ring-cyan-400/40"
                />
              </div>
            </section>
          )}

          {activeTab === 'Settings' && (
            <section className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Risk thresholds</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Configure limits</h2>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {[
                      { key: 'maxSinglePositionPercent', label: 'Max single position %' },
                      { key: 'maxTop5ConcentrationPercent', label: 'Max top 5 concentration %' },
                      { key: 'minCashPercent', label: 'Min cash %' },
                      { key: 'minHedgePercent', label: 'Min hedge %' },
                      { key: 'maxSpeculativePercent', label: 'Max speculative %' },
                      { key: 'maxOptionsExposurePercent', label: 'Max options exposure %' },
                      { key: 'maxLeveragedExposurePercent', label: 'Max leveraged ETF exposure %' },
                    ].map((item) => (
                      <label key={item.key} className="block">
                        <span className="field-label text-sm text-slate-400">{item.label}</span>
                        <input type="number" step="0.1" value={settings[item.key]} onChange={(e) => setSettings((current) => ({ ...current, [item.key]: Number(e.target.value) }))} className="control-shell mt-2 w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/5" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Data tools</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Import, export, reset</h2>
                  <div className="mt-6 space-y-4">
                    <div className="signal-strip rounded-3xl p-4">
                      <p className="text-sm text-slate-300">CSV portfolio import</p>
                      <input type="file" accept=".csv" onChange={handleCsvUpload} className="file-input mt-3 w-full text-sm" />
                      {csvMessage && <p className="mt-3 text-sm text-slate-400">{csvMessage}</p>}
                    </div>
                    <div className="signal-strip rounded-3xl p-4">
                      <p className="text-sm text-slate-300">JSON backup export</p>
                      <button type="button" onClick={handleExportBackup} className="action-button mt-3 gap-2 px-4 py-3 text-sm">
                        <Download className="h-4 w-4" /> Export JSON backup
                      </button>
                    </div>
                    <div className="signal-strip rounded-3xl p-4">
                      <p className="text-sm text-slate-300">JSON backup import</p>
                      <input type="file" accept="application/json" onChange={handleJsonImport} className="file-input mt-3 w-full text-sm" />
                      {jsonMessage && <p className="mt-3 text-sm text-slate-400">{jsonMessage}</p>}
                    </div>
                    <div className="signal-strip rounded-3xl p-4">
                      <p className="text-sm text-slate-300">Reset app data</p>
                      <button type="button" onClick={handleResetAll} className="action-button is-danger mt-3 gap-2 px-4 py-3 text-sm">
                        <RefreshCcw className="h-4 w-4" /> Reset all data
                      </button>
                    </div>
                    <div className="signal-strip rounded-3xl p-4">
                      <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Testing / Demo Tools</p>
                      <h3 className="mt-2 text-sm font-semibold text-white">Sample portfolio loader</h3>
                      <p className="mt-2 text-sm text-slate-400">This replaces current portfolio data with demo data for testing.</p>
                      <button type="button" onClick={loadSamplePortfolio} className="action-button mt-4 gap-2 px-4 py-3 text-sm">
                        <Plus className="h-4 w-4" /> Load demo/sample portfolio
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Import summary</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Data status</h3>
                  </div>
                  <div className="control-shell rounded-3xl bg-slate-950/70 px-4 py-3 text-sm text-slate-300 ring-1 ring-white/10">
                    Last import {lastImportLabel}
                  </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                    <p className="text-slate-400">Imported positions</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{metrics.positionsCount}</p>
                  </div>
                  <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                    <p className="text-slate-400">Total market value</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(metrics.totalMarketValue)}</p>
                  </div>
                  <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                    <p className="text-slate-400">Risk threshold set</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{Object.keys(settings).length}</p>
                  </div>
                </div>
              </div>

              {csvDiagnostics && (
                <div className="data-panel rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)] ring-1 ring-white/5 backdrop-blur-xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Import diagnostics</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">CSV parser results</h3>
                    </div>
                    <button type="button" onClick={handleDownloadDiagnostics} className="action-button gap-2 px-4 py-3 text-sm">
                      <Download className="h-4 w-4" /> Download diagnostics JSON
                    </button>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">File name</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.fileName || 'unknown'}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Format detected</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.formatName || 'Unknown'}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Header row index</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.headerRowIndex ?? 'N/A'}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Skipped rows</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.skippedCount ?? 0}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Broker reported value</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.brokerReportedTotalMarketValue != null ? formatCurrency(csvDiagnostics.brokerReportedTotalMarketValue) : 'N/A'}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Calculated total value</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.calculatedTotalMarketValue != null ? formatCurrency(csvDiagnostics.calculatedTotalMarketValue) : 'N/A'}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Broker reported gain/loss</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.brokerReportedTotalGainLoss != null ? formatCurrency(csvDiagnostics.brokerReportedTotalGainLoss) : 'N/A'}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Calculated unrealized P/L</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.calculatedUnrealizedPL != null ? formatCurrency(csvDiagnostics.calculatedUnrealizedPL) : 'N/A'}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Cash imported</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.cashImported ? 'Yes' : 'No'}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Option rows</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.optionRowsImported ?? 0}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Short option rows</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.shortOptionRowsImported ?? 0}</p>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Zero quantity rows</p>
                      <p className="mt-2 text-sm text-white">{csvDiagnostics.positionsWithZeroQuantity ?? 0}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Headers detected</p>
                      <pre className="diagnostic-code mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{csvDiagnostics.detectedHeaders?.join(', ') || 'None'}</pre>
                    </div>
                    <div className="signal-strip rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-slate-400">Auto mapped fields</p>
                      <pre className="diagnostic-code mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{Object.keys(csvDiagnostics.autoMappedFields || {}).length ? JSON.stringify(csvDiagnostics.autoMappedFields, null, 2) : 'No fields mapped'}</pre>
                    </div>
                  </div>
                  {csvDiagnostics.skippedRows?.length > 0 && (
                    <div className="signal-strip mt-6 rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-sm text-slate-400">Skipped rows</p>
                      <ul className="mt-3 space-y-2 text-slate-200">
                        {csvDiagnostics.skippedRows.map((row, index) => (
                          <li key={`skipped-${index}`} className="diagnostic-code rounded-2xl px-3 py-2">
                            <div className="text-xs text-slate-400">{row.line ? `Line ${row.line}` : `Row ${index + 1}`}</div>
                            <div>{row.reason || JSON.stringify(row)}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {csvDiagnostics.preview?.length > 0 && (
                    <div className="signal-strip mt-6 rounded-3xl p-4 text-sm text-slate-300">
                      <p className="text-sm text-slate-400">Preview rows</p>
                      <pre className="diagnostic-code mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{JSON.stringify(csvDiagnostics.preview, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
