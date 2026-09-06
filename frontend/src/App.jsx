import React, { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowRight, BarChart3, CalendarDays, Check, CircleHelp, Compass, Fuel, Gauge, Globe2,
  Home as HomeIcon, Info, Layers, MapPin, Navigation, Package, RefreshCcw, Route as RouteIcon,
  Scale, Ship, SlidersHorizontal, Sparkles, Target, TrendingDown, TrendingUp, Warehouse,
  X, ZoomIn, ZoomOut
} from 'lucide-react'
import { PORTS_BY_COUNTRY, PORT_COORDS, PORT_COUNTRY } from './portData'
import { VESSELS } from './vesselData'

const API = (import.meta.env.VITE_API_URL || 'https://sih26006-backend.onrender.com').replace(/\/+$/, '')
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DEFAULT = {
  origin_country: 'Indonesia', origin_port: 'Balikpapan', destination_country: 'India', destination_port: 'Paradip',
  cargo_type: 'Coal', quantity_tonnes: 50000, vessel_type: 'Panamax', fuel_price_usd_tonne: 620,
  port_congestion: 0.35, month: 'March'
}
const money = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(n || 0))
const pct = n => `${Number(n || 0).toFixed(1)}%`

const COUNTRY_ISO = {
  India:'in', Indonesia:'id', Australia:'au', China:'cn', Vietnam:'vn',
  USA:'us', Canada:'ca', Brazil:'br', Argentina:'ar', Egypt:'eg',
  Japan:'jp', 'South Korea':'kr', Malaysia:'my', UAE:'ae', Oman:'om',
  'Saudi Arabia':'sa', Qatar:'qa', Thailand:'th', Morocco:'ma',
  Turkey:'tr', 'South Africa':'za', Bangladesh:'bd', Mexico:'mx',
  Netherlands:'nl', 'Sri Lanka':'lk', Colombia:'co'
}

const flag = country => COUNTRY_ISO[country] || ''

function portList(country) {
  const ports = Array.isArray(PORTS_BY_COUNTRY[country]) ? PORTS_BY_COUNTRY[country] : []
  return [...new Set(ports.filter(p => typeof p === 'string' && p.trim()))]
}

function vessel(name) {
  return VESSELS.find(v => v.name === name) || VESSELS[0] || {
    name:'Vessel',
    min:0,
    max:0,
    loa:0,
    beam:0,
    draft:0,
    holds:0,
    usage:'',
    description:''
  }
}

function safePoint(value) {
  return Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
    ? [Number(value[0]), Number(value[1])]
    : null
}

function safeRouteCoordinates(value) {
  if (!Array.isArray(value)) return []
  return value.map(safePoint).filter(Boolean)
}

function routeLabel(originCountry, destinationCountry) {
  const o = String(originCountry || '').trim()
  const d = String(destinationCountry || '').trim()
  if (o && d) return `${o} → ${d} · maritime network route`
  return 'Maritime network route'
}

