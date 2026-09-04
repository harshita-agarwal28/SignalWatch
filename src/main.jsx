import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  Command,
  Eye,
  Flame,
  Gauge,
  LayoutGrid,
  LineChart,
  Menu,
  Plus,
  Radar,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import "./styles.css";

const initialSignals = [
  {
    ticker: "TSLA",
    company: "Tesla",
    price: "$187.42",
    change: "-5.8%",
    direction: "down",
    tone: "hot",
    label: "High attention",
    headline: "Tesla moved outside its usual range",
    detail: "Down 5.8% today while the auto sector is down only 0.8%.",
    context: "Company-specific movement",
    confidence: "Medium",
    age: "2h ago",
    volume: "3.1x",
    typical: "2.1%",
    freshness: "Live",
    note: "News coverage is still developing. The move is unusual for Tesla's recent range.",
    expanded: true,
  },
  {
    ticker: "NVDA",
    company: "NVIDIA",
    price: "$118.42",
    change: "+4.6%",
    direction: "up",
    tone: "mint",
    label: "Worth watching",
    headline: "NVIDIA is attracting unusual volume",
    detail: "Trading activity is 2.4x its 30-day average with a sharp upward move.",
    context: "Momentum building",
    confidence: "High",
    age: "48m ago",
    volume: "2.4x",
    typical: "1.9%",
    freshness: "Live",
    note: "The move is supported by broad semiconductor strength and elevated participation.",
    expanded: false,
  },
  {
    ticker: "MSFT",
    company: "Microsoft",
    price: "$431.08",
    change: "+0.9%",
    direction: "up",
    tone: "amber",
    label: "Event soon",
    headline: "Microsoft earnings are coming up",
    detail: "Quarterly results are scheduled in 2 days. Price movement is currently normal.",
    context: "Upcoming event",
    confidence: "High",
    age: "Today",
    volume: "0.9x",
    typical: "1.4%",
    freshness: "Delayed 15m",
    note: "This is an event reminder, not a prediction about the stock's next move.",
    expanded: false,
  },
];

const stocks = [
  ["AAPL", "Apple", "$227.16", "+1.2%", "up", "Quiet", "0.9x", "blue", "18,28,24,33,29,42,39,50"],
  ["TSLA", "Tesla", "$187.42", "-5.8%", "down", "High attention", "3.1x", "coral", "52,48,51,38,42,32,34,22"],
  ["NVDA", "NVIDIA", "$118.42", "+4.6%", "up", "Worth watching", "2.4x", "mint", "20,25,23,31,34,39,46,53"],
  ["MSFT", "Microsoft", "$431.08", "+0.9%", "up", "Event soon", "0.9x", "amber", "34,32,38,36,41,43,42,46"],
];

function Sparkline({ values, color }) {
  const points = values.split(",").map(Number);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const coordinates = points
    .map((value, index) => `${(index / (points.length - 1)) * 100},${34 - ((value - min) / (max - min || 1)) * 28}`)
    .join(" ");
  return (
    <svg className={`sparkline ${color}`} viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={coordinates} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <polyline points={`0,38 ${coordinates} 100,38`} fill="currentColor" opacity=".08" />
    </svg>
  );
}

