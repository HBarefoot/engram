export default function Download() {
  const repoUrl = 'https://github.com/HBarefoot/engram';
  const latestRelease = `${repoUrl}/releases/latest`;

  return (
    <div className="space-y-6">
      <div className="page-head">
        <h2>Download Engram Desktop</h2>
      </div>

      {/* Download Card */}
      <div className="card card--pad">
        <div className="flex items-center gap-4 mb-6">
          <div className="app-icon w-16 h-16 flex-shrink-0">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-hi)' }}>
              macOS (Universal)
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-mid)' }}>
              Apple Silicon (M1/M2/M3/M4) & Intel
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <a
            href={latestRelease}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--primary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download from GitHub
          </a>
          <a
            href={`${repoUrl}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--ghost"
          >
            All releases
          </a>
        </div>
      </div>

      {/* Installation Instructions */}
      <div className="card card--pad">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-hi)' }}>
          Installation
        </h3>
        <ol className="list-decimal list-inside space-y-3" style={{ color: 'var(--text-mid)' }}>
          <li>Download the <code className="mono text-sm px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-hi)' }}>.dmg</code> file above</li>
          <li>Open the DMG and drag <strong style={{ color: 'var(--text-hi)' }}>Engram</strong> to your Applications folder</li>
          <li>
            <strong style={{ color: 'var(--text-hi)' }}>First launch:</strong> Right-click the app, select <strong style={{ color: 'var(--text-hi)' }}>Open</strong>, then click <strong style={{ color: 'var(--text-hi)' }}>Open</strong> in the dialog
            <span className="block text-sm mt-1 ml-5" style={{ color: 'var(--text-lo)' }}>
              This is only needed once &mdash; macOS remembers your choice
            </span>
          </li>
        </ol>
      </div>

      {/* Why the extra step */}
      <div className="card card--pad" style={{ borderColor: 'color-mix(in oklab, var(--warn) 35%, transparent)', background: 'color-mix(in oklab, var(--warn) 8%, var(--surface-1))' }}>
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--warn)' }}>
          Why the extra step?
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-mid)' }}>
          Engram Desktop is not yet signed with an Apple Developer certificate. macOS Gatekeeper
          blocks unsigned apps by default. Right-clicking and choosing &ldquo;Open&rdquo; tells macOS
          you trust this app. You only need to do this once.
        </p>
        <div className="mt-4">
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--warn)' }}>
            Alternative (Terminal):
          </p>
          <code className="block mono text-sm px-3 py-2 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-hi)', border: '1px solid var(--border)' }}>
            xattr -cr /Applications/Engram.app
          </code>
        </div>
      </div>
    </div>
  );
}
