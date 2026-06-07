import { useState, useEffect, lazy, Suspense } from 'react';
import { api } from './utils/api';
import { isOnboardingCompleted } from './utils/onboarding';
import { BloomMark, NAV_ICONS } from './components/icons.jsx';

// Code-split each page so the initial bundle stays small.
// React.lazy() loads each page chunk on first navigation.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MemoryList = lazy(() => import('./pages/MemoryList'));
const SearchMemories = lazy(() => import('./pages/SearchMemories'));
const Statistics = lazy(() => import('./pages/Statistics'));
const Agents = lazy(() => import('./pages/Agents'));
const Download = lazy(() => import('./pages/Download'));
const ImportWizard = lazy(() => import('./pages/ImportWizard'));
const MemoryHealth = lazy(() => import('./pages/MemoryHealth'));
const Contradictions = lazy(() => import('./pages/Contradictions'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

const APP_VERSION = 'v1.5.3';

// Sidebar nav, grouped per the design system.
const NAV = [
  { group: 'Memory', items: [
    { id: 'dashboard', label: 'Overview', icon: NAV_ICONS.overview },
    { id: 'memories', label: 'Memories', icon: NAV_ICONS.memories },
    { id: 'search', label: 'Search', icon: NAV_ICONS.search },
  ]},
  { group: 'Insight', items: [
    { id: 'statistics', label: 'Statistics', icon: NAV_ICONS.statistics },
    { id: 'health', label: 'Health', icon: NAV_ICONS.health },
    { id: 'contradictions', label: 'Conflicts', icon: NAV_ICONS.conflicts, badge: 'contradictions' },
  ]},
  { group: 'Connect', items: [
    { id: 'agents', label: 'Agents', icon: NAV_ICONS.agents },
    { id: 'import', label: 'Import', icon: NAV_ICONS.import },
    { id: 'download', label: 'Download', icon: NAV_ICONS.download },
  ]},
];

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [contradictionCount, setContradictionCount] = useState(0);
  // `null` = still deciding; true/false = decided.
  const [showOnboarding, setShowOnboarding] = useState(null);

  useEffect(() => {
    // Onboarding decision runs once on first mount.
    if (isOnboardingCompleted()) {
      setShowOnboarding(false);
      return;
    }
    // Fresh install heuristic: dashboard shows onboarding when the user
    // has zero memories AND hasn't ticked the completed flag.
    api.getStatus()
      .then(data => setShowOnboarding((data?.memory?.total ?? 0) === 0))
      .catch(() => setShowOnboarding(false));
  }, []);

  useEffect(() => {
    api.getContradictionCount()
      .then(data => setContradictionCount(data.count || 0))
      .catch(() => {});
  }, [currentPage]);

  // Wait until the onboarding decision is made — prevents the dashboard
  // chrome flashing in for one render before redirecting to the wizard.
  if (showOnboarding === null) {
    return <div className="min-h-screen" style={{ background: 'var(--bg-sunken)' }} />;
  }

  if (showOnboarding) {
    return (
      <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--bg-sunken)' }} />}>
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      </Suspense>
    );
  }

  const pages = {
    dashboard: <Dashboard />,
    memories: <MemoryList />,
    search: <SearchMemories />,
    agents: <Agents />,
    statistics: <Statistics />,
    health: <MemoryHealth />,
    contradictions: <Contradictions />,
    download: <Download />,
    import: <ImportWizard />
  };

  return (
    <div className="app-shell">
      {/* Top brand bar */}
      <header className="topbar">
        <div className="brandline">
          <span className="app-icon app-icon--grad" style={{ width: 30, height: 30 }}>
            <BloomMark className="mark" />
          </span>
          <span className="wordmark">Eng<span className="grad">ram</span></span>
          <span className="ver">{APP_VERSION}</span>
        </div>
        <div className="topbar__actions">
          <button className="btn btn--primary btn--sm" onClick={() => setCurrentPage('memories')}>
            {NAV_ICONS.plus}
            New Memory
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar nav */}
        <nav className="sidebar" aria-label="Primary">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <div className="grp">{group}</div>
              {items.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="nav-item"
                  aria-current={currentPage === item.id ? 'true' : undefined}
                  onClick={(e) => { e.preventDefault(); setCurrentPage(item.id); }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge === 'contradictions' && contradictionCount > 0 && (
                    <span
                      className="badge badge--outcome"
                      style={{ marginLeft: 'auto', padding: '1px 7px' }}
                    >
                      {contradictionCount}
                    </span>
                  )}
                </a>
              ))}
            </div>
          ))}
          <div className="spacer" />
          <div className="sidebar__foot">SQLite for agent memory · local-first</div>
        </nav>

        {/* Page content */}
        <main className="content">
          <div className="page">
            <Suspense
              fallback={
                <div className="dim" style={{ textAlign: 'center', padding: '48px 0' }}>
                  Loading…
                </div>
              }
            >
              {pages[currentPage]}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