function SignalCard({ signal, toggle, remove }) {
  return (
    <article className={`signal-card signal-${signal.tone}`}>
      <button className="signal-row" onClick={() => toggle(signal.ticker)} aria-expanded={signal.expanded}>
        <div className="signal-icon"><Activity size={18} /></div>
        <div className="signal-copy">
          <div className="signal-line">
            <small>{signal.ticker}</small><span>{signal.company}</span><b>{signal.label}</b>
          </div>
          <h3>{signal.headline}</h3>
          <p>{signal.detail}</p>
          <div className="signal-meta"><span>• {signal.context}</span><span>{signal.age}</span></div>
        </div>
        <div className="quote"><strong>{signal.price}</strong><span className={signal.direction}>{signal.direction === "down" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{signal.change}</span></div>
        <div className="confidence"><span>◈ {signal.confidence}</span><ChevronDown className={signal.expanded ? "rotated" : ""} size={17} /></div>
      </button>
      {signal.expanded && (
        <div className="evidence">
          <div className="evidence-title">WHY THIS IS BEING SURFACED <i /> <em>● {signal.freshness}</em></div>
          <div className="facts">
            {[
              ["Daily move", signal.change, signal.direction],
              ["Typical move", signal.typical, ""],
              ["Volume ratio", signal.volume, ""],
              ["Data freshness", signal.freshness, ""],
            ].map(([label, value, tone]) => <div key={label}><small>{label}</small><strong className={tone}>{value}</strong></div>)}
          </div>
          <p><Sparkles size={14} /> {signal.note}</p>
          <button className="review" onClick={(event) => { event.stopPropagation(); remove(signal.ticker); }}>Mark as reviewed <ChevronRight size={14} /></button>
        </div>
      )}
    </article>
  );
}

function App() {
  const [items, setItems] = useState(initialSignals);
  const [filter, setFilter] = useState("All signals");
  const [modal, setModal] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const shown = useMemo(() => items.filter((signal) => filter === "High attention" ? signal.tone === "hot" : filter === "Upcoming events" ? signal.context === "Upcoming event" : true), [items, filter]);
  const toggle = (ticker) => setItems((current) => current.map((signal) => signal.ticker === ticker ? { ...signal, expanded: !signal.expanded } : signal));
  const remove = (ticker) => setItems((current) => current.filter((signal) => signal.ticker !== ticker));

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="grid-overlay" />
      <div className="ticker-ribbon"><span>MARKET PULSE</span> • S&amp;P 500 <em>+0.42%</em> • NASDAQ <em>+0.88%</em> • VIX <strong>14.8</strong> • LAST SYNC 2 MIN AGO</div>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><div className="brand-orbit"><Radar size={22} /></div><span>signal<span>watch</span></span></div>
        <button className="close-mobile" onClick={() => setMobileNav(false)}><X size={19} /></button>
        <div className="side-label">OBSERVATORY</div>
        {[["Overview", LayoutGrid, "3"], ["My watchlists", Eye, "4"], ["Focus mode", Target, "3"]].map(([label, Icon, count], index) => <button className={index === 0 ? "active side-nav" : "side-nav"} key={label}><Icon size={18} /><span>{label}</span><b>{count}</b></button>)}
        <div className="side-label">CONTEXT</div>
        <button className="side-nav"><Radar size={18} /><span>Market context</span></button>
        <button className="side-nav"><Bell size={18} /><span>Alerts</span><b>2</b></button>
        <div className="side-label">ACCOUNT</div><button className="side-nav"><Settings size={18} /><span>Settings</span></button>
        <div className="sidebar-user"><strong>H</strong><span><b>Harshita</b><small>Personal workspace</small></span><ChevronDown size={15} /></div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="search-box"><Search size={17} /><input placeholder="Search company or ticker..." /><span><Command size={12} /> K</span></div>
          <div className="market-status"><i /><b>Market open</b><em /><Clock3 size={15} /> Updated 2 min ago</div>
          <button className="icon-button notification"><Bell size={18} /><i /></button><div className="top-profile"><strong>H</strong> Harshita <ChevronDown size={15} /></div>
        </header>
        <section className="content">
          <div className="page-heading"><div><small className="kicker">━━ THURSDAY, SEPTEMBER 4, 2026</small><h1>Good morning, Harshita<span>.</span></h1><p>Here is the signal in the noise.</p></div><div className="heading-actions"><button className="ghost-button"><Clock3 size={14} /> Last visit: yesterday</button><button className="primary-button" onClick={() => setModal(true)}><Plus size={16} /> Add company</button></div></div>
          <div className="hero-grid">
            <section className="attention-card"><div className="attention-top"><div className="attention-orb"><Flame size={20} /></div><div><small>RETURN BRIEFING</small><h2>3 signals deserve<br /><span>your attention</span></h2></div><aside>Since last check<br /><b>Sep 3, 6:14 PM</b></aside></div><div className="attention-stats"><div>↗ <b>1</b><span>company-specific<br />move</span></div><div>▥ <b>1</b><span>unusual volume<br />spike</span></div><div>□ <b>1</b><span>event happening<br />soon</span></div></div><u /></section>
            <section className="radar-card"><div><small>LIVE RADAR</small><b>● SCANNING</b></div><div className="radar-visual"><i /><i /><i /><u /><span /><span /><span /><strong><Gauge size={15} />74<small>attention</small></strong></div><footer>● 4 tracked <span>● 3 new signals</span></footer></section>
          </div>
          <div className="section-heading"><div><small>01</small><h2>Since you last checked</h2><span>{items.length} unacknowledged</span></div><nav>{["All signals", "High attention", "Upcoming events"].map((value) => <button className={filter === value ? "selected" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}</nav></div>
          <div className="signal-list">{shown.length ? shown.map((signal) => <SignalCard key={signal.ticker} signal={signal} toggle={toggle} remove={remove} />) : <div className="empty-state"><Sparkles size={18} /> No signals in this view.</div>}</div>
          <div className="section-heading watchlist-heading"><div><small>02</small><h2>Your watchlists</h2><span>4 companies</span></div><button className="text-button">Open watchlist <ChevronRight size={14} /></button></div>
          <div className="watchlist-strip">{stocks.map(([ticker, company, price, change, direction, status, volume, color, values]) => <article className="stock-card" key={ticker}><div className={`ticker-badge ${color}`}>{ticker.slice(0, 2)}</div><div className="stock-info"><strong>{company}</strong><small>{ticker} • {status}</small></div><Sparkline values={values} color={color} /><div className="stock-price"><strong>{price}</strong><span className={direction}>{change}</span></div><div className="stock-volume">Volume <b>{volume} <small>normal</small></b></div><ChevronRight className="card-arrow" size={17} /></article>)}</div>
          <div className="lower-grid"><section className="lower-card"><small>UP NEXT</small><h2>Upcoming events</h2><div className="event-row"><b>06<small>SEP</small></b><span><strong>Microsoft earnings call</strong><small>MSFT • In 2 days at 5:00 PM</small></span><i>EARNINGS</i></div><div className="event-row"><b>12<small>SEP</small></b><span><strong>Apple product event</strong><small>AAPL • In 8 days</small></span><i>COMPANY</i></div></section><section className="lower-card"><small>MARKET CONTEXT</small><h2>Overall pulse</h2><div className="meter"><i /></div><div className="meter-labels"><span>Quiet</span><b>Balanced</b><span>Heated</span></div><p><Sparkles size={14} /> The broader market is calm. Most of today's movement is coming from individual companies.</p></section></div>
        </section>
      </main>
      {modal && <div className="modal-backdrop" onClick={() => setModal(false)}><div className="add-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setModal(false)}><X size={17} /></button><div className="modal-icon"><Plus size={21} /></div><small>EXPAND YOUR RADAR</small><h2>Add a company</h2><p>Choose a company and we will start watching for meaningful changes.</p><div className="modal-search"><Search size={17} /><input autoFocus placeholder="Search name or ticker..." /></div><div className="suggestions"><div><b>A</b><span><strong>Apple</strong><small>AAPL • Technology</small></span><Plus size={15} /></div><div><b>N</b><span><strong>NVIDIA</strong><small>NVDA • Semiconductors</small></span><Plus size={15} /></div></div><button className="primary-button full-button" onClick={() => setModal(false)}>Add selected company</button></div></div>}
    </div>
  );
}

export default App;
