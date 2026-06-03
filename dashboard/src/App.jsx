import { useState, useEffect, lazy, Suspense } from 'react';
import { api } from './utils/api';
import { isOnboardingCompleted } from './utils/onboarding';

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
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900" />;
  }

  if (showOnboarding) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900" />}>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-2.5">
                <img src="/engram-logo.png" alt="Engram" className="h-8 w-8 rounded-lg" />
                <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  Engram
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className={`${
                    currentPage === 'dashboard'
                      ? 'border-primary-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentPage('memories')}
                  className={`${
                    currentPage === 'memories'
                      ? 'border-primary-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Memories
                </button>
                <button
                  onClick={() => setCurrentPage('search')}
                  className={`${
                    currentPage === 'search'
                      ? 'border-primary-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Search
                </button>
                <button
                  onClick={() => setCurrentPage('agents')}
                  className={`${
                    currentPage === 'agents'
                      ? 'border-primary-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Agents
                </button>
                <button
                  onClick={() => setCurrentPage('statistics')}
                  className={`${
                    currentPage === 'statistics'
                      ? 'border-primary-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Statistics
                </button>
                <button
                  onClick={() => setCurrentPage('health')}
                  className={`${
                    currentPage === 'health'
                      ? 'border-primary-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Health
                </button>
                <button
                  onClick={() => setCurrentPage('contradictions')}
                  className={`${
                    currentPage === 'contradictions'
                      ? 'border-primary-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium relative`}
                >
                  Conflicts
                  {contradictionCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                      {contradictionCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setCurrentPage('import')}
                  className={`${
                    currentPage === 'import'
                      ? 'border-primary-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Import
                </button>
                <button
                  onClick={() => setCurrentPage('download')}
                  className={`${
                    currentPage === 'download'
                      ? 'border-primary-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Suspense
            fallback={
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                Loading…
              </div>
            }
          >
            {pages[currentPage]}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default App;
