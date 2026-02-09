import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import MemoryList from './pages/MemoryList';
import SearchMemories from './pages/SearchMemories';
import Statistics from './pages/Statistics';
import Agents from './pages/Agents';
import Download from './pages/Download';
import ImportWizard from './pages/ImportWizard';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const pages = {
    dashboard: <Dashboard />,
    memories: <MemoryList />,
    search: <SearchMemories />,
    agents: <Agents />,
    statistics: <Statistics />,
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
          {pages[currentPage]}
        </div>
      </main>
    </div>
  );
}

export default App;
