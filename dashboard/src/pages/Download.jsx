export default function Download() {
  const repoUrl = 'https://github.com/HBarefoot/engram';
  const latestRelease = `${repoUrl}/releases/latest`;
  const dmgUrl = `${latestRelease}/download/Engram_universal.dmg`;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Download Engram Desktop
      </h2>

      {/* Download Card */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-shrink-0 w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              macOS (Universal)
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Apple Silicon (M1/M2/M3/M4) & Intel
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <a
            href={dmgUrl}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download .dmg
          </a>
          <a
            href={latestRelease}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            All releases on GitHub
          </a>
        </div>
      </div>

      {/* Installation Instructions */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Installation
        </h3>
        <ol className="list-decimal list-inside space-y-3 text-gray-700 dark:text-gray-300">
          <li>Download the <code className="text-sm bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">.dmg</code> file above</li>
          <li>Open the DMG and drag <strong>Engram</strong> to your Applications folder</li>
          <li>
            <strong>First launch:</strong> Right-click the app, select <strong>Open</strong>, then click <strong>Open</strong> in the dialog
            <span className="block text-sm text-gray-500 dark:text-gray-400 mt-1 ml-5">
              This is only needed once &mdash; macOS remembers your choice
            </span>
          </li>
        </ol>
      </div>

      {/* Why the extra step */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
          Why the extra step?
        </h3>
        <p className="text-amber-800 dark:text-amber-300 text-sm">
          Engram Desktop is not yet signed with an Apple Developer certificate. macOS Gatekeeper
          blocks unsigned apps by default. Right-clicking and choosing &ldquo;Open&rdquo; tells macOS
          you trust this app. You only need to do this once.
        </p>
        <div className="mt-4">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
            Alternative (Terminal):
          </p>
          <code className="block text-sm bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-3 py-2 rounded">
            xattr -cr /Applications/Engram.app
          </code>
        </div>
      </div>
    </div>
  );
}
