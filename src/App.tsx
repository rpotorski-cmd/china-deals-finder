import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  SlidersHorizontal,
  Star,
  ShoppingCart,
  ExternalLink,
  TrendingDown,
  Package,
  RefreshCw,
  ChevronDown,
  X,
  Flame,
  Tag,
  ArrowUpDown,
  Loader2,
  Rocket,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
} from 'lucide-react'
import './App.css'

interface Product {
  source: string
  category: string
  title: string
  price: number
  original_price?: number
  discount?: number
  image?: string
  url?: string
  orders?: number
  rating?: number
  scraped_at: string
}

interface DealsData {
  scraped_at: string
  total_products: number
  products: Product[]
}

type SortOption = 'discount' | 'price_asc' | 'price_desc' | 'orders' | 'rating'

interface ExtractedSpecs {
  cpu?: string
  ram?: string
  storage?: string
  screenSize?: string
  color?: string
  [key: string]: string | undefined
}

const SPEC_LABELS: Record<string, string> = {
  cpu: 'Procesor',
  ram: 'RAM',
  storage: 'Dysk',
  screenSize: 'Ekran',
  color: 'Kolor',
}

function extractSpecs(title: string): ExtractedSpecs {
  const specs: ExtractedSpecs = {}
  const t = title.toLowerCase()

  const cpuPatterns = [
    /\b(intel\s+core\s+i[3579][-\s]?\d{3,5}[a-z]*)/i,
    /\b(i[3579][-\s]?\d{3,5}[a-z]*)/i,
    /\b(ryzen\s+[3579]\s+\d{3,5}[a-z]*)/i,
    /\b(ryzen\s+[3579])/i,
    /\b(intel\s+n\d{2,4}[a-z]?)/i,
    /\b(n\d{3,4}[a-z]?)/i,
    /\b(celeron\s+[a-z]?\d{3,5})/i,
    /\b(pentium\s+\w+)/i,
    /\b(apple\s+m[1-4]\s*(?:pro|max|ultra)?)/i,
    /\b(m[1-4]\s*(?:pro|max|ultra)?\s+chip)/i,
    /\b(snapdragon\s+\d{3,4})/i,
    /\b(dimensity\s+\d{3,4})/i,
    /\b(helio\s+[a-z]\d{2,3})/i,
    /\b(a\d{2}\s+bionic)/i,
  ]
  for (const pattern of cpuPatterns) {
    const match = title.match(pattern)
    if (match) {
      specs.cpu = match[1].trim().replace(/\s+/g, ' ')
      break
    }
  }

  const ramMatch = title.match(/\b(\d{1,3})\s*gb\s*(?:ram|ddr[45]?|memory|pamięci?)/i)
    || title.match(/\bram\s*(\d{1,3})\s*gb/i)
    || title.match(/\b(\d{1,3})\s*gb\b/i)
  if (ramMatch) {
    const val = parseInt(ramMatch[1])
    if ([2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 128].includes(val)) {
      specs.ram = val + ' GB'
    }
  }

  const storageMatch = title.match(/\b(\d+)\s*tb\s*(?:ssd|hdd|nvme|m\.?2|storage|dysk|emmc)?/i)
    || title.match(/\b(\d{3,4})\s*gb\s*(?:ssd|hdd|nvme|m\.?2|storage|dysk|emmc)/i)
    || title.match(/\b(?:ssd|hdd|nvme|m\.?2|storage|dysk|emmc)\s*(\d+)\s*(?:gb|tb)/i)
  if (storageMatch) {
    const raw = storageMatch[0].toLowerCase()
    if (raw.includes('tb')) {
      specs.storage = parseInt(storageMatch[1]) + ' TB'
    } else {
      specs.storage = parseInt(storageMatch[1]) + ' GB'
    }
  }

  const screenMatch = title.match(/\b(\d{1,2}[.,]?\d?)\s*(?:cal[ei]?|inch|["″\'']|cali)\b/i)
    || title.match(/\b(\d{1,2}[.,]?\d?)\s*(?:cm)?\s*(?:ekran|screen|display|monitor|wyświetlacz)/i)
  if (screenMatch) {
    const val = parseFloat(screenMatch[1].replace(',', '.'))
    if (val >= 4 && val <= 100) {
      specs.screenSize = val + '"'
    }
  }

  const colorPatterns = /\b(czarn[ya]|biał[ya]|czerwon[ya]|niebiesk[ia]|zielon[ya]|szar[ya]|różow[ya]|fioletow[ya]|złot[ya]|srebrn[ya]|black|white|red|blue|green|gray|grey|pink|purple|gold|silver|rose gold)\b/i
  const colorMatch = t.match(colorPatterns)
  if (colorMatch) {
    specs.color = colorMatch[1].charAt(0).toUpperCase() + colorMatch[1].slice(1).toLowerCase()
  }

  return specs
}

const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  AliExpress: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  Temu: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
}

const SORT_LABELS: Record<SortOption, string> = {
  discount: 'Największy rabat',
  price_asc: 'Cena: rosnąco',
  price_desc: 'Cena: malejąco',
  orders: 'Najpopularniejsze',
  rating: 'Najlepiej oceniane',
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'przed chwilą'
  if (diffMins < 60) return `${diffMins} min temu`
  if (diffHours < 24) return `${diffHours} godz. temu`
  return `${diffDays} dni temu`
}

function ProductCard({ product }: { product: Product }) {
  const sourceStyle = SOURCE_COLORS[product.source] || {
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
  }

  return (
    <div className="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-600 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5 flex flex-col">
      {/* Image */}
      <div className="relative aspect-square bg-gray-800 overflow-hidden">
        <img
          src={product.image || 'https://placehold.co/300x300/1a1a2e/666?text=No+Image'}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://placehold.co/300x300/1a1a2e/666?text=No+Image'
          }}
        />

        {product.discount && product.discount >= 50 && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-lg">
            <Flame size={12} />
            -{product.discount}%
          </div>
        )}
        {product.discount && product.discount > 0 && product.discount < 50 && (
          <div className="absolute top-3 left-3 bg-orange-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1">
            <Tag size={12} />
            -{product.discount}%
          </div>
        )}

        <div
          className={`absolute top-3 right-3 ${sourceStyle.bg} ${sourceStyle.text} border ${sourceStyle.border} text-xs font-medium px-2 py-1 rounded-lg backdrop-blur-sm`}
        >
          {product.source}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <p className="text-gray-300 text-sm leading-snug line-clamp-2 mb-3 flex-1">
          {product.title}
        </p>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-bold text-white">
            ${product.price?.toFixed(2)}
          </span>
          {product.original_price && (
            <span className="text-sm text-gray-500 line-through">
              ${product.original_price.toFixed(2)}
            </span>
          )}
          {product.discount && product.original_price && (
            <span className="text-xs font-medium text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
              Oszcz. ${(product.original_price - product.price).toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          {product.rating && (
            <span className="flex items-center gap-1">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              {product.rating}
            </span>
          )}
          {product.orders && (
            <span className="flex items-center gap-1">
              <ShoppingCart size={12} />
              {formatNumber(product.orders)} sprzed.
            </span>
          )}
        </div>

        {product.url && (
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200"
          >
            Zobacz ofertę
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  )
}

function App() {
  const [data, setData] = useState<DealsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('price_asc')
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [minDiscount, setMinDiscount] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [scrapeQuery, setScrapeQuery] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeStatus, setScrapeStatus] = useState('')
  const [scrapeSource, setScrapeSource] = useState<'all' | 'aliexpress' | 'temu'>('all')
  const [specFilters, setSpecFilters] = useState<Record<string, string>>({})

  const updateSpecFilter = useCallback((key: string, value: string) => {
    setSpecFilters((prev) => {
      const next = { ...prev }
      if (value === 'all') {
        delete next[key]
      } else {
        next[key] = value
      }
      return next
    })
  }, [])

  useEffect(() => {
    fetchDeals()
  }, [])

  useEffect(() => {
    if (!scraping) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/status')
        const status = await res.json()
        setScrapeStatus(status.progress || '')
        if (!status.running) {
          setScraping(false)
          fetchDeals()
        }
      } catch {
        // server not available
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [scraping])

  const startScraping = async () => {
    if (!scrapeQuery.trim()) return
    setScraping(true)
    setScrapeStatus('Uruchamiam scraper...')
    try {
      const sources = scrapeSource === 'all' ? ['aliexpress', 'temu'] : [scrapeSource]
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: scrapeQuery, sources }),
      })
      if (!res.ok) {
        const err = await res.json()
        setScrapeStatus(err.error || 'Błąd')
        setScraping(false)
      }
    } catch {
      setScrapeStatus('Nie można połączyć z serwerem. Uruchom: python3 scraper/server.py')
      setScraping(false)
    }
  }

  const fetchDeals = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/deals.json')
      if (!res.ok) throw new Error('Failed to load deals data')
      const json: DealsData = await res.json()
      setData(json)
    } catch {
      setError(
        'Nie udało się załadować okazji. Uruchom scraper: python scraper/scraper.py'
      )
    } finally {
      setLoading(false)
    }
  }

  const sources = useMemo(() => {
    if (!data) return []
    return [...new Set(data.products.map((p) => p.source))].sort()
  }, [data])

  const categories = useMemo(() => {
    if (!data) return []
    return [...new Set(data.products.map((p) => p.category))].sort()
  }, [data])

  const productsWithSpecs = useMemo(() => {
    if (!data) return []
    return data.products.map((p) => ({ ...p, specs: extractSpecs(p.title) }))
  }, [data])

  const availableSpecKeys = useMemo(() => {
    const keyCounts: Record<string, number> = {}
    for (const p of productsWithSpecs) {
      for (const key of Object.keys(p.specs)) {
        if (p.specs[key]) keyCounts[key] = (keyCounts[key] || 0) + 1
      }
    }
    return Object.keys(keyCounts).filter((k) => keyCounts[k] >= 2).sort()
  }, [productsWithSpecs])

  const availableSpecValues = useMemo(() => {
    const result: Record<string, string[]> = {}
    for (const key of availableSpecKeys) {
      const vals = new Set<string>()
      for (const p of productsWithSpecs) {
        if (p.specs[key]) vals.add(p.specs[key]!)
      }
      const sorted = [...vals].sort((a, b) => {
        const numA = parseFloat(a)
        const numB = parseFloat(b)
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB
        return a.localeCompare(b)
      })
      result[key] = sorted
    }
    return result
  }, [productsWithSpecs, availableSpecKeys])

  const filteredProducts = useMemo(() => {
    if (!data) return []

    let products = [...productsWithSpecs]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      products = products.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
    }

    if (selectedSource !== 'all') {
      products = products.filter((p) => p.source === selectedSource)
    }

    if (selectedCategory !== 'all') {
      products = products.filter((p) => p.category === selectedCategory)
    }

    if (minDiscount > 0) {
      products = products.filter((p) => (p.discount || 0) >= minDiscount)
    }

    if (minPrice) {
      products = products.filter((p) => (p.price || 0) >= Number(minPrice))
    }

    if (maxPrice) {
      products = products.filter((p) => (p.price || 0) <= Number(maxPrice))
    }

    for (const [key, value] of Object.entries(specFilters)) {
      products = products.filter((p) => p.specs[key] === value)
    }

    products.sort((a, b) => {
      switch (sortBy) {
        case 'discount':
          return (b.discount || 0) - (a.discount || 0)
        case 'price_asc':
          return (a.price || 0) - (b.price || 0)
        case 'price_desc':
          return (b.price || 0) - (a.price || 0)
        case 'orders':
          return (b.orders || 0) - (a.orders || 0)
        case 'rating':
          return (b.rating || 0) - (a.rating || 0)
        default:
          return 0
      }
    })

    return products
  }, [data, productsWithSpecs, searchQuery, selectedSource, selectedCategory, sortBy, minDiscount, minPrice, maxPrice, specFilters])

  const stats = useMemo(() => {
    if (!data) return { total: 0, avgDiscount: 0, maxDiscount: 0, avgPrice: 0 }
    const products = data.products
    const discounts = products.map((p) => p.discount || 0).filter((d) => d > 0)
    return {
      total: products.length,
      avgDiscount: discounts.length
        ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length)
        : 0,
      maxDiscount: Math.max(...discounts, 0),
      avgPrice:
        products.length > 0
          ? products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length
          : 0,
    }
  }, [data])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <TrendingDown size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Okazje z Chin</h1>
                <p className="text-xs text-gray-500">
  {data
                    ? `${stats.total} okazji \u00b7 Odświeżono ${timeAgo(data.scraped_at)}`
                    : 'Ładowanie...'}
                </p>
              </div>
            </div>

            <button
              onClick={fetchDeals}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
              title="Odśwież okazje"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20 rounded-2xl p-5 mb-6">
          <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <Rocket size={18} className="text-purple-400" />
            Szukaj nowych okazji
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Wpisz czego szukasz, np. mini pc, słuchawki bluetooth, smartwatch"
              value={scrapeQuery}
              onChange={(e) => setScrapeQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !scraping && startScraping()}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
              disabled={scraping}
            />
            <select
              value={scrapeSource}
              onChange={(e) => setScrapeSource(e.target.value as 'all' | 'aliexpress' | 'temu')}
              className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
              disabled={scraping}
            >
              <option value="all">AliExpress + Temu</option>
              <option value="aliexpress">Tylko AliExpress</option>
              <option value="temu">Tylko Temu</option>
            </select>
            <button
              onClick={startScraping}
              disabled={scraping || !scrapeQuery.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm whitespace-nowrap"
            >
              {scraping ? (
                <><Loader2 size={16} className="animate-spin" /> Szukam...</>
              ) : (
                <><Search size={16} /> Szukaj okazji</>
              )}
            </button>
          </div>
          {scrapeStatus && (
            <p className={`text-xs mt-3 ${scraping ? 'text-purple-400' : 'text-gray-400'}`}>
              {scraping && <Loader2 size={12} className="inline animate-spin mr-1" />}
              {scrapeStatus}
            </p>
          )}
          <p className="text-xs text-gray-600 mt-2">
            Oddziel przecinkiem wiele fraz, np.: mini pc, drone, led strip
          </p>
        </div>

        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-gray-500">Okazji</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-400">-{stats.avgDiscount}%</p>
              <p className="text-xs text-gray-500">Śr. rabat</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-400">-{stats.maxDiscount}%</p>
              <p className="text-xs text-gray-500">Najlepszy rabat</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-purple-400">${stats.avgPrice.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Śr. cena</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              placeholder="Szukaj w okazjach..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-300 hover:border-gray-600 transition w-full sm:w-auto"
            >
              <ArrowUpDown size={16} />
              {SORT_LABELS[sortBy]}
              <ChevronDown size={14} className={`transition ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-1 z-30 w-52">
                {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSortBy(key)
                        setSortOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition ${
                        sortBy === key ? 'text-purple-400' : 'text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm transition ${
              showFilters
                ? 'bg-purple-600/20 border-purple-500/50 text-purple-400'
                : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-600'
            }`}
          >
            <SlidersHorizontal size={16} />
            Filtry
          </button>
        </div>

        {showFilters && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">
                Platforma
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSource('all')}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                    selectedSource === 'all'
                      ? 'bg-purple-600/20 border-purple-500/50 text-purple-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  Wszystkie
                </button>
                {sources.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSource(s)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                      selectedSource === s
                        ? 'bg-purple-600/20 border-purple-500/50 text-purple-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">
                Kategoria
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
              >
                <option value="all">Wszystkie kategorie</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">
                Zakres cen ($)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Od"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
                  min={0}
                  step={0.01}
                />
                <input
                  type="number"
                  placeholder="Do"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium mb-1.5 block">
                Min. rabat: {minDiscount}%
              </label>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minDiscount}
                onChange={(e) => setMinDiscount(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0%</span>
                <span>90%</span>
              </div>
            </div>
          </div>

          {availableSpecKeys.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 font-medium mb-3 flex items-center gap-1.5">
                <Cpu size={14} className="text-purple-400" />
                Parametry techniczne
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {availableSpecKeys.map((key) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 font-medium mb-1.5 block flex items-center gap-1">
                      {key === 'cpu' && <Cpu size={12} />}
                      {key === 'ram' && <MemoryStick size={12} />}
                      {key === 'storage' && <HardDrive size={12} />}
                      {key === 'screenSize' && <Monitor size={12} />}
                      {SPEC_LABELS[key] || key}
                    </label>
                    <select
                      value={specFilters[key] || 'all'}
                      onChange={(e) => updateSpecFilter(key, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
                    >
                      <option value="all">Wszystkie</option>
                      {(availableSpecValues[key] || []).map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {loading
              ? 'Ładowanie okazji...'
              : `Znaleziono ${filteredProducts.length} okazji`}
          </p>
          {(searchQuery || selectedSource !== 'all' || selectedCategory !== 'all' || minDiscount > 0 || minPrice || maxPrice || Object.keys(specFilters).length > 0) && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedSource('all')
                setSelectedCategory('all')
                setMinDiscount(0)
                setMinPrice('')
                setMaxPrice('')
                setSpecFilters({})
              }}
              className="text-xs text-purple-400 hover:text-purple-300 transition"
            >
              Wyczyść filtry
            </button>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw size={40} className="text-purple-500 animate-spin mb-4" />
            <p className="text-gray-500">Ładowanie okazji...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={48} className="text-gray-600 mb-4" />
            <p className="text-gray-400 mb-2">Brak danych o okazjach</p>
            <p className="text-sm text-gray-600 max-w-md">{error}</p>
            <button
              onClick={fetchDeals}
              className="mt-4 bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-xl transition"
            >
              Spróbuj ponownie
            </button>
          </div>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search size={48} className="text-gray-600 mb-4" />
            <p className="text-gray-400 mb-2">Brak okazji pasujących do filtrów</p>
            <p className="text-sm text-gray-600">
              Spróbuj zmienić kryteria wyszukiwania
            </p>
          </div>
        )}

        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product, i) => (
              <ProductCard key={`${product.source}-${product.title}-${i}`} product={product} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-gray-600">
            Okazje z Chin &middot; Ceny i dostępność mogą się zmienić &middot;
            Dane z AliExpress i Temu
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