async function fetchJSON(path, options = {}) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })

  const text = await r.text()
  let data = {}

  try {
    data = text ? JSON.parse(text) : {}
  } catch {}

  if (!r.ok) {
    throw new Error(data.detail || `Forecast service error (${r.status})`)
  }

  return data
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError:false, message:'' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError:true,
      message:error?.message || 'Unexpected interface error'
    }
  }

  componentDidCatch(error, info) {
    console.error('Freight Intelligence UI error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app" style={{minHeight:'100vh',padding:'40px'}}>
          <div className="panel" style={{maxWidth:'900px',margin:'0 auto'}}>
            <div className="eyebrow">APPLICATION RECOVERED</div>
            <h2>Something went wrong while rendering this scenario.</h2>
            <p>{this.state.message}</p>
            <button
              className="primaryBtn"
              onClick={() => window.location.reload()}
            >
              Reload application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function App() {
  const [page, setPage] = useState('home')
  const [form, setForm] = useState(DEFAULT)
  const [meta, setMeta] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(null)
  const [history, setHistory] = useState([])
  const [serviceOnline, setServiceOnline] = useState(false)
  const [routePreview, setRoutePreview] = useState(null)

  useEffect(() => {
    Promise.all([
      fetchJSON('/api/metadata'),
      fetchJSON('/health')
    ])
      .then(([m]) => {
        setMeta(m)
        setServiceOnline(true)
        setError('')
      })
      .catch(() => {
        setServiceOnline(false)
        setError(
          'Forecasting service is unavailable. Start the backend and refresh the page.'
        )
      })

    try {
      setHistory(
        JSON.parse(localStorage.getItem('sih26006_plans') || '[]')
      )
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(
      'sih26006_plans',
      JSON.stringify(history.slice(0, 12))
    )
  }, [history])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const originPorts = portList(form.origin_country)
    const destinationPorts = portList(form.destination_country)

    const validOrigin = Boolean(
      form.origin_country &&
      form.origin_port &&
      originPorts.includes(form.origin_port)
    )

    const validDestination = Boolean(
      form.destination_country &&
      form.destination_port &&
      destinationPorts.includes(form.destination_port)
    )

    if (
      !validOrigin ||
      !validDestination ||
      form.origin_port === form.destination_port
    ) {
      setRoutePreview(null)
      return () => controller.abort()
    }

    const q = new URLSearchParams({
      origin_port: form.origin_port,
      destination_port: form.destination_port,
      origin_country: form.origin_country,
      destination_country: form.destination_country,
    })

    const timer = setTimeout(async () => {
      try {
        const data = await fetchJSON(
          `/api/route?${q.toString()}`,
          { signal: controller.signal }
        )

        if (!cancelled) {
          setRoutePreview(data)
        }
      } catch (e) {
        if (!cancelled && e.name !== 'AbortError') {
          setRoutePreview(null)
        }
      }
    }, 120)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [
    form.origin_port,
    form.destination_port,
    form.origin_country,
    form.destination_country
  ])

  useEffect(() => {
    if (!toast) return

    const t = setTimeout(() => setToast(''), 2200)

    return () => clearTimeout(t)
  }, [toast])

  const setField = (key, value) =>
    setForm(f => ({ ...f, [key]: value }))

  const setCountry = (side, country) => {
    const ports = portList(country)

    setForm(f => {
      if (side === 'origin') {
        let nextPort = ports.includes(f.origin_port)
          ? f.origin_port
          : (ports[0] || '')

        const destinationWillMatch =
          country === f.destination_country &&
          nextPort === f.destination_port

        if (destinationWillMatch) {
          nextPort =
            ports.find(p => p !== f.destination_port) || nextPort
        }

        return {
          ...f,
          origin_country: country,
          origin_port: nextPort
        }
      }

      let nextPort = ports.includes(f.destination_port)
        ? f.destination_port
        : (ports[0] || '')

      const originWillMatch =
        country === f.origin_country &&
        nextPort === f.origin_port

      if (originWillMatch) {
        nextPort =
          ports.find(p => p !== f.origin_port) || nextPort
      }

      return {
        ...f,
        destination_country: country,
        destination_port: nextPort
      }
    })

    setError('')
  }

  const reset = () => {
    setForm(DEFAULT)
    setResult(null)
    setModal(null)
    setError('')
    setPage('home')
    setToast('Scenario reset')
  }

  const predict = async () => {
    setError('')

    const availableOriginPorts = portList(form.origin_country)
    const availableDestinationPorts = portList(form.destination_country)

    const quantity = Number(form.quantity_tonnes)
    const fuelPrice = Number(form.fuel_price_usd_tonne)
    const congestion = Number(form.port_congestion)

    if (
      !form.origin_country ||
      !form.destination_country ||
      !form.origin_port ||
      !form.destination_port
    ) {
      setError(
        'Please choose both countries and valid ports before running the forecast.'
      )
      return
    }

    if (
      !availableOriginPorts.includes(form.origin_port) ||
      !availableDestinationPorts.includes(form.destination_port)
    ) {
      setError(
        'The selected port does not belong to its selected country. Please reselect the country/port.'
      )
      return
    }

    if (form.origin_port === form.destination_port) {
      setError(
        'Please choose two different ports for the shipment route.'
      )
      return
    }

    if (!Number.isFinite(quantity) || quantity < 100) {
      setError('Quantity must be at least 100 tonnes.')
      return
    }

    if (!Number.isFinite(fuelPrice) || fuelPrice <= 0) {
      setError('Fuel price must be greater than 0.')
      return
    }

    if (
      !Number.isFinite(congestion) ||
      congestion < 0 ||
      congestion > 1
    ) {
      setError('Port congestion must be between 0 and 1.')
      return
    }

    setBusy(true)

    try {
      const payload = {
        ...form,
        quantity_tonnes: quantity,
        fuel_price_usd_tonne: fuelPrice,
        port_congestion: congestion
      }

      const data = await fetchJSON(
        '/api/predict',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      )

      setResult(data)

      const record = {
        id: Date.now(),
        created_at: new Date().toISOString(),
        input: payload,
        result: data
      }

      setHistory(h => [record, ...h].slice(0, 12))
      setToast('Forecast updated and saved on this device')
    } catch (e) {
      setError(
        e.message || 'Unable to complete the forecast.'
      )
    } finally {
      setBusy(false)
    }
  }

  const exportBrief = () => {
    if (!result) {
      setToast('Run a forecast before exporting')
      return
    }

    const text = [
      'SIH26006 FREIGHT INTELLIGENCE – DECISION BRIEF',
      '',
      `Origin: ${form.origin_port}, ${form.origin_country}`,
      `Destination: ${form.destination_port}, ${form.destination_country}`,
      `Cargo: ${form.cargo_type}`,
      `Quantity: ${money(form.quantity_tonnes)} tonnes`,
      `Forecast freight: $${result.predicted_freight_rate}/tonne`,
      `Recommended vessel: ${result.best_vessel}`,
      `Best charter month: ${result.best_charter_month}`,
      `Estimated total cost: $${money(result.estimated_total_cost)}`,
      `Indicative savings: ${result.savings_percent}%`,
      '',
      `Sea route: ${
        result.route?.label ||
        `${form.origin_port} → ${form.destination_port} · ML-ranked maritime corridor`
      }`,
    ].join('\n')

    const blob = new Blob(
      [text],
      { type: 'text/plain;charset=utf-8' }
    )

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = 'SIH26006-decision-brief.txt'
    a.click()

    URL.revokeObjectURL(url)
  }

  const nav = [
    ['home','Home',HomeIcon],
    ['forecast','Forecast',Gauge],
    ['routes','Routes',Globe2],
    ['vessels','Vessels',Ship],
    ['insights','Insights',BarChart3],
    ['about','About',Info],
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div
          className="brand"
          onClick={() => setPage('home')}
          role="button"
          tabIndex={0}
        >
          <div className="brandMark">
            <Ship size={22}/>
          </div>

          <div>
            <strong>Freight Intelligence</strong>
            <span>AI-Powered Maritime Decision Support</span>
          </div>
        </div>

        <nav>
          {nav.map(([key,label,Icon]) => (
            <button
              key={key}
              className={
                page === key
                  ? 'navBtn active'
                  : 'navBtn'
              }
              onClick={() => setPage(key)}
            >
              <Icon size={17}/>
              {label}
            </button>
          ))}
        </nav>

        <div className="topActions">
          <span
            className={
              serviceOnline
                ? "serviceStatus"
                : "serviceStatus offline"
            }
          >
            <i></i>
            {serviceOnline
              ? "AI model online"
              : "Backend offline"}
          </span>

          <button
            className="iconBtn"
            onClick={reset}
            title="Reset scenario"
          >
            <RefreshCcw size={16}/>
          </button>

          <button
            className="helpBtn"
            onClick={() => setModal('help')}
          >
            <CircleHelp size={15}/>
            Help
          </button>
        </div>
      </header>

      {error && (
        <div className="errorBar">
          <span>{error}</span>
          <button onClick={() => setError('')}>
            <X size={15}/>
          </button>
        </div>
      )}

      {page === 'home' && (
        <HomePage go={setPage}/>
      )}

      {page === 'forecast' && (
        <ForecastPage
          {...{
            form,
            setField,
            setCountry,
            meta,
            result,
            routePreview,
            setRoutePreview,
            predict,
            busy,
            setPage,
            setModal,
            exportBrief
          }}
        />
      )}

      {page === 'routes' && (
        <RoutesPage
          {...{
            form,
            setField,
            setCountry,
            meta,
            setPage,
            routePreview,
            setRoutePreview
          }}
        />
      )}

      {page === 'vessels' && (
        <VesselsPage
          meta={meta}
          form={form}
          setField={setField}
        />
      )}

      {page === 'insights' && (
        <InsightsPage
          result={result}
          form={form}
          history={history}
          setResult={setResult}
          setForm={setForm}
          onCompare={() => setModal('compare')}
          onOutlook={() => setModal('outlook')}
        />
      )}

      {page === 'about' && (
        <AboutPage />
      )}

      {modal === 'compare' && result && (
        <CompareModal
          result={result}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'outlook' && result && (
        <OutlookModal
          result={result}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'help' && (
        <HelpModal
          onClose={() => setModal(null)}
        />
      )}

      {toast && (
        <div className="toast">
          <Check size={15}/>
          {toast}
        </div>
      )}
    </div>
  )
}

function HomePage({go}) {
  return (
    <main className="pageWrap homePage">
      <section className="homeHero">
        <div className="homeCopy">
          <div className="eyebrow">
            <Sparkles size={14}/>
            SMART MARITIME DECISIONS
          </div>

          <h1>
            Predict freight.
            <br/>
            <span>Decide smarter.</span>
          </h1>

          <p>
            Turn shipment conditions into a freight forecast,
            practical sea-route view, vessel fit, charter timing
            and cost-aware recommendation.
          </p>

          <div className="homeActions">
            <button
              className="primaryBtn"
              onClick={() => go('forecast')}
            >
              Start Forecast
              <ArrowRight size={18}/>
            </button>

            <button
              className="secondaryBtn"
              onClick={() => go('routes')}
            >
              Explore Routes
            </button>
          </div>
        </div>

        <div className="homeVisual globalShippingHome">
          <img
            src="/global-shipping-routes.png"
            alt="Global shipping routes"
            className="globalShippingImage"
          />

          <div className="homeMapChip">
            <Globe2 size={18}/>
            <div>
              <b>Global maritime coverage</b>
              <span>Global shipping route network</span>
            </div>
          </div>
        </div>
      </section>

      <section className="featureGrid">
        <Feature
          icon={TrendingDown}
          title="Freight Forecast"
          text="Estimate freight rate from route, cargo, vessel, fuel and congestion inputs."
        />

        <Feature
          icon={Ship}
          title="Vessel Fit"
          text="See capacity ranges, dimensions, cargo use and current shipment fit."
        />

        <Feature
          icon={RouteIcon}
          title="Sea-Route Planning"
          text="Visualize the voyage through offshore maritime corridors instead of land."
        />

        <Feature
          icon={CalendarDays}
          title="Charter Timing"
          text="Compare the scenario across twelve planning months."
        />
      </section>
    </main>
  )
}

function Feature({icon:Icon,title,text}) {
  return (
    <div className="featureCard">
      <div className="featureIcon">
        <Icon size={19}/>
      </div>

      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

function ForecastPage({
  form,
  setField,
  setCountry,
  meta,
  result,
  routePreview,
  setRoutePreview,
  predict,
  busy,
  setPage,
  setModal,
  exportBrief
}) {
  return (
    <main className="pageWrap">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <Sparkles size={14}/>
            INTELLIGENT CHARTERING
          </div>

          <h1>
            Plan your shipment
            <br/>
            <span>with clarity.</span>
          </h1>

          <p>
            Forecast freight, understand the sea route,
            compare vessel classes and make a cost-aware
            chartering decision.
          </p>
        </div>

        <div className="heroPills">
          <span>
            <WavesIcon/>
            Sea-lane view
          </span>

          <span>
            <Ship size={14}/>
            Vessel fit
          </span>

          <span>
            <TrendingUp size={14}/>
            Forecast
          </span>
        </div>
      </section>

      <section className="topGrid">
        <Scenario
          {...{
            form,
            setField,
            setCountry,
            meta,
            predict,
            busy
          }}
        />

        <RouteMap
          form={form}
          result={result}
          routePreview={routePreview}
          setRoutePreview={setRoutePreview}
          compact
        />
      </section>

      <VesselGallery
        selected={form.vessel_type}
        onSelect={v => setField('vessel_type',v)}
      />

      <section className="bottomGrid">
        <SelectedVessel form={form}/>

        <Results
          result={result}
          form={form}
          onCompare={() => setModal('compare')}
          onOutlook={() => setModal('outlook')}
          exportBrief={exportBrief}
        />
      </section>

      {result && (
        <section className="actionStrip">
          <div>
            <b>Decision tools</b>
            <span>
              Open the full route planner or vessel guide
              without losing this scenario.
            </span>
          </div>

          <div>
            <button
              className="secondaryBtn"
              onClick={() => setPage('routes')}
            >
              Open route explorer
            </button>

            <button
              className="secondaryBtn"
              onClick={() => setPage('vessels')}
            >
              Open vessel guide
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

function WavesIcon() {
  return <span className="wavesIcon">≈</span>
}

function Scenario({
  form,
  setField,
  setCountry,
  meta,
  predict,
  busy
}) {
  const countries =
    meta?.countries ||
    Object.keys(PORTS_BY_COUNTRY).sort()

  const originPorts =
    portList(form.origin_country)

  const destinationPorts =
    portList(form.destination_country)

  const profile =
    VESSELS.find(v => v.name === form.vessel_type)

  return (
    <form
      className="panel scenario"
      onSubmit={e => {
        e.preventDefault()
        predict()
      }}
    >
      <div className="panelHeader">
        <div>
          <div className="eyebrow">
            ⚓ SHIPMENT DETAILS
          </div>

          <h2>Build your shipment</h2>

          <p>
            Port lists automatically follow the country you choose.
          </p>
        </div>

        <SlidersHorizontal size={20}/>
      </div>

      <div className="fields">
        <Field label="Origin Country">
          <div className="inputWithIcon">
            <span className="flagBadge">
              <img
                src={`https://flagcdn.com/w40/${flag(form.origin_country)}.png`}
                alt=""
                aria-hidden="true"
                onError={e => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </span>

            <select
              value={form.origin_country}
              onChange={e =>
                setCountry('origin',e.target.value)
              }
            >
              {countries.map(c => (
                <option
                  key={c}
                  value={c}
                >
                  {c}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Origin Port">
          <div className="inputWithIcon">
            <MapPin size={15}/>

            <select
              value={form.origin_port}
              onChange={e =>
                setField('origin_port',e.target.value)
              }
            >
              {originPorts.map(p => (
                <option key={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Destination Country">
          <div className="inputWithIcon">
            <span className="flagBadge">
              <img
                src={`https://flagcdn.com/w40/${flag(form.destination_country)}.png`}
                alt=""
                aria-hidden="true"
                onError={e => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </span>

            <select
              value={form.destination_country}
              onChange={e =>
                setCountry('destination',e.target.value)
              }
            >
              {countries.map(c => (
                <option
                  key={c}
                  value={c}
                >
                  {c}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Destination Port">
          <div className="inputWithIcon">
            <MapPin size={15}/>

            <select
              value={form.destination_port}
              onChange={e =>
                setField('destination_port',e.target.value)
              }
            >
              {destinationPorts.map(p => (
                <option key={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <div className="routeStrip">
          <MapPin size={15}/>
          <b>{form.origin_port}</b>
          <ArrowRight size={14}/>
          <b>{form.destination_port}</b>
          <span>Sea route updates automatically</span>
        </div>

        <Field label="Cargo Type">
          <div className="inputWithIcon">
            <Package size={15}/>

            <select
              value={form.cargo_type}
              onChange={e =>
                setField('cargo_type',e.target.value)
              }
            >
              {(
                meta?.cargo_types ||
                [
                  'Coal',
                  'Iron Ore',
                  'Grain',
                  'Sugar',
                  'Fertilizer',
                  'Cement'
                ]
              ).map(c => (
                <option key={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Quantity (tonnes)">
          <div className="inputWithIcon">
            <Scale size={15}/>

            <input
              type="number"
              min="100"
              value={form.quantity_tonnes}
              onChange={e =>
                setField(
                  'quantity_tonnes',
                  e.target.value
                )
              }
            />
          </div>
        </Field>

        <Field
          label="Vessel Type"
          help="See size instantly"
        >
          <div className="inputWithIcon">
            <Ship size={15}/>

            <select
              value={form.vessel_type}
              onChange={e =>
                setField(
                  'vessel_type',
                  e.target.value
                )
              }
            >
              {VESSELS.map(v => (
                <option key={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Fuel Price (USD/tonne)">
          <div className="inputWithIcon">
            <Fuel size={15}/>

            <input
              type="number"
              min="1"
              step="0.01"
              value={form.fuel_price_usd_tonne}
              onChange={e =>
                setField(
                  'fuel_price_usd_tonne',
                  e.target.value
                )
              }
            />
          </div>
        </Field>

        <Field label="Port Congestion (0–1)">
          <div className="inputWithIcon">
            <Gauge size={15}/>

            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.port_congestion}
              onChange={e =>
                setField(
                  'port_congestion',
                  e.target.value
                )
              }
            />
          </div>
        </Field>

        <Field label="Preferred Month">
          <div className="inputWithIcon">
            <CalendarDays size={15}/>

            <select
              value={form.month}
              onChange={e =>
                setField('month',e.target.value)
              }
            >
              {MONTHS.map(m => (
                <option key={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </Field>
      </div>

      {profile && (
        <div className="vesselPeek">
          <img
            src={profile.image}
            alt={profile.name}
          />

          <div>
            <b>{profile.name}</b>

            <strong>
              {profile.min.toLocaleString()}–
              {profile.max.toLocaleString()} DWT
            </strong>

            <span>
              {profile.description}
            </span>
          </div>

          <ChevronRightIcon/>
        </div>
      )}

      {/* Use example removed.
          Predict button now uses full available width. */}
      <div className="formActions">
        <button
          className="primaryBtn"
          disabled={busy}
        >
          <TrendingUp size={16}/>
          {busy
            ? 'Calculating…'
            : 'Predict Freight & Show Insights'}
          <ArrowRight size={17}/>
        </button>
      </div>
    </form>
  )
}

function ChevronRightIcon() {
  return <span className="peekArrow">›</span>
}

function Field({label,help,children}) {
  return (
    <label className="field">
      <span className="fieldLabel">
        {label}
        {help && <em>{help}</em>}
      </span>

      {children}
    </label>
  )
}

function RouteMap({
  form,
  result,
  routePreview,
  setRoutePreview,
  compact
}) {
  const el = useRef(null)
  const mapRef = useRef(null)

  const layers = useRef({
    sat:null,
    street:null,
    labels:null,
    route:null,
    ports:null,
    ship:null,
    origin:null,
    dest:null
  })

  const [base,setBase] =
    useState('satellite')

  const [showPorts,setShowPorts] =
    useState(true)

  const activeRoute =
    result?.route?.coordinates?.length
      ? result.route
      : routePreview

  const route =
    safeRouteCoordinates(
      activeRoute?.coordinates
    )

  const distance =
    Number(
      activeRoute?.distance_nm || 0
    )

  const travelMin =
    distance > 0
      ? Math.max(
          1,
          Math.round(distance / 320)
        )
      : 0

  const travelMax =
    distance > 0
      ? Math.max(
          travelMin + 1,
          Math.round(distance / 250)
        )
      : 0

  const vName =
    result?.best_vessel ||
    form.vessel_type

  const v = vessel(vName)

  const origin =
    safePoint(
      PORT_COORDS[form.origin_port]
    )

  const dest =
    safePoint(
      PORT_COORDS[form.destination_port]
    )

  const shipPoint =
    route.length > 1
      ? route[
          Math.min(
            route.length - 1,
            Math.max(
              1,
              Math.floor(route.length * 0.56)
            )
          )
        ]
      : null

  useEffect(() => {
    if (!el.current || mapRef.current) {
      return
    }

    const map = L.map(el.current, {
      zoomControl:false,
      attributionControl:true,
      worldCopyJump:true,
      minZoom:2
    })

    const sat =
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom:18,
          attribution:'Tiles © Esri'
        }
      )

    const street =
      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom:19,
          attribution:'© OpenStreetMap contributors'
        }
      )

    const labels =
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom:18,
          opacity:0.75,
          attribution:'Esri reference labels & boundaries'
        }
      )

    sat.addTo(map)
    labels.addTo(map)

    layers.current.sat = sat
    layers.current.street = street
    layers.current.labels = labels

    const routeLayer =
      L.polyline(
        [],
        {
          color:'#ffd21f',
          weight:5,
          dashArray:'12 10',
          lineCap:'round',
          lineJoin:'round',
          opacity:.96,
          interactive:false
        }
      ).addTo(map)

    layers.current.route =
      routeLayer

    const group =
      L.layerGroup().addTo(map)

    layers.current.ports =
      group

    Object.entries(PORT_COORDS)
      .forEach(([name, coord]) => {
        const point = safePoint(coord)

        if (!point) return

        const marker =
          L.circleMarker(
            point,
            {
              radius:4,
              weight:1,
              color:'#e7f5ff',
              fillColor:'#19aafc',
              fillOpacity:.62,
              opacity:.75
            }
          )

        marker.bindTooltip(
          `<b>${name}</b><br/><span>${PORT_COUNTRY[name] || ''}</span>`,
          {
            sticky:true,
            direction:'top'
          }
        )

        marker.addTo(group)
      })

    layers.current.origin =
      L.circleMarker(
        origin || [0,0],
        {
          radius:8,
          color:'#fff',
          weight:2,
          fillColor:'#ff5f67',
          fillOpacity:1
        }
      ).addTo(map)

    layers.current.dest =
      L.circleMarker(
        dest || [0,0],
        {
          radius:8,
          color:'#fff',
          weight:2,
          fillColor:'#25c98b',
          fillOpacity:1
        }
      ).addTo(map)

    layers.current.ship =
      L.marker(
        shipPoint ||
          origin ||
          [0,0],
        {
          icon:L.divIcon({
            className:'shipDivIcon',
            html:'🚢',
            iconSize:[30,30],
            iconAnchor:[15,15]
          })
        }
      ).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()

      mapRef.current = null

      layers.current = {
        sat:null,
        street:null,
        labels:null,
        route:null,
        ports:null,
        ship:null,
        origin:null,
        dest:null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current

    if (!map) return

    if (base === 'satellite') {
      if (!map.hasLayer(layers.current.sat)) {
        layers.current.sat.addTo(map)
      }

      if (
        map.hasLayer(
          layers.current.street
        )
      ) {
        map.removeLayer(
          layers.current.street
        )
      }
    } else {
      if (
        !map.hasLayer(
          layers.current.street
        )
      ) {
        layers.current.street.addTo(map)
      }

      if (
        map.hasLayer(
          layers.current.sat
        )
      ) {
        map.removeLayer(
          layers.current.sat
        )
      }
    }

    if (layers.current.route) {
      layers.current.route.setLatLngs(route)
    }

    if (origin) {
      layers.current.origin?.setLatLng(origin)
    }

    if (dest) {
      layers.current.dest?.setLatLng(dest)
    }

    if (shipPoint) {
      layers.current.ship?.setLatLng(shipPoint)
    }

    layers.current.origin?.setTooltipContent(
      `<b>${form.origin_port || 'Origin'}</b><br/>Origin · ${form.origin_country || ''}`
    )

    layers.current.dest?.setTooltipContent(
      `<b>${form.destination_port || 'Destination'}</b><br/>Destination · ${form.destination_country || ''}`
    )

    layers.current.ship?.setTooltipContent(
      `${vName} · selected vessel`
    )

    layers.current.ports?.eachLayer(
      m =>
        m.setStyle({
          opacity: showPorts ? .75 : 0,
          fillOpacity: showPorts ? .62 : 0
        })
    )

    if (route.length > 1) {
      map.fitBounds(
        L.latLngBounds(route),
        {
          padding:[42,42],
          animate:false,
          maxZoom:5
        }
      )
    } else if (origin && dest) {
      map.fitBounds(
        L.latLngBounds([origin,dest]),
        {
          padding:[42,42],
          animate:false,
          maxZoom:5
        }
      )
    }
  }, [
    base,
    showPorts,
    JSON.stringify(route),
    form.origin_port,
    form.destination_port,
    form.origin_country,
    form.destination_country,
    vName
  ])

  return (
    <section
      className={`panel routePanel ${
        compact ? 'compact' : ''
      }`}
    >
      <div className="routeHeader">
        <div>
          <div className="eyebrow">
            <Globe2 size={15}/>
            GLOBAL SHIPPING ROUTE
          </div>

          <h2>
            {form.origin_port}
            {' '}
            <span>→</span>
            {' '}
            {form.destination_port}
          </h2>

          <p>
            {
              activeRoute?.selection_method ||
              'Select ports to load the maritime route.'
            }
          </p>
        </div>

        <div className="legend">
          <span>
            <i className="dot red"/>
            Origin Port
          </span>

          <span>
            <i className="dot green"/>
            Destination Port
          </span>

          <span>
            <i className="dot yellow"/>
            ML Shipping Route
          </span>
        </div>
      </div>

      <div className="mapShell">
        <div
          ref={el}
          className="leafletMap"
        ></div>

        <div className="mapToolbar">
          <button
            className={
              base === 'satellite'
                ? 'mapBtn active'
                : 'mapBtn'
            }
            onClick={() => setBase('satellite')}
          >
            <Layers size={14}/>
            Satellite
          </button>

          <button
            className={
              base === 'street'
                ? 'mapBtn active'
                : 'mapBtn'
            }
            onClick={() => setBase('street')}
          >
            <Globe2 size={14}/>
            Map
          </button>

          <button
            className="mapBtn"
            onClick={() =>
              route.length > 1 &&
              mapRef.current?.fitBounds(
                L.latLngBounds(route),
                {
                  padding:[42,42],
                  animate:false
                }
              )
            }
          >
            <Target size={14}/>
            Focus Route
          </button>

          <button
            className={
              showPorts
                ? 'mapBtn'
                : 'mapBtn muted'
            }
            onClick={() =>
              setShowPorts(v => !v)
            }
          >
            <MapPin size={14}/>
            {showPorts
              ? 'Showing ports'
              : 'Show ports'}
          </button>
        </div>

        <div className="mapZoom">
          <button
            onClick={() =>
              mapRef.current?.zoomIn()
            }
          >
            <ZoomIn size={15}/>
          </button>

          <button
            onClick={() =>
              mapRef.current?.zoomOut()
            }
          >
            <ZoomOut size={15}/>
          </button>
        </div>

        <div className="mapBadge">
          {Object.keys(PORT_COORDS).length} ports mapped
        </div>

      </div>

      <div className="routeInfo">
        <div className="routeInfoTitle">
          <RouteIcon size={16}/>
          Route information
        </div>

        <div className="routeInfoGrid">
          <div>
            <span>Origin port</span>
            <b>{form.origin_port}</b>
          </div>

          <div>
            <span>Destination port</span>
            <b>{form.destination_port}</b>
          </div>

          <div>
            <span>Distance (approx.)</span>
            <b>
              {distance
                ? `${money(distance)} nm`
                : 'Waiting for route'}
            </b>
          </div>

          <div>
            <span>Estimated travel time</span>
            <b>
              {distance
                ? `${travelMin}–${travelMax} days`
                : '—'}
            </b>
          </div>

          <div className="wide">
            <span>Shipping route</span>
            <b>
              {
                activeRoute?.label ||
                routeLabel(
                  form.origin_country,
                  form.destination_country
                )
              }
            </b>
          </div>
        </div>

        <div className="routeVessel">
          <Ship size={16}/>

          <div>
            <b>{vName}</b>

            <span>
              {v.min.toLocaleString()}–
              {v.max.toLocaleString()} DWT · selected vessel
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function VesselGallery({selected,onSelect}) {
  return (
    <section className="panel vesselGallery">
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">
            <Ship size={15}/>
            VESSEL TYPES
          </div>

          <h3>
            Select a vessel type and see its specifications
          </h3>
        </div>
      </div>

      <div className="vesselRail">
        {VESSELS.map(v => (
          <button
            type="button"
            key={v.name}
            className={
              selected === v.name
                ? 'vesselCard selected'
                : 'vesselCard'
            }
            onClick={() => onSelect(v.name)}
          >
            <img
              src={v.image}
              alt={v.name}
            />

            <div>
              <b>{v.name}</b>

              <span>
                {v.min.toLocaleString()}–
                {v.max.toLocaleString()} DWT
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function SelectedVessel({form}) {
  const v = vessel(form.vessel_type)

  return (
    <section className="panel selectedVessel">
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">
            <Ship size={15}/>
            SELECTED VESSEL DETAILS
          </div>

          <h3>{v.name} Bulk Carrier</h3>
        </div>
      </div>

      <div className="selectedGrid">
        <div className="selectedIntro">
          <img
            src={v.image}
            alt={v.name}
          />

          <div>
            <h2>{v.name} Bulk Carrier</h2>

            <strong>
              {v.min.toLocaleString()}–
              {v.max.toLocaleString()} DWT
            </strong>

            <p>
              {v.description}.
              {' '}
              Current shipment:
              {' '}
              <b>
                {money(form.quantity_tonnes)} tonnes
              </b>.
            </p>
          </div>
        </div>

        <div className="specTable">
          <Spec
            icon={Scale}
            label="Typical Deadweight (DWT)"
            value={`${money(v.min)}–${money(v.max)}`}
          />

          <Spec
            icon={RulerIcon}
            label="Length Overall (LOA)"
            value={`~${v.loa} m`}
          />

          <Spec
            icon={RulerIcon}
            label="Beam"
            value={`~${v.beam} m`}
          />

          <Spec
            icon={AnchorIcon}
            label="Typical Draft"
            value={`~${v.draft} m`}
          />

          <Spec
            icon={Warehouse}
            label="Typical Cargo Holds"
            value={`${v.holds}`}
          />

          <Spec
            icon={Ship}
            label="Common Usage"
            value={v.usage}
          />
        </div>
      </div>
    </section>
  )
}

function RulerIcon({size=14}) {
  return <span className="specGlyph">↔</span>
}

function AnchorIcon({size=14}) {
  return <span className="specGlyph">⚓</span>
}

function Spec({icon:Icon,label,value}) {
  return (
    <div>
      <span>
        <Icon size={14}/>
        {label}
      </span>

      <b>{value}</b>
    </div>
  )
}

function Results({
  result,
  form,
  onCompare,
  onOutlook,
  exportBrief
}) {
  if (!result) {
    return (
      <section className="panel resultsEmpty">
        <div className="emptyResultIcon">
          <TrendingUp size={22}/>
        </div>

        <h3>Prediction results</h3>

        <p>
          Run the shipment scenario to reveal the
          freight forecast, vessel recommendation,
          charter month, cost and indicative savings.
        </p>
      </section>
    )
  }

  return (
    <section className="panel resultsPanel">
      <div className="resultsHeader">
        <div>
          <div className="eyebrow success">
            <TrendingUp size={15}/>
            PREDICTION RESULTS
          </div>

          <h2>Decision brief</h2>

          <p>
            {form.cargo_type}
            {' · '}
            {money(form.quantity_tonnes)}
            {' tonnes · '}
            {form.origin_port}
            {' → '}
            {form.destination_port}
          </p>
        </div>

        <div className="resultActions">
          <button
            className="secondaryBtn small"
            onClick={onCompare}
          >
            Compare Vessels
          </button>

          <button
            className="secondaryBtn small"
            onClick={onOutlook}
          >
            12-Month Outlook
          </button>

          <button
            className="exportBtn"
            onClick={exportBrief}
          >
            <Package size={14}/>
            Export
          </button>
        </div>
      </div>

      <div className="metricHero">
        <span>Predicted Freight Rate</span>

        <b>
          $
          {Number(
            result.predicted_freight_rate
          ).toFixed(2)}
          {' '}
          <small>/ tonne</small>
        </b>

        <em>AI forecast</em>
      </div>

      <div className="metricGrid">
        <Metric
          icon={Package}
          label="Estimated Total Cost"
          value={`$${money(result.estimated_total_cost)}`}
        />

        <Metric
          icon={TrendingDown}
          label="Estimated Savings"
          value={`${result.savings_percent}%`}
        />

        <Metric
          icon={Ship}
          label="Recommended Vessel"
          value={result.best_vessel}
        />

        <Metric
          icon={CalendarDays}
          label="Best Charter Month"
          value={result.best_charter_month}
        />
      </div>

      <div className="resultNote">
        <Check size={17}/>
        Indicative decision-support estimate based on
        historical shipment patterns.
      </div>
    </section>
  )
}

function Metric({icon:Icon,label,value}) {
  return (
    <div className="metric">
      <Icon size={16}/>

      <span>{label}</span>

      <b>{value}</b>
    </div>
  )
}

function RoutesPage({
  form,
  setField,
  setCountry,
  meta,
  routePreview,
  setRoutePreview
}) {
  return (
    <main className="pageWrap">
      <section className="hero compactHero">
        <div>
          <div className="eyebrow">
            <Compass size={14}/>
            ROUTE EXPLORER
          </div>

          <h1>
            See the voyage
            <br/>
            <span>before you charter.</span>
          </h1>

          <p>
            Use satellite imagery, sea-lane corridors,
            ports and route metrics to inspect the
            planning scenario.
          </p>
        </div>
      </section>

      <RouteMap
        form={form}
        routePreview={routePreview}
        setRoutePreview={setRoutePreview}
        compact={false}
      />

      <div className="infoGrid">
        <Feature
          icon={RouteIcon}
          title="Sea-lane corridor"
          text={`${form.origin_port} → ${form.destination_port} · ML-ranked maritime corridor`}
        />

        <Feature
          icon={MapPin}
          title="Port network"
          text="Toggle mapped ports and hover for port name and country."
        />

        <Feature
          icon={Navigation}
          title="Planning estimate"
          text="Distance and sailing time are indicative planning values, not navigation-grade instructions."
        />
      </div>
    </main>
  )
}

function VesselsPage({form,setField}) {
  const [selected,setSelected] =
    useState(form.vessel_type)

  useEffect(() => {
    setSelected(form.vessel_type)
  }, [form.vessel_type])

  const v = vessel(selected)

  return (
    <main className="pageWrap">
      <section className="hero compactHero">
        <div>
          <div className="eyebrow">
            <Ship size={14}/>
            VESSEL GUIDE
          </div>

          <h1>
            Choose the right hull
            <br/>
            <span>for the cargo.</span>
          </h1>

          <p>
            Every dry-bulk class has a different
            capacity envelope, geometry and
            operating role.
          </p>
        </div>
      </section>

      <VesselGallery
        selected={selected}
        onSelect={x => {
          setSelected(x)
          setField('vessel_type',x)
        }}
      />

      <section className="panel fullVessel">
        <div className="fullVesselImage">
          <img
            src={v.image}
            alt={v.name}
          />

          <div className="imageTag">
            {v.name} · dry bulk carrier
          </div>
        </div>

        <div className="fullVesselInfo">
          <div className="eyebrow">
            SELECTED VESSEL
          </div>

          <h2>{v.name}</h2>

          <div className="range">
            {v.min.toLocaleString()}–
            {v.max.toLocaleString()} DWT
          </div>

          <p>{v.description}</p>

          <div className="vesselFacts">
            <div>
              <span>LOA</span>
              <b>{v.loa} m</b>
            </div>

            <div>
              <span>Beam</span>
              <b>{v.beam} m</b>
            </div>

            <div>
              <span>Draft</span>
              <b>{v.draft} m</b>
            </div>

            <div>
              <span>Cargo holds</span>
              <b>{v.holds}</b>
            </div>
          </div>

          <div className="usageLine">
            <b>Common usage:</b>
            {' '}
            {v.usage}
          </div>
        </div>
      </section>
    </main>
  )
}

function InsightsPage({
  result,
  form,
  history,
  setResult,
  setForm,
  onCompare,
  onOutlook
}) {
  return (
    <main className="pageWrap">
      <section className="hero compactHero">
        <div>
          <div className="eyebrow">
            <BarChart3 size={14}/>
            INSIGHTS
          </div>

          <h1>
            Decision insights
            <br/>
            <span>at a glance.</span>
          </h1>

          <p>
            Review your active recommendation and
            previously saved scenarios on this device.
          </p>
        </div>
      </section>

      {!result ? (
        <section className="panel insightsEmpty">
          <BarChart3 size={28}/>

          <h3>
            Run a forecast to unlock insights
          </h3>

          <p>
            After a successful forecast, this page shows
            the recommendation, timing and local
            scenario history.
          </p>

          {history.length > 0 && (
            <div className="historyList">
              {history
                .slice(0,5)
                .map(h => (
                  <button
                    key={h.id}
                    className="historyItem"
                    onClick={() => {
                      setForm(h.input)
                      setResult(h.result)
                    }}
                  >
                    <span>
                      {h.input.origin_port}
                      {' → '}
                      {h.input.destination_port}
                    </span>

                    <b>
                      $
                      {Number(
                        h.result.predicted_freight_rate
                      ).toFixed(2)}
                      /t
                    </b>

                    <small>
                      {new Date(
                        h.created_at
                      ).toLocaleString()}
                    </small>
                  </button>
                ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="insightGrid">
            <Feature
              icon={TrendingDown}
              title="Freight signal"
              text={`Forecast: $${Number(
                result.predicted_freight_rate
              ).toFixed(2)}/t for the current scenario.`}
            />

            <Feature
              icon={Ship}
              title="Vessel fit"
              text={`${result.best_vessel} is the leading vessel under the current cost-utilization scoring.`}
            />

            <Feature
              icon={CalendarDays}
              title="Charter timing"
              text={`${result.best_charter_month} is the lowest indicative month in this scenario.`}
            />

            <Feature
              icon={Package}
              title="Procurement"
              text={`${money(result.recommended_procurement_tonnes)} tonnes recommended for the selected plan.`}
            />
          </div>

          <section className="panel insightActions">
            <div>
              <div className="eyebrow">
                DECISION TOOLS
              </div>

              <h2>
                Inspect the recommendation
              </h2>

              <p>
                {form.origin_port}
                {' → '}
                {form.destination_port}
                {' · '}
                {form.cargo_type}
                {' · '}
                {money(form.quantity_tonnes)}
                {' tonnes'}
              </p>
            </div>

            <div>
              <button
                className="secondaryBtn"
                onClick={onCompare}
              >
                Compare vessels
                <ArrowRight size={15}/>
              </button>

              <button
                className="primaryBtn"
                onClick={onOutlook}
              >
                12-month outlook
                <CalendarDays size={15}/>
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function AboutPage() {
  return (
    <main className="pageWrap aboutPage">
      <section className="aboutHero">
        <div className="aboutHeroContent">
          <div className="eyebrow">
            <Info size={14}/>
            ABOUT THE PLATFORM
          </div>

          <h1>
            Maritime intelligence
            <br/>
            <span>for better chartering.</span>
          </h1>

          <p>
            Freight Intelligence is a decision-support
            workspace for bulk cargo planning,
            combining historical shipment patterns
            with route, vessel and cost context.
          </p>
        </div>

        <div className="aboutHeroVisual">
          <img
            src="/global-shipping-routes.png"
            alt="Global maritime shipping network"
          />

          <div className="aboutHeroOverlay">
            <span>
              GLOBAL MARITIME NETWORK
            </span>

            <strong>
              Connecting global trade with intelligent
              decisions
            </strong>
          </div>
        </div>
      </section>

      <div className="aboutCards">
        <Feature
          icon={Gauge}
          title="Freight forecast"
          text="A trained regression model estimates freight rate from shipment, route, vessel, fuel and congestion inputs."
        />

        <Feature
          icon={Ship}
          title="Vessel intelligence"
          text="Capacity ranges, dimensions and cargo-use guidance explain the vessel recommendation."
        />

        <Feature
          icon={Globe2}
          title="Route planning"
          text="2D satellite mapping keeps the voyage visible over practical offshore corridors."
        />

        <Feature
          icon={TrendingDown}
          title="Cost awareness"
          text="The decision brief connects freight, vessel fit, charter timing and indicative savings."
        />
      </div>

      <section className="gridwalkersSection">
        <div className="gridwalkersMain">
          <div className="eyebrow">
            <Sparkles size={14}/>
            OUR TEAM
          </div>

          <h2>
            Built by <span>Gridwalkers</span> for smarter
            maritime decisions.
          </h2>

          <p className="gridwalkersIntro">
            Gridwalkers developed this platform to help
            bulk cargo planners make faster and more
            informed decisions using machine learning,
            maritime route intelligence, vessel analysis
            and freight forecasting.
          </p>

          <div className="gridwalkersFeatures">
            <div className="gridwalkersCard">
              <div className="gridwalkersIcon">
                <TrendingDown size={20}/>
              </div>

              <div>
                <h3>Freight Forecasting</h3>
                <p>
                  Predict freight rates from shipment
                  and market conditions.
                </p>
              </div>
            </div>

            <div className="gridwalkersCard">
              <div className="gridwalkersIcon">
                <Ship size={20}/>
              </div>

              <div>
                <h3>Vessel Intelligence</h3>
                <p>
                  Identify suitable vessel classes for
                  the cargo requirement.
                </p>
              </div>
            </div>

            <div className="gridwalkersCard">
              <div className="gridwalkersIcon">
                <Navigation size={20}/>
              </div>

              <div>
                <h3>Route Planning</h3>
                <p>
                  Visualize practical offshore maritime
                  corridors.
                </p>
              </div>
            </div>

            <div className="gridwalkersCard">
              <div className="gridwalkersIcon">
                <Warehouse size={20}/>
              </div>

              <div>
                <h3>Cost Optimization</h3>
                <p>
                  Compare charter timing, freight cost
                  and potential savings.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="gridwalkersVisual">
          <img
            src="/global-shipping-routes.png"
            alt="Maritime vessel and shipping network"
          />

          <div className="gridwalkersQuote">
            <span>
              “Smarter data.
              <br/>
              Safer voyages.
              <br/>
              A cleaner tomorrow.”
            </span>

            <i></i>
          </div>
        </div>

        <div className="gridwalkersFooter">
          <div className="gridwalkersBrand">
            <div className="gridwalkersSymbol">
              ≋
            </div>

            <div>
              <strong>GRIDWALKERS</strong>

              <span>
                Intelligent Freight Forecasting for Optimized
                Vessel Chartering and Bulk Cargo Procurement
              </span>
            </div>
          </div>

          <div className="gridwalkersValues">
            <div>
              <span>◒</span>
              <p>
                Sustainable
                <br/>
                Shipping
              </p>
            </div>

            <div>
              <span>◎</span>
              <p>
                Global
                <br/>
                Connectivity
              </p>
            </div>

            <div>
              <span>◈</span>
              <p>
                AI for a
                <br/>
                Better Tomorrow
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function CompareModal({result,onClose}) {
  return (
    <Modal
      title="Compare vessels"
      onClose={onClose}
      wide
    >
      <div className="compareGrid">
        {result.vessel_comparison.map((v,i) => (
          <div
            className={
              i === 0
                ? 'compareCard best'
                : 'compareCard'
            }
            key={v.vessel_type}
          >
            <div className="rank">
              #{i+1}
            </div>

            <h3>{v.vessel_type}</h3>

            <p>
              {money(v.capacity_tonnes)}
              {' t planning capacity'}
            </p>

            <div>
              <span>Trips</span>
              <b>{v.trips}</b>
            </div>

            <div>
              <span>Indicative rate</span>
              <b>
                ${Number(
                  v.indicative_rate
                ).toFixed(2)}/t
              </b>
            </div>

            <div>
              <span>Utilization</span>
              <b>
                {Math.round(
                  v.utilization * 100
                )}%
              </b>
            </div>

            <div>
              <span>Estimated cost</span>
              <b>
                ${money(v.estimated_cost)}
              </b>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function OutlookModal({result,onClose}) {
  const min =
    Math.min(
      ...result.monthly_outlook.map(
        x => x.rate
      )
    )

  const max =
    Math.max(
      ...result.monthly_outlook.map(
        x => x.rate
      )
    )

  return (
    <Modal
      title="12-month charter outlook"
      onClose={onClose}
    >
      <div className="outlookLead">
        <b>
          Best planning month:
          {' '}
          {result.best_charter_month}
        </b>

        <span>
          Compare indicative freight across all
          twelve months for this same scenario.
        </span>
      </div>

      <div className="outlookRows">
        {result.monthly_outlook.map(m => {
          const width =
            24 +
            (
              (m.rate - min) /
              Math.max(.01,max-min)
            ) * 72

          return (
            <div
              className={
                m.month === result.best_charter_month
                  ? 'outlookRow best'
                  : 'outlookRow'
              }
              key={m.month}
            >
              <span>
                {m.month.slice(0,3)}
              </span>

              <div>
                <i
                  style={{
                    width:`${width}%`
                  }}
                ></i>
              </div>

              <b>
                ${Number(
                  m.rate
                ).toFixed(1)}
              </b>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

function HelpModal({onClose}) {
  return (
    <Modal
      title="How to use Freight Intelligence"
      onClose={onClose}
    >
      <div className="helpContent">
        <div>
          <b>1. Choose your route</b>
          <span>
            Country selection filters ports automatically.
          </span>
        </div>

        <div>
          <b>2. Enter shipment conditions</b>
          <span>
            Cargo, quantity, vessel, fuel and congestion
            feed the forecast.
          </span>
        </div>

        <div>
          <b>3. Inspect the sea route</b>
          <span>
            Use Satellite, Map, Focus Route and Show Ports
            on the map.
          </span>
        </div>

        <div>
          <b>4. Run the forecast</b>
          <span>
            Review freight, vessel fit, charter month,
            cost and indicative savings.
          </span>
        </div>

        <div>
          <b>5. Use decision tools</b>
          <span>
            Compare vessels or open the 12-month outlook
            for the current scenario.
          </span>
        </div>
      </div>
    </Modal>
  )
}

function Modal({
  title,
  onClose,
  children,
  wide=false
}) {
  return (
    <div
      className="modalBackdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={
          wide
            ? 'modal wide'
            : 'modal'
        }
      >
        <div className="modalHead">
          <h2>{title}</h2>

          <button onClick={onClose}>
            <X size={17}/>
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}

export default function AppWithErrorBoundary() {
  return (
    <AppErrorBoundary>
      <App/>
    </AppErrorBoundary>
  )
}