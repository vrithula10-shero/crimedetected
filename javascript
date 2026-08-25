import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import {
  LayoutDashboard, Share2, Users, Briefcase, Upload, Brain, Bell,
  FileText, ScrollText, Settings, Search, Sun, Moon, LogOut, ShieldCheck,
  Phone, Car, MapPin, AlertTriangle, ChevronRight, X, Info, Filter,
  Network, TrendingUp, Clock, CheckCircle2, Lock, Eye, EyeOff, Sparkles,
  Bookmark, Plus, Download, Activity
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip,
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell
} from "recharts";

/* ============================================================================
   THEME TOKENS
   Deep graphite-navy "case file" surface, amber for priority/case tags,
   signal-blue for verified links, muted rose for anomalies.
============================================================================ */
const T = {
  dark: {
    bg: "#0B0E14", bg2: "#0F1420", surface: "#131826", surface2: "#182036",
    border: "#232C42", borderSoft: "#1A2136",
    text: "#E9EDF7", textMuted: "#8C97B4", textFaint: "#5C6785",
    accentAmber: "#E7A63C", accentBlue: "#5B8DEF", accentRose: "#E0707A",
    accentGreen: "#4FCB8F", glow: "rgba(91,141,239,0.35)",
  },
  light: {
    bg: "#F4F5F8", bg2: "#EDEFF4", surface: "#FFFFFF", surface2: "#F7F8FB",
    border: "#DDE1EA", borderSoft: "#E7E9F0",
    text: "#141A29", textMuted: "#5B6478", textFaint: "#8B93A6",
    accentAmber: "#B9791E", accentBlue: "#2F5FD1", accentRose: "#C13F4C",
    accentGreen: "#25925E", glow: "rgba(47,95,209,0.18)",
  },
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
`;

/* ============================================================================
   SYNTHETIC DEMO DATA
   Fictional persons/entities only. Records model a plausible investigator
   upload: Person | Phone | Location | Case | Vehicle.
============================================================================ */
const RECORDS = [
  { person: "Arun",    phone: "PH-01", location: "LOC-1", case: "CASE-001", vehicle: "VH-01" },
  { person: "Bala",    phone: "PH-01", location: "LOC-1", case: "CASE-001", vehicle: null },
  { person: "Kumar",   phone: "PH-02", location: "LOC-1", case: "CASE-001", vehicle: "VH-01" },
  { person: "Ravi",    phone: "PH-02", location: "LOC-2", case: "CASE-002", vehicle: null },
  { person: "Sanjay",  phone: "PH-03", location: "LOC-2", case: "CASE-002", vehicle: "VH-02" },
  { person: "Meena",   phone: "PH-03", location: "LOC-2", case: "CASE-002", vehicle: null },
  { person: "Divya",   phone: "PH-04", location: "LOC-3", case: "CASE-003", vehicle: "VH-03" },
  { person: "Farhan",  phone: "PH-04", location: "LOC-3", case: "CASE-003", vehicle: null },
  { person: "Geetha",  phone: "PH-05", location: "LOC-3", case: "CASE-003", vehicle: "VH-03" },
  { person: "Iqbal",   phone: null,    location: "LOC-2", case: "CASE-002", vehicle: "VH-02" },
  { person: "Joseph",  phone: "PH-05", location: "LOC-4", case: "CASE-004", vehicle: null },
  { person: "Kavya",   phone: "PH-06", location: "LOC-4", case: "CASE-004", vehicle: "VH-04" },
  { person: "Lakshmi", phone: "PH-06", location: "LOC-5", case: "CASE-005", vehicle: "VH-04" },
  { person: "Manoj",   phone: null,    location: "LOC-5", case: "CASE-005", vehicle: null },
  { person: "Nisha",   phone: "PH-02", location: "LOC-4", case: "CASE-004", vehicle: "VH-01" },
];

const CASE_META = {
  "CASE-001": { title: "Warehouse theft cluster", date: "2025-02-11" },
  "CASE-002": { title: "Vehicle registration fraud",  date: "2025-05-03" },
  "CASE-003": { title: "Suspicious cargo transfers",  date: "2025-08-22" },
  "CASE-004": { title: "Unregistered SIM usage",      date: "2026-01-14" },
  "CASE-005": { title: "Repeat-location loitering",   date: "2026-03-02" },
};
const LOCATION_META = {
  "LOC-1": "Riverside Industrial Yard", "LOC-2": "North Bus Terminal",
  "LOC-3": "Harbor Freight Depot", "LOC-4": "Central Market Block C",
  "LOC-5": "Eastside Transit Hub",
};

/* ---------------------------------------------------------------------------
   Build a typed entity graph from the records. Edges are only created when
   two records literally share a data point (phone / vehicle / location /
   case) — no relationship is invented.
--------------------------------------------------------------------------- */
function buildGraph(records) {
  const nodes = new Map();
  const addNode = (id, type, label, extra = {}) => {
    if (!nodes.has(id)) nodes.set(id, { id, type, label, ...extra });
  };
  records.forEach(r => {
    addNode(`P:${r.person}`, "person", r.person);
    if (r.phone) addNode(`PH:${r.phone}`, "phone", r.phone);
    if (r.vehicle) addNode(`VH:${r.vehicle}`, "vehicle", r.vehicle);
    addNode(`LOC:${r.location}`, "location", LOCATION_META[r.location] || r.location, { code: r.location });
    addNode(`CASE:${r.case}`, "case", CASE_META[r.case]?.title || r.case, { code: r.case, date: CASE_META[r.case]?.date });
  });

  const edgeMap = new Map();
  const addEdge = (a, b, type, reason) => {
    const key = [a, b].sort().join("|") + "|" + type;
    if (!edgeMap.has(key)) edgeMap.set(key, { source: a, target: b, type, reason, count: 1 });
    else edgeMap.get(key).count += 1;
  };
  records.forEach(r => {
    const p = `P:${r.person}`;
    if (r.phone) addEdge(p, `PH:${r.phone}`, "phone", `${r.person} is associated with phone ${r.phone}.`);
    if (r.vehicle) addEdge(p, `VH:${r.vehicle}`, "vehicle", `${r.person} is associated with vehicle ${r.vehicle}.`);
    addEdge(p, `LOC:${r.location}`, "location", `${r.person} has records at ${LOCATION_META[r.location]}.`);
    addEdge(p, `CASE:${r.case}`, "case", `${r.person} is linked to case ${r.case}.`);
  });

  return { nodes: [...nodes.values()], edges: [...edgeMap.values()] };
}

/* ---------------------------------------------------------------------------
   Graph algorithms — degree, PageRank (power iteration), betweenness
   (Brandes, unweighted), synchronous label-propagation communities, and a
   transparent, explainable anomaly + priority scorer. All computed
   client-side over the small demo graph; production scale would run the
   same algorithm family (NetworkX) server-side, see README.
--------------------------------------------------------------------------- */
function analyzeGraph(nodes, edges) {
  const ids = nodes.map(n => n.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const adj = Array.from({ length: n }, () => new Set());
  edges.forEach(e => { adj[idx.get(e.source)].add(idx.get(e.target)); adj[idx.get(e.target)].add(idx.get(e.source)); });

  // Degree centrality
  const degree = adj.map(s => s.size);

  // PageRank (power iteration, undirected)
  let pr = new Array(n).fill(1 / n);
  const damping = 0.85;
  for (let iter = 0; iter < 60; iter++) {
    const next = new Array(n).fill((1 - damping) / n);
    for (let i = 0; i < n; i++) {
      const out = adj[i].size || 1;
      const share = damping * (pr[i] / out);
      adj[i].forEach(j => { next[j] += share; });
    }
    pr = next;
  }

  // Betweenness centrality — Brandes' algorithm
  const betweenness = new Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const stack = [];
    const preds = Array.from({ length: n }, () => []);
    const sigma = new Array(n).fill(0); sigma[s] = 1;
    const dist = new Array(n).fill(-1); dist[s] = 0;
    const queue = [s];
    while (queue.length) {
      const v = queue.shift();
      stack.push(v);
      adj[v].forEach(w => {
        if (dist[w] < 0) { dist[w] = dist[v] + 1; queue.push(w); }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; preds[w].push(v); }
      });
    }
    const delta = new Array(n).fill(0);
    while (stack.length) {
      const w = stack.pop();
      preds[w].forEach(v => { delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]); });
      if (w !== s) betweenness[w] += delta[w];
    }
  }
  const maxBet = Math.max(...betweenness, 1);
  const betweennessNorm = betweenness.map(b => b / maxBet);

  // Community detection — synchronous label propagation
  let labels = ids.map((_, i) => i);
  for (let iter = 0; iter < 15; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      const counts = new Map();
      adj[i].forEach(j => counts.set(labels[j], (counts.get(labels[j]) || 0) + 1));
      if (counts.size === 0) continue;
      let best = labels[i], bestCount = -1;
      counts.forEach((c, lab) => { if (c > bestCount || (c === bestCount && lab < best)) { best = lab; bestCount = c; } });
      if (best !== labels[i]) { labels[i] = best; changed = true; }
    }
    if (!changed) break;
  }
  const communityIds = [...new Set(labels)];
  const communityIndex = new Map(communityIds.map((c, i) => [c, i]));
  const community = labels.map(l => communityIndex.get(l));
  const numCommunities = communityIds.length;

  // Cross-community edges per node → used for anomaly / bridge detection
  const crossCount = new Array(n).fill(0);
  edges.forEach(e => {
    const a = idx.get(e.source), b = idx.get(e.target);
    if (community[a] !== community[b]) { crossCount[a]++; crossCount[b]++; }
  });

  // Per-node explainable results
  const results = nodes.map((node, i) => {
    const connectedCases = new Set();
    edges.forEach(e => {
      if (idx.get(e.source) === i || idx.get(e.target) === i) {
        const other = idx.get(e.source) === i ? nodes[idx.get(e.target)] : nodes[idx.get(e.source)];
        if (other.type === "case") connectedCases.add(other.id);
      }
    });
    const rawScore =
      degree[i] * 6 +
      betweennessNorm[i] * 40 +
      pr[i] * n * 12 +
      connectedCases.size * 8 +
      crossCount[i] * 10;
    return {
      id: node.id,
      degree: degree[i],
      pageRank: pr[i],
      betweenness: betweennessNorm[i],
      community: community[i],
      crossCommunityLinks: crossCount[i],
      caseCount: connectedCases.size,
      score: Math.max(0, Math.min(100, Math.round(rawScore))),
    };
  });
  const maxRaw = Math.max(...results.map(r => r.score), 1);
  results.forEach(r => { r.score = Math.round((r.score / maxRaw) * 100); });

  // Anomaly detection — nodes that bridge multiple communities disproportionately,
  // or whose betweenness greatly exceeds what their raw degree would predict.
  const avgDegree = degree.reduce((a, b) => a + b, 0) / n;
  const anomalies = [];
  results.forEach((r, i) => {
    const node = nodes[i];
    if (node.type !== "person") return;
    if (r.crossCommunityLinks >= 2) {
      anomalies.push({
        entityId: node.id, entity: node.label, type: "Cross-community bridge",
        severity: r.crossCommunityLinks >= 3 ? "high" : "medium",
        detected: `${node.label} has data-supported links into ${r.crossCommunityLinks} different detected communities, well above the typical 0–1 for this network.`,
        cause: `Shared records connect ${node.label} to entities placed in separate communities by the label-propagation analysis.`,
        confidence: Math.min(0.95, 0.55 + r.crossCommunityLinks * 0.12),
      });
    } else if (degree[i] >= avgDegree * 2 && degree[i] >= 4) {
      anomalies.push({
        entityId: node.id, entity: node.label, type: "Sudden high connectivity",
        severity: "medium",
        detected: `${node.label} has ${degree[i]} direct connections, more than double the network average of ${avgDegree.toFixed(1)}.`,
        cause: `Multiple distinct shared entities (phone, vehicle, location, or case) point back to ${node.label} within the uploaded records.`,
        confidence: 0.6,
      });
    }
  });

  return { results: new Map(results.map(r => [r.id, r])), numCommunities, anomalies, avgDegree };
}

/* ---------------------------------------------------------------------------
   Force layout (computed once per dataset, then draggable)
--------------------------------------------------------------------------- */
function useForceLayout(nodes, edges, width, height) {
  const [positions, setPositions] = useState(null);
  useEffect(() => {
    if (!nodes.length) return;
    const simNodes = nodes.map(n => ({ ...n }));
    const simLinks = edges.map(e => ({ ...e }));
    const sim = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id(d => d.id).distance(70).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(26))
      .stop();
    for (let i = 0; i < 260; i++) sim.tick();
    const pos = {};
    simNodes.forEach(n => { pos[n.id] = { x: n.x, y: n.y }; });
    setPositions(pos);
    // eslint-disable-next-line
  }, [nodes.length, edges.length, width, height]);
  return [positions, setPositions];
}

/* ============================================================================
   SMALL UI PRIMITIVES
============================================================================ */
function Card({ theme, children, style, className = "" }) {
  return (
    <div className={`rounded-2xl ${className}`} style={{ background: theme.surface, border: `1px solid ${theme.border}`, ...style }}>
      {children}
    </div>
  );
}
function Pill({ theme, color, children }) {
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full inline-flex items-center gap-1"
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}>
      {children}
    </span>
  );
}
function IconFor({ type, size = 14 }) {
  const map = { person: Users, phone: Phone, vehicle: Car, location: MapPin, case: Briefcase };
  const Ico = map[type] || Info;
  return <Ico size={size} />;
}
const TYPE_COLOR = (theme, type) => ({
  person: theme.accentBlue, phone: theme.accentGreen, vehicle: theme.accentAmber,
  location: theme.accentRose, case: "#A784E8",
}[type] || theme.textMuted);

/* ============================================================================
   LOGIN SCREEN
============================================================================ */
function LoginScreen({ theme, onLogin }) {
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState("Investigator");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const fillDemo = () => { setUsername("demo.investigator"); setPassword("demo-pass-2026"); };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: `radial-gradient(1200px 600px at 20% -10%, ${theme.glow}, transparent), ${theme.bg}`, fontFamily: "Inter, sans-serif" }}>
      <style>{FONTS}</style>
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: `linear-gradient(${theme.textFaint} 1px, transparent 1px), linear-gradient(90deg, ${theme.textFaint} 1px, transparent 1px)`,
        backgroundSize: "42px 42px",
      }} />
      <Card theme={theme} className="w-[420px] p-8 relative z-10" style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: theme.accentBlue + "22", color: theme.accentBlue }}>
            <Network size={18} />
          </div>
          <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-lg font-semibold">Meridian Link</div>
        </div>
        <div className="text-xs mb-6" style={{ color: theme.textMuted }}>Network Analysis &amp; Investigation Support Platform</div>

        <div className="mb-4 p-3 rounded-xl text-xs flex items-start gap-2" style={{ background: theme.accentAmber + "14", border: `1px solid ${theme.accentAmber}33`, color: theme.textMuted }}>
          <ShieldCheck size={14} style={{ color: theme.accentAmber, marginTop: 1 }} />
          <span>Demo mode — synthetic data only. No real case or personal records are used in this environment.</span>
        </div>

        <label className="text-xs font-medium block mb-1" style={{ color: theme.textMuted }}>Username or email</label>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="you@agency.gov"
          className="w-full mb-3 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }} />

        <label className="text-xs font-medium block mb-1" style={{ color: theme.textMuted }}>Password</label>
        <div className="relative mb-3">
          <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none pr-9"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }} />
          <button onClick={() => setShowPw(s => !s)} className="absolute right-2 top-2.5" style={{ color: theme.textMuted }}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <label className="text-xs font-medium block mb-1" style={{ color: theme.textMuted }}>Role</label>
        <div className="flex gap-2 mb-4">
          {["Investigator", "Analyst", "Administrator"].map(r => (
            <button key={r} onClick={() => setRole(r)}
              className="flex-1 text-xs py-2 rounded-lg font-medium"
              style={{
                background: role === r ? theme.accentBlue + "22" : theme.surface2,
                color: role === r ? theme.accentBlue : theme.textMuted,
                border: `1px solid ${role === r ? theme.accentBlue + "55" : theme.border}`,
              }}>{r}</button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs mb-5" style={{ color: theme.textMuted }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me on this device
        </label>

        <button onClick={() => onLogin({ username: username || "demo.investigator", role })}
          className="w-full py-2.5 rounded-lg text-sm font-semibold mb-3"
          style={{ background: theme.accentBlue, color: "#081022" }}>
          Log in
        </button>
        <button onClick={fillDemo} className="w-full py-2 rounded-lg text-xs font-medium" style={{ color: theme.accentBlue, background: theme.accentBlue + "12", border: `1px solid ${theme.accentBlue}33` }}>
          Fill demo credentials
        </button>
        <div className="text-[11px] text-center mt-4" style={{ color: theme.textFaint }}>
          <Lock size={10} className="inline mr-1" /> Sessions are audited. Unauthorized access is prohibited.
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
   SIDEBAR + TOPBAR
============================================================================ */
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "investigations", label: "Investigations", icon: Bookmark },
  { key: "network", label: "Network Analysis", icon: Share2 },
  { key: "entities", label: "Entities", icon: Users },
  { key: "cases", label: "Cases", icon: Briefcase },
  { key: "upload", label: "Data Upload", icon: Upload },
  { key: "ai", label: "AI Analysis", icon: Brain },
  { key: "alerts", label: "Alerts", icon: Bell },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "audit", label: "Audit Logs", icon: ScrollText },
  { key: "settings", label: "Settings", icon: Settings },
];

function Sidebar({ theme, view, setView, collapsed, alertCount }) {
  return (
    <div className="h-full flex flex-col shrink-0" style={{ width: collapsed ? 72 : 232, background: theme.bg2, borderRight: `1px solid ${theme.border}`, transition: "width .2s" }}>
      <div className="flex items-center gap-2 px-4 h-16 shrink-0" style={{ borderBottom: `1px solid ${theme.border}` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: theme.accentBlue + "22", color: theme.accentBlue }}>
          <Network size={16} />
        </div>
        {!collapsed && <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-sm font-semibold">Meridian Link</div>}
      </div>
      <div className="flex-1 py-3 px-2 overflow-y-auto">
        {NAV.map(item => {
          const active = view === item.key;
          return (
            <button key={item.key} onClick={() => setView(item.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm relative"
              style={{ background: active ? theme.accentBlue + "1c" : "transparent", color: active ? theme.accentBlue : theme.textMuted }}>
              <item.icon size={16} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {item.key === "alerts" && alertCount > 0 && !collapsed && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: theme.accentRose + "26", color: theme.accentRose }}>{alertCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Topbar({ theme, isDark, setIsDark, user, onLogout, search, setSearch, setView }) {
  return (
    <div className="h-16 flex items-center gap-3 px-5 shrink-0" style={{ borderBottom: `1px solid ${theme.border}`, background: theme.bg }}>
      <div className="flex-1 max-w-md relative">
        <Search size={14} className="absolute left-3 top-2.5" style={{ color: theme.textFaint }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") setView("network"); }}
          placeholder="Search person, phone, vehicle, case, location…"
          className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }} />
      </div>
      <div className="flex-1" />
      <button onClick={() => setIsDark(d => !d)} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: theme.surface2, color: theme.textMuted, border: `1px solid ${theme.border}` }}>
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <div className="flex items-center gap-2 pl-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: theme.accentBlue + "26", color: theme.accentBlue }}>
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="text-xs leading-tight">
          <div style={{ color: theme.text }} className="font-medium">{user.username}</div>
          <div style={{ color: theme.textFaint }}>{user.role}</div>
        </div>
        <button onClick={onLogout} className="ml-1 w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: theme.textMuted }}><LogOut size={14} /></button>
      </div>
    </div>
  );
}

/* ============================================================================
   DASHBOARD
============================================================================ */
function StatCard({ theme, label, value, icon: Icon, accent, sub }) {
  return (
    <Card theme={theme} className="p-4 flex-1 min-w-[150px]">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: accent + "1e", color: accent }}><Icon size={16} /></div>
        {sub && <span className="text-[11px]" style={{ color: theme.accentGreen }}>{sub}</span>}
      </div>
      <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-2xl font-semibold">{value}</div>
      <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>{label}</div>
    </Card>
  );
}

const ACTIVITY = [
  { t: "Jan", v: 12 }, { t: "Feb", v: 18 }, { t: "Mar", v: 14 }, { t: "Apr", v: 26 },
  { t: "May", v: 22 }, { t: "Jun", v: 31 }, { t: "Jul", v: 27 }, { t: "Aug", v: 38 },
];

function Dashboard({ theme, graph, analysis, setView, setSelectedId }) {
  const persons = graph.nodes.filter(n => n.type === "person");
  const topEntities = [...analysis.results.entries()]
    .filter(([id]) => id.startsWith("P:"))
    .sort((a, b) => b[1].score - a[1].score).slice(0, 5);

  const commData = Array.from({ length: analysis.numCommunities }).map((_, i) => ({
    name: `Group ${i + 1}`,
    value: [...analysis.results.values()].filter(r => r.community === i).length,
  }));
  const pieColors = [theme.accentBlue, theme.accentAmber, theme.accentRose, theme.accentGreen, "#A784E8", "#6BC5D8"];

  return (
    <div className="p-6 space-y-5">
      <div>
        <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-xl font-semibold">Investigation overview</div>
        <div className="text-xs mt-1" style={{ color: theme.textMuted }}>Synthetic demo dataset · last processed just now</div>
      </div>

      <div className="flex flex-wrap gap-4">
        <StatCard theme={theme} label="Total persons" value={persons.length} icon={Users} accent={theme.accentBlue} />
        <StatCard theme={theme} label="Total cases" value={Object.keys(CASE_META).length} icon={Briefcase} accent="#A784E8" />
        <StatCard theme={theme} label="Total connections" value={graph.edges.length} icon={Share2} accent={theme.accentGreen} />
        <StatCard theme={theme} label="Locations" value={Object.keys(LOCATION_META).length} icon={MapPin} accent={theme.accentRose} />
        <StatCard theme={theme} label="Active alerts" value={analysis.anomalies.length} icon={AlertTriangle} accent={theme.accentAmber} sub={analysis.anomalies.length ? "Needs review" : undefined} />
        <StatCard theme={theme} label="Networks detected" value={analysis.numCommunities} icon={Network} accent={theme.accentBlue} />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Card theme={theme} className="col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div style={{ color: theme.text }} className="text-sm font-semibold">Record processing activity</div>
            <Pill theme={theme} color={theme.accentGreen}><TrendingUp size={11} /> Trending up</Pill>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ACTIVITY}>
              <defs>
                <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.accentBlue} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={theme.accentBlue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
              <XAxis dataKey="t" stroke={theme.textFaint} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={theme.textFaint} fontSize={11} tickLine={false} axisLine={false} width={24} />
              <RTooltip contentStyle={{ background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="v" stroke={theme.accentBlue} fill="url(#ga)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card theme={theme} className="p-5">
          <div style={{ color: theme.text }} className="text-sm font-semibold mb-4">Detected communities</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={commData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={3}>
                {commData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <RTooltip contentStyle={{ background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {commData.map((c, i) => (
              <span key={i} className="text-[11px] flex items-center gap-1" style={{ color: theme.textMuted }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: pieColors[i % pieColors.length] }} />{c.name}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Card theme={theme} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div style={{ color: theme.text }} className="text-sm font-semibold">Most connected entities</div>
            <button onClick={() => setView("network")} className="text-xs flex items-center gap-1" style={{ color: theme.accentBlue }}>Open network <ChevronRight size={12} /></button>
          </div>
          <div className="space-y-2">
            {topEntities.map(([id, r]) => {
              const node = graph.nodes.find(n => n.id === id);
              return (
                <button key={id} onClick={() => { setSelectedId(id); setView("network"); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left" style={{ background: theme.surface2 }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: TYPE_COLOR(theme, "person") + "22", color: TYPE_COLOR(theme, "person") }}><IconFor type="person" /></div>
                    <div>
                      <div style={{ color: theme.text }} className="text-xs font-medium">{node.label}</div>
                      <div style={{ color: theme.textFaint }} className="text-[11px]">{r.degree} connections · {r.caseCount} cases</div>
                    </div>
                  </div>
                  <Pill theme={theme} color={theme.accentAmber}>{r.score}/100</Pill>
                </button>
              );
            })}
          </div>
        </Card>

        <Card theme={theme} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div style={{ color: theme.text }} className="text-sm font-semibold">Recent alerts</div>
            <button onClick={() => setView("alerts")} className="text-xs flex items-center gap-1" style={{ color: theme.accentBlue }}>View all <ChevronRight size={12} /></button>
          </div>
          <div className="space-y-2">
            {analysis.anomalies.slice(0, 4).map((a, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: theme.surface2 }}>
                <AlertTriangle size={14} style={{ color: a.severity === "high" ? theme.accentRose : theme.accentAmber, marginTop: 2 }} />
                <div>
                  <div style={{ color: theme.text }} className="text-xs font-medium">{a.type} — {a.entity}</div>
                  <div style={{ color: theme.textFaint }} className="text-[11px] mt-0.5">{a.detected}</div>
                </div>
              </div>
            ))}
            {analysis.anomalies.length === 0 && <div className="text-xs" style={{ color: theme.textFaint }}>No unusual patterns detected.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
   NETWORK ANALYSIS PAGE — the centerpiece graph
============================================================================ */
function NetworkGraph({ theme, nodes, edges, positions, setPositions, selectedId, setSelectedId, width, height, highlightIds }) {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef(null);
  const panRef = useRef(null);

  const idSet = new Set(nodes.map(n => n.id));
  const visEdges = edges.filter(e => idSet.has(e.source) && idSet.has(e.target));

  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0012;
    setTransform(t => ({ ...t, k: Math.min(2.4, Math.max(0.4, t.k + delta)) }));
  };
  const onNodeDown = (e, id) => {
    e.stopPropagation();
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, orig: positions[id] };
  };
  const onPanDown = (e) => { panRef.current = { startX: e.clientX, startY: e.clientY, orig: { x: transform.x, y: transform.y } }; };
  const onMove = (e) => {
    if (dragRef.current) {
      const { id, startX, startY, orig } = dragRef.current;
      const dx = (e.clientX - startX) / transform.k, dy = (e.clientY - startY) / transform.k;
      setPositions(p => ({ ...p, [id]: { x: orig.x + dx, y: orig.y + dy } }));
    } else if (panRef.current) {
      const { startX, startY, orig } = panRef.current;
      setTransform(t => ({ ...t, x: orig.x + (e.clientX - startX), y: orig.y + (e.clientY - startY) }));
    }
  };
  const onUp = () => { dragRef.current = null; panRef.current = null; };

  if (!positions) return <div className="flex items-center justify-center h-full text-xs" style={{ color: theme.textFaint }}>Laying out network…</div>;

  return (
    <svg ref={svgRef} width="100%" height={height} onWheel={onWheel} onMouseDown={onPanDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      style={{ cursor: panRef.current ? "grabbing" : "grab", background: `radial-gradient(700px 400px at 30% 20%, ${theme.glow}, transparent)` }}>
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {visEdges.map((e, i) => {
          const a = positions[e.source], b = positions[e.target];
          if (!a || !b) return null;
          const dim = highlightIds && !(highlightIds.has(e.source) && highlightIds.has(e.target));
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={TYPE_COLOR(theme, e.type)} strokeOpacity={dim ? 0.08 : 0.45} strokeWidth={dim ? 1 : 1.6} />
          );
        })}
        {nodes.map(node => {
          const p = positions[node.id];
          if (!p) return null;
          const isSel = node.id === selectedId;
          const dim = highlightIds && !highlightIds.has(node.id);
          const color = TYPE_COLOR(theme, node.type);
          const r = node.type === "person" ? 14 : 10;
          return (
            <g key={node.id} transform={`translate(${p.x},${p.y})`} onMouseDown={e => onNodeDown(e, node.id)}
              onClick={() => setSelectedId(node.id)} style={{ cursor: "pointer", opacity: dim ? 0.25 : 1 }}>
              {isSel && <circle r={r + 6} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 3" />}
              <circle r={r} fill={theme.surface} stroke={color} strokeWidth={isSel ? 2.5 : 1.6} />
              <foreignObject x={-8} y={-8} width={16} height={16} style={{ pointerEvents: "none" }}>
                <div style={{ color, display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16 }}><IconFor type={node.type} size={11} /></div>
              </foreignObject>
              <text y={r + 13} textAnchor="middle" fontSize={9.5} fill={theme.textMuted} fontFamily="Inter, sans-serif">{node.label}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function DetailPanel({ theme, node, graph, analysis, setSelectedId, addToWorkspace }) {
  if (!node) return (
    <div className="p-5 text-xs h-full flex items-center justify-center text-center" style={{ color: theme.textFaint }}>
      Select a node in the graph to see entity details, connections, and AI indicators.
    </div>
  );
  const r = analysis.results.get(node.id);
  const related = graph.edges.filter(e => e.source === node.id || e.target === node.id).map(e => {
    const otherId = e.source === node.id ? e.target : e.source;
    return { other: graph.nodes.find(n => n.id === otherId), edge: e };
  });
  const nodeAnomalies = analysis.anomalies.filter(a => a.entityId === node.id);

  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: TYPE_COLOR(theme, node.type) + "22", color: TYPE_COLOR(theme, node.type) }}>
          <IconFor type={node.type} size={16} />
        </div>
        <div>
          <div style={{ color: theme.text, fontFamily: "Space Grotesk, sans-serif" }} className="text-sm font-semibold">{node.label}</div>
          <div style={{ color: theme.textFaint }} className="text-[11px] capitalize">{node.type} · {node.id}</div>
        </div>
      </div>

      {r && (
        <>
          <div className="mt-4 p-3 rounded-xl" style={{ background: theme.surface2 }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: theme.text }}>Network Importance Score</span>
              <span className="text-sm font-semibold" style={{ color: theme.accentAmber }}>{r.score}/100</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: theme.border }}>
              <div className="h-full rounded-full" style={{ width: `${r.score}%`, background: theme.accentAmber }} />
            </div>
            <div className="text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
              Based on {r.degree} direct connections, {r.caseCount} linked case{r.caseCount === 1 ? "" : "s"}, betweenness rank {(r.betweenness * 100).toFixed(0)}/100, and {r.crossCommunityLinks} cross-community link{r.crossCommunityLinks === 1 ? "" : "s"}. This is an investigation-priority indicator, not a determination of guilt.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="p-3 rounded-xl" style={{ background: theme.surface2 }}>
              <div className="text-[11px]" style={{ color: theme.textFaint }}>Connections</div>
              <div className="text-lg font-semibold" style={{ color: theme.text }}>{r.degree}</div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: theme.surface2 }}>
              <div className="text-[11px]" style={{ color: theme.textFaint }}>Community</div>
              <div className="text-lg font-semibold" style={{ color: theme.text }}>Group {r.community + 1}</div>
            </div>
          </div>
        </>
      )}

      {nodeAnomalies.length > 0 && (
        <div className="mt-3 space-y-2">
          {nodeAnomalies.map((a, i) => (
            <div key={i} className="p-3 rounded-xl" style={{ background: theme.accentRose + "12", border: `1px solid ${theme.accentRose}33` }}>
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.accentRose }}><AlertTriangle size={12} /> {a.type}</div>
              <div className="text-[11px] mt-1" style={{ color: theme.textMuted }}>{a.detected}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <div className="text-xs font-semibold mb-2" style={{ color: theme.text }}>Related entities ({related.length})</div>
        <div className="space-y-1.5">
          {related.map(({ other, edge }, i) => (
            <button key={i} onClick={() => setSelectedId(other.id)} className="w-full text-left px-2.5 py-2 rounded-lg" style={{ background: theme.surface2 }}>
              <div className="flex items-center gap-2">
                <div style={{ color: TYPE_COLOR(theme, other.type) }}><IconFor type={other.type} size={12} /></div>
                <span className="text-xs font-medium" style={{ color: theme.text }}>{other.label}</span>
              </div>
              <div className="text-[10.5px] mt-0.5 pl-5" style={{ color: theme.textFaint }}>{edge.reason}</div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => addToWorkspace(node.id)} className="w-full mt-4 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
        style={{ background: theme.accentBlue + "18", color: theme.accentBlue, border: `1px solid ${theme.accentBlue}33` }}>
        <Plus size={13} /> Add to investigation workspace
      </button>
    </div>
  );
}

function NetworkAnalysisPage({ theme, graph, analysis, selectedId, setSelectedId, addToWorkspace, initialSearch }) {
  const [typeFilters, setTypeFilters] = useState({ person: true, phone: true, vehicle: true, location: true, case: true });
  const [query, setQuery] = useState(initialSearch || "");
  const [communityFilter, setCommunityFilter] = useState("all");
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 900, h: 560 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.max(400, width), h: Math.max(400, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filteredNodes = useMemo(() => graph.nodes.filter(n => {
    if (!typeFilters[n.type]) return false;
    if (communityFilter !== "all") {
      const r = analysis.results.get(n.id);
      if (!r || String(r.community) !== communityFilter) return false;
    }
    return true;
  }), [graph, typeFilters, communityFilter, analysis]);

  const [positions, setPositions] = useForceLayout(graph.nodes, graph.edges, size.w, size.h);

  const highlightIds = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    const set = new Set();
    graph.nodes.forEach(n => { if (n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) set.add(n.id); });
    // expand to direct neighbors
    graph.edges.forEach(e => { if (set.has(e.source)) set.add(e.target); if (set.has(e.target)) set.add(e.source); });
    return set;
  }, [query, graph]);

  const selectedNode = graph.nodes.find(n => n.id === selectedId);

  return (
    <div className="grid grid-cols-[240px_1fr_320px] h-full" style={{ minHeight: 0 }}>
      {/* Filters */}
      <div className="p-4 overflow-y-auto" style={{ borderRight: `1px solid ${theme.border}` }}>
        <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: theme.text }}><Filter size={13} /> Filters</div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search entity…"
          className="w-full mb-3 px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }} />

        <div className="text-[11px] font-medium mb-1.5" style={{ color: theme.textMuted }}>Entity types</div>
        <div className="space-y-1 mb-4">
          {Object.keys(typeFilters).map(t => (
            <label key={t} className="flex items-center gap-2 text-xs px-1 py-1 rounded-lg" style={{ color: theme.text }}>
              <input type="checkbox" checked={typeFilters[t]} onChange={() => setTypeFilters(f => ({ ...f, [t]: !f[t] }))} />
              <span style={{ color: TYPE_COLOR(theme, t) }}><IconFor type={t} size={12} /></span>
              <span className="capitalize">{t}</span>
            </label>
          ))}
        </div>

        <div className="text-[11px] font-medium mb-1.5" style={{ color: theme.textMuted }}>Community</div>
        <select value={communityFilter} onChange={e => setCommunityFilter(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none mb-4" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }}>
          <option value="all">All communities</option>
          {Array.from({ length: analysis.numCommunities }).map((_, i) => <option key={i} value={i}>Group {i + 1}</option>)}
        </select>

        <div className="text-[11px] font-medium mb-1.5" style={{ color: theme.textMuted }}>Legend</div>
        <div className="space-y-1.5">
          {["person", "phone", "vehicle", "location", "case"].map(t => (
            <div key={t} className="flex items-center gap-2 text-[11px]" style={{ color: theme.textMuted }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLOR(theme, t) }} /> <span className="capitalize">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph */}
      <div ref={wrapRef} className="relative" style={{ minHeight: 0 }}>
        <NetworkGraph theme={theme} nodes={filteredNodes} edges={graph.edges} positions={positions} setPositions={setPositions}
          selectedId={selectedId} setSelectedId={setSelectedId} width={size.w} height={size.h} highlightIds={highlightIds} />
        <div className="absolute bottom-3 left-3 text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: theme.surface + "cc", color: theme.textFaint, border: `1px solid ${theme.border}` }}>
          Scroll to zoom · drag background to pan · drag a node to reposition
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ borderLeft: `1px solid ${theme.border}` }}>
        <DetailPanel theme={theme} node={selectedNode} graph={graph} analysis={analysis} setSelectedId={setSelectedId} addToWorkspace={addToWorkspace} />
      </div>
    </div>
  );
}

/* ============================================================================
   ENTITIES PAGE
============================================================================ */
function EntitiesPage({ theme, graph, analysis, setSelectedId, setView }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const rows = graph.nodes.filter(n => (filter === "all" || n.type === filter) && n.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6">
      <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-xl font-semibold mb-4">Entities</div>
      <div className="flex gap-2 mb-4">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by name…" className="px-3 py-2 rounded-lg text-xs outline-none w-64" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }} />
        {["all", "person", "phone", "vehicle", "location", "case"].map(t => (
          <button key={t} onClick={() => setFilter(t)} className="px-3 py-2 rounded-lg text-xs capitalize font-medium"
            style={{ background: filter === t ? theme.accentBlue + "22" : theme.surface2, color: filter === t ? theme.accentBlue : theme.textMuted, border: `1px solid ${filter === t ? theme.accentBlue + "44" : theme.border}` }}>{t}</button>
        ))}
      </div>
      <Card theme={theme} className="overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
              {["Entity", "Type", "Connections", "Cases", "Priority score"].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: theme.textFaint }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(n => {
              const r = analysis.results.get(n.id);
              return (
                <tr key={n.id} onClick={() => { setSelectedId(n.id); setView("network"); }} className="cursor-pointer" style={{ borderBottom: `1px solid ${theme.borderSoft}` }}>
                  <td className="px-4 py-3 flex items-center gap-2" style={{ color: theme.text }}>
                    <span style={{ color: TYPE_COLOR(theme, n.type) }}><IconFor type={n.type} /></span>{n.label}
                  </td>
                  <td className="px-4 py-3 capitalize" style={{ color: theme.textMuted }}>{n.type}</td>
                  <td className="px-4 py-3" style={{ color: theme.textMuted }}>{r?.degree ?? "—"}</td>
                  <td className="px-4 py-3" style={{ color: theme.textMuted }}>{r?.caseCount ?? "—"}</td>
                  <td className="px-4 py-3">{r ? <Pill theme={theme} color={theme.accentAmber}>{r.score}/100</Pill> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ============================================================================
   CASES PAGE
============================================================================ */
function CasesPage({ theme, graph, setSelectedId, setView }) {
  return (
    <div className="p-6">
      <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-xl font-semibold mb-4">Cases</div>
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(CASE_META).map(([code, meta]) => {
          const linked = graph.edges.filter(e => e.source === `CASE:${code}` || e.target === `CASE:${code}`);
          const persons = linked.map(e => graph.nodes.find(n => n.id === (e.source === `CASE:${code}` ? e.target : e.source))).filter(n => n.type === "person");
          return (
            <Card key={code} theme={theme} className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold" style={{ color: theme.text }}>{meta.title}</div>
                <Pill theme={theme} color="#A784E8">{code}</Pill>
              </div>
              <div className="text-[11px] mb-3" style={{ color: theme.textFaint }}>Opened {meta.date}</div>
              <div className="text-[11px] mb-1.5" style={{ color: theme.textMuted }}>Linked persons ({persons.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {persons.map(p => (
                  <button key={p.id} onClick={() => { setSelectedId(p.id); setView("network"); }} className="text-[11px] px-2 py-1 rounded-full" style={{ background: theme.surface2, color: theme.text }}>{p.label}</button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   DATA UPLOAD PAGE
============================================================================ */
function UploadPage({ theme }) {
  const [stage, setStage] = useState("idle"); // idle -> validating -> preview -> done
  const [fileName, setFileName] = useState(null);

  const simulate = (name) => {
    setFileName(name);
    setStage("validating");
    setTimeout(() => setStage("preview"), 900);
  };

  return (
    <div className="p-6 max-w-3xl">
      <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-xl font-semibold mb-1">Data upload</div>
      <div className="text-xs mb-5" style={{ color: theme.textMuted }}>CSV, Excel, or JSON — columns: Person ID, Name, Phone, Location, Case ID, Vehicle ID</div>

      {stage === "idle" && (
        <Card theme={theme} className="p-10 flex flex-col items-center justify-center text-center border-dashed" style={{ borderStyle: "dashed" }}>
          <Upload size={26} style={{ color: theme.accentBlue }} className="mb-3" />
          <div className="text-sm font-medium mb-1" style={{ color: theme.text }}>Drag and drop a file, or</div>
          <button onClick={() => simulate("field_records_2026-08.csv")} className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: theme.accentBlue, color: "#081022" }}>
            Load sample dataset
          </button>
        </Card>
      )}

      {stage === "validating" && (
        <Card theme={theme} className="p-8 text-center">
          <div className="text-sm mb-2" style={{ color: theme.text }}>Validating {fileName}…</div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: theme.border }}>
            <div className="h-full animate-pulse" style={{ width: "70%", background: theme.accentBlue }} />
          </div>
          <div className="text-[11px] mt-2" style={{ color: theme.textFaint }}>Checking duplicates, missing fields, phone formats, ID validity…</div>
        </Card>
      )}

      {stage === "preview" && (
        <>
          <Card theme={theme} className="p-4 mb-4">
            <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: theme.accentGreen }}><CheckCircle2 size={14} /> Validation complete — 15 records processed, 0 blocking errors, 2 fields auto-normalized.</div>
            <table className="w-full text-xs">
              <thead><tr style={{ borderBottom: `1px solid ${theme.border}` }}>{["Person", "Phone", "Location", "Case", "Vehicle"].map(h => <th key={h} className="text-left px-3 py-2" style={{ color: theme.textFaint }}>{h}</th>)}</tr></thead>
              <tbody>
                {RECORDS.slice(0, 6).map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.borderSoft}` }}>
                    <td className="px-3 py-2" style={{ color: theme.text }}>{r.person}</td>
                    <td className="px-3 py-2" style={{ color: theme.textMuted }}>{r.phone || "—"}</td>
                    <td className="px-3 py-2" style={{ color: theme.textMuted }}>{r.location}</td>
                    <td className="px-3 py-2" style={{ color: theme.textMuted }}>{r.case}</td>
                    <td className="px-3 py-2" style={{ color: theme.textMuted }}>{r.vehicle || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[11px] mt-2" style={{ color: theme.textFaint }}>Showing 6 of {RECORDS.length} records</div>
          </Card>
          <button onClick={() => setStage("done")} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: theme.accentBlue, color: "#081022" }}>Confirm import</button>
        </>
      )}

      {stage === "done" && (
        <Card theme={theme} className="p-6 text-center">
          <CheckCircle2 size={26} style={{ color: theme.accentGreen }} className="mx-auto mb-2" />
          <div className="text-sm font-medium" style={{ color: theme.text }}>Import complete</div>
          <div className="text-xs mt-1" style={{ color: theme.textMuted }}>Entities extracted and relationships created. Open Network Analysis to explore.</div>
          <button onClick={() => setStage("idle")} className="mt-4 px-4 py-2 rounded-lg text-xs font-medium" style={{ background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}` }}>Upload another file</button>
        </Card>
      )}
    </div>
  );
}

/* ============================================================================
   AI ANALYSIS PAGE
============================================================================ */
function AIAnalysisPage({ theme, graph, analysis, setSelectedId, setView }) {
  const persons = [...analysis.results.entries()].filter(([id]) => id.startsWith("P:")).sort((a, b) => b[1].score - a[1].score);
  const communities = Array.from({ length: analysis.numCommunities }).map((_, i) => {
    const members = graph.nodes.filter(n => analysis.results.get(n.id)?.community === i);
    const persons = members.filter(m => m.type === "person");
    const bridges = persons.filter(p => (analysis.results.get(p.id)?.crossCommunityLinks || 0) > 0);
    return { i, members, persons, bridges };
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-xl font-semibold">AI network analysis</div>
        <div className="text-xs mt-1" style={{ color: theme.textMuted }}>Degree centrality · PageRank · betweenness centrality · label-propagation community detection — all explainable, all investigation-support only.</div>
      </div>

      <Card theme={theme} className="p-4 flex items-start gap-2" style={{ background: theme.accentBlue + "0d" }}>
        <Sparkles size={15} style={{ color: theme.accentBlue, marginTop: 1 }} />
        <div className="text-xs" style={{ color: theme.textMuted }}>These results highlight patterns worth a human investigator's attention. They are <b style={{ color: theme.text }}>not</b> conclusions of wrongdoing and must be verified against case evidence before any action is taken.</div>
      </Card>

      <Card theme={theme} className="p-5">
        <div className="text-sm font-semibold mb-3" style={{ color: theme.text }}>Investigation priority ranking</div>
        <div className="space-y-2">
          {persons.map(([id, r]) => {
            const node = graph.nodes.find(n => n.id === id);
            return (
              <button key={id} onClick={() => { setSelectedId(id); setView("network"); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left" style={{ background: theme.surface2 }}>
                <div className="w-24 text-xs font-medium truncate" style={{ color: theme.text }}>{node.label}</div>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: theme.border }}>
                  <div className="h-full rounded-full" style={{ width: `${r.score}%`, background: theme.accentAmber }} />
                </div>
                <div className="w-10 text-right text-xs font-semibold" style={{ color: theme.accentAmber }}>{r.score}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {communities.map(c => (
          <Card key={c.i} theme={theme} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold" style={{ color: theme.text }}>Group {c.i + 1}</div>
              <Pill theme={theme} color={theme.accentBlue}>{c.members.length} entities</Pill>
            </div>
            <div className="text-[11px] mb-2" style={{ color: theme.textFaint }}>Main entities</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {c.persons.map(p => (
                <button key={p.id} onClick={() => { setSelectedId(p.id); setView("network"); }} className="text-[11px] px-2 py-1 rounded-full" style={{ background: theme.surface2, color: theme.text }}>{p.label}</button>
              ))}
            </div>
            {c.bridges.length > 0 && (
              <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: theme.accentRose }}><Share2 size={11} /> Bridge: {c.bridges.map(b => b.label).join(", ")}</div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   ALERTS PAGE
============================================================================ */
function AlertsPage({ theme, analysis, graph, setSelectedId, setView }) {
  const [reviewed, setReviewed] = useState(new Set());
  return (
    <div className="p-6">
      <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-xl font-semibold mb-1">Alerts center</div>
      <div className="text-xs mb-5" style={{ color: theme.textMuted }}>Every alert states what was detected, which data caused it, and how confident the detection is. None imply criminal activity on their own.</div>
      <div className="space-y-3">
        {analysis.anomalies.map((a, i) => {
          const isReviewed = reviewed.has(i);
          return (
            <Card key={i} theme={theme} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} style={{ color: a.severity === "high" ? theme.accentRose : theme.accentAmber, marginTop: 2 }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: theme.text }}>{a.type}</span>
                      <Pill theme={theme} color={a.severity === "high" ? theme.accentRose : theme.accentAmber}>{a.severity} severity</Pill>
                      <Pill theme={theme} color={theme.textMuted}>{Math.round(a.confidence * 100)}% confidence</Pill>
                    </div>
                    <button onClick={() => { setSelectedId(a.entityId); setView("network"); }} className="text-xs font-medium mt-1" style={{ color: theme.accentBlue }}>{a.entity}</button>
                    <div className="text-xs mt-2" style={{ color: theme.textMuted }}><b style={{ color: theme.text }}>Detected:</b> {a.detected}</div>
                    <div className="text-xs mt-1" style={{ color: theme.textMuted }}><b style={{ color: theme.text }}>Cause:</b> {a.cause}</div>
                  </div>
                </div>
                <button onClick={() => setReviewed(s => new Set(s).add(i))}
                  className="text-[11px] px-3 py-1.5 rounded-lg font-medium shrink-0" disabled={isReviewed}
                  style={{ background: isReviewed ? theme.accentGreen + "18" : theme.surface2, color: isReviewed ? theme.accentGreen : theme.textMuted, border: `1px solid ${isReviewed ? theme.accentGreen + "44" : theme.border}` }}>
                  {isReviewed ? "Reviewed" : "Mark as reviewed"}
                </button>
              </div>
            </Card>
          );
        })}
        {analysis.anomalies.length === 0 && <div className="text-xs" style={{ color: theme.textFaint }}>No alerts. The network shows no unusual patterns at this time.</div>}
      </div>
    </div>
  );
}

/* ============================================================================
   INVESTIGATIONS / WORKSPACE PAGE
============================================================================ */
function InvestigationsPage({ theme, graph, workspace, setWorkspace, notes, setNotes, setSelectedId, setView }) {
  const items = workspace.map(id => graph.nodes.find(n => n.id === id)).filter(Boolean);
  return (
    <div className="p-6 max-w-3xl">
      <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-xl font-semibold mb-1">Investigation workspace</div>
      <div className="text-xs mb-5" style={{ color: theme.textMuted }}>"Network Analysis — Case C101" · demo workspace</div>

      <Card theme={theme} className="p-4 mb-4">
        <div className="text-xs font-semibold mb-2" style={{ color: theme.text }}>Selected entities ({items.length})</div>
        {items.length === 0 && <div className="text-xs" style={{ color: theme.textFaint }}>Add entities from the Network Analysis or Entities page.</div>}
        <div className="flex flex-wrap gap-2">
          {items.map(n => (
            <div key={n.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full" style={{ background: theme.surface2, color: theme.text }}>
              <span style={{ color: TYPE_COLOR(theme, n.type) }}><IconFor type={n.type} size={11} /></span>
              <button onClick={() => { setSelectedId(n.id); setView("network"); }}>{n.label}</button>
              <button onClick={() => setWorkspace(w => w.filter(id => id !== n.id))} style={{ color: theme.textFaint }}><X size={11} /></button>
            </div>
          ))}
        </div>
      </Card>

      <Card theme={theme} className="p-4">
        <div className="text-xs font-semibold mb-2" style={{ color: theme.text }}>Investigator notes</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={6} placeholder="Document findings, hypotheses, and next steps…"
          className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }} />
      </Card>
    </div>
  );
}

/* ============================================================================
   REPORTS PAGE
============================================================================ */
function ReportsPage({ theme, graph, analysis, workspace, notes }) {
  const [generated, setGenerated] = useState(false);
  const items = workspace.map(id => graph.nodes.find(n => n.id === id)).filter(Boolean);

  return (
    <div className="p-6 max-w-3xl">
      <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-xl font-semibold mb-1">Reports</div>
      <div className="text-xs mb-5" style={{ color: theme.textMuted }}>Summarize workspace findings for case documentation and human review.</div>

      {!generated ? (
        <Card theme={theme} className="p-6 text-center">
          <FileText size={24} style={{ color: theme.accentBlue }} className="mx-auto mb-2" />
          <div className="text-sm font-medium mb-1" style={{ color: theme.text }}>Generate investigation report</div>
          <div className="text-xs mb-4" style={{ color: theme.textMuted }}>{items.length} workspace entities · {analysis.anomalies.length} alerts · {analysis.numCommunities} communities</div>
          <button onClick={() => setGenerated(true)} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: theme.accentBlue, color: "#081022" }}>Generate report</button>
        </Card>
      ) : (
        <Card theme={theme} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-base font-semibold">Network Analysis — Case C101</div>
            <button onClick={() => window.print()} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg" style={{ background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}` }}><Download size={12} /> Export PDF</button>
          </div>

          <div className="text-xs font-semibold mb-1" style={{ color: theme.text }}>Selected entities</div>
          <div className="text-xs mb-3" style={{ color: theme.textMuted }}>{items.map(i => i.label).join(", ") || "None selected"}</div>

          <div className="text-xs font-semibold mb-1" style={{ color: theme.text }}>Network overview</div>
          <div className="text-xs mb-3" style={{ color: theme.textMuted }}>{graph.nodes.length} entities, {graph.edges.length} data-supported relationships across {analysis.numCommunities} detected communities.</div>

          <div className="text-xs font-semibold mb-1" style={{ color: theme.text }}>AI analysis indicators</div>
          <div className="text-xs mb-3" style={{ color: theme.textMuted }}>Highest network importance: {[...analysis.results.entries()].filter(([id]) => id.startsWith("P:")).sort((a, b) => b[1].score - a[1].score)[0]?.[1]?.score}/100. See Network Analysis and AI Analysis pages for full breakdown.</div>

          <div className="text-xs font-semibold mb-1" style={{ color: theme.text }}>Anomalies flagged</div>
          <ul className="text-xs mb-3 list-disc pl-4" style={{ color: theme.textMuted }}>
            {analysis.anomalies.map((a, i) => <li key={i}>{a.type} — {a.entity}: {a.detected}</li>)}
            {analysis.anomalies.length === 0 && <li>None</li>}
          </ul>

          <div className="text-xs font-semibold mb-1" style={{ color: theme.text }}>Investigator notes</div>
          <div className="text-xs mb-4 whitespace-pre-wrap" style={{ color: theme.textMuted }}>{notes || "—"}</div>

          <div className="p-3 rounded-xl text-[11px]" style={{ background: theme.accentAmber + "14", border: `1px solid ${theme.accentAmber}33`, color: theme.textMuted }}>
            AI-generated analysis is an investigative aid and requires verification by an authorized human investigator.
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================================
   AUDIT LOG + SETTINGS
============================================================================ */
function AuditLogPage({ theme, log }) {
  return (
    <div className="p-6">
      <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-xl font-semibold mb-4">Audit logs</div>
      <Card theme={theme} className="overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr style={{ borderBottom: `1px solid ${theme.border}` }}>{["Time", "User", "Action"].map(h => <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: theme.textFaint }}>{h}</th>)}</tr></thead>
          <tbody>
            {log.map((l, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${theme.borderSoft}` }}>
                <td className="px-4 py-2.5 font-mono text-[11px]" style={{ color: theme.textFaint }}>{l.time}</td>
                <td className="px-4 py-2.5" style={{ color: theme.text }}>{l.user}</td>
                <td className="px-4 py-2.5" style={{ color: theme.textMuted }}>{l.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
function SettingsPage({ theme, isDark, setIsDark, user }) {
  return (
    <div className="p-6 max-w-xl">
      <div style={{ fontFamily: "Space Grotesk, sans-serif", color: theme.text }} className="text-xl font-semibold mb-4">Settings</div>
      <Card theme={theme} className="p-4 mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium" style={{ color: theme.text }}>Appearance</div>
          <div className="text-xs" style={{ color: theme.textMuted }}>Dark mode is the default for extended review sessions.</div>
        </div>
        <button onClick={() => setIsDark(d => !d)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}` }}>{isDark ? "Dark" : "Light"}</button>
      </Card>
      <Card theme={theme} className="p-4 mb-4">
        <div className="text-sm font-medium mb-1" style={{ color: theme.text }}>Account</div>
        <div className="text-xs" style={{ color: theme.textMuted }}>{user.username} · {user.role}</div>
      </Card>
      <Card theme={theme} className="p-4 flex items-start gap-2">
        <ShieldCheck size={14} style={{ color: theme.accentAmber, marginTop: 1 }} />
        <div className="text-xs" style={{ color: theme.textMuted }}>This prototype runs entirely on synthetic demo data with no persistence outside this session. Production deployments separate demo and case data, and enforce role-based access on every endpoint.</div>
      </Card>
    </div>
  );
}

/* ============================================================================
   ROOT APP
============================================================================ */
export default function App() {
  const [isDark, setIsDark] = useState(true);
  const theme = isDark ? T.dark : T.light;
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("P:Nisha");
  const [workspace, setWorkspace] = useState(["P:Arun", "P:Nisha"]);
  const [notes, setNotes] = useState("");
  const [log, setLog] = useState([
    { time: "2026-08-24 09:02", user: "demo.investigator", action: "Logged in" },
    { time: "2026-08-24 09:03", user: "demo.investigator", action: "Uploaded field_records_2026-08.csv" },
    { time: "2026-08-24 09:04", user: "demo.investigator", action: "Ran AI network analysis" },
  ]);

  const graph = useMemo(() => buildGraph(RECORDS), []);
  const analysis = useMemo(() => analyzeGraph(graph.nodes, graph.edges), [graph]);

  const addToWorkspace = useCallback((id) => {
    setWorkspace(w => (w.includes(id) ? w : [...w, id]));
    setLog(l => [...l, { time: new Date().toISOString().slice(0, 16).replace("T", " "), user: user?.username || "demo.investigator", action: `Added ${id} to workspace` }]);
  }, [user]);

  const handleLogin = (u) => {
    setUser(u);
    setLog(l => [{ time: new Date().toISOString().slice(0, 16).replace("T", " "), user: u.username, action: "Logged in" }, ...l]);
  };

  if (!user) return <LoginScreen theme={theme} onLogin={handleLogin} />;

  const pageProps = { theme, graph, analysis, selectedId, setSelectedId, setView, addToWorkspace, workspace, setWorkspace, notes, setNotes, log };

  return (
    <div className="h-full w-full flex" style={{ background: theme.bg, fontFamily: "Inter, sans-serif" }}>
      <style>{FONTS}</style>
      <Sidebar theme={theme} view={view} setView={setView} collapsed={false} alertCount={analysis.anomalies.length} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar theme={theme} isDark={isDark} setIsDark={setIsDark} user={user} onLogout={() => setUser(null)} search={search} setSearch={setSearch} setView={setView} />
        <div className="flex-1 overflow-y-auto min-h-0">
          {view === "dashboard" && <Dashboard {...pageProps} />}
          {view === "investigations" && <InvestigationsPage {...pageProps} />}
          {view === "network" && (
            <div className="h-full" style={{ minHeight: 600 }}>
              <NetworkAnalysisPage {...pageProps} initialSearch={search} />
            </div>
          )}
          {view === "entities" && <EntitiesPage {...pageProps} />}
          {view === "cases" && <CasesPage {...pageProps} />}
          {view === "upload" && <UploadPage theme={theme} />}
          {view === "ai" && <AIAnalysisPage {...pageProps} />}
          {view === "alerts" && <AlertsPage {...pageProps} />}
          {view === "reports" && <ReportsPage {...pageProps} />}
          {view === "audit" && <AuditLogPage theme={theme} log={log} />}
          {view === "settings" && <SettingsPage theme={theme} isDark={isDark} setIsDark={setIsDark} user={user} />}
        </div>
      </div>
    </div>
  );
}
