export const PLATFORMS = {
  CLAUDE_DESKTOP: 'claude-desktop',
  CLAUDE_CODE: 'claude-code',
  CLINE: 'cline',
  CUSTOM: 'custom'
};

export const getPlatformConfig = (platform, installationPath, platformOS = 'darwin') => {
  const configs = {
    [PLATFORMS.CLAUDE_DESKTOP]: {
      name: 'Claude Desktop',
      icon: '💬',
      configPath: platformOS === 'darwin'
        ? '~/Library/Application Support/Claude/claude_desktop_config.json'
        : platformOS === 'win32'
        ? '%APPDATA%/Claude/claude_desktop_config.json'
        : '~/.config/Claude/claude_desktop_config.json',
      instructions: [
        'Open or create the config file at the path shown above (create it if it doesn\'t exist yet)',
        'Paste the entire configuration below into the file (or merge the "mcpServers" section if the file already has content)',
        'Restart Claude Desktop application',
        'Test by asking Claude: "What is Engram\'s status?"'
      ],
      config: {
        mcpServers: {
          engram: {
            command: 'node',
            args: [
              installationPath,
              'start',
              '--mcp-only'
            ]
          }
        }
      }
    },
    [PLATFORMS.CLAUDE_CODE]: {
      name: 'Claude Code',
      icon: '⌨️',
      configPath: '~/.claude/mcp.json',
      instructions: [
        'Open or create the file ~/.claude/mcp.json (create it if it doesn\'t exist yet)',
        'Paste the entire configuration below into the file (or merge the "mcpServers" section if the file already has content)',
        'Restart Claude Code',
        'Test by using the engram_status tool'
      ],
      config: {
        mcpServers: {
          engram: {
            command: 'node',
            args: [
              installationPath,
              'start',
              '--mcp-only'
            ]
          }
        }
      }
    },
    [PLATFORMS.CLINE]: {
      name: 'Cline (VS Code)',
      icon: '🔷',
      configPath: platformOS === 'darwin'
        ? '~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'
        : platformOS === 'win32'
        ? '%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'
        : '~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      instructions: [
        'Open VS Code with Cline extension installed',
        'Open or create the Cline MCP settings file at the path shown above',
        'Paste the configuration below (or merge the "mcpServers" section if the file already has content)',
        'Reload VS Code window (Cmd/Ctrl + Shift + P → "Developer: Reload Window")'
      ],
      config: {
        mcpServers: {
          engram: {
            command: 'node',
            args: [
              installationPath,
              'start',
              '--mcp-only'
            ]
          }
        }
      }
    },
    [PLATFORMS.CUSTOM]: {
      name: 'Custom MCP Client',
      icon: '🔧',
      configPath: 'Varies by client',
      instructions: [
        'Locate your MCP client\'s configuration file',
        'Add the Engram MCP server configuration to the mcpServers section',
        'Restart your MCP client application',
        'Verify Engram tools are available'
      ],
      config: {
        mcpServers: {
          engram: {
            command: 'node',
            args: [
              installationPath,
              'start',
              '--mcp-only'
            ]
          }
        }
      }
    }
  };

  return configs[platform];
};

export const getPlatformList = () => [
  {
    id: PLATFORMS.CLAUDE_DESKTOP,
    name: 'Claude Desktop',
    description: 'Anthropic\'s desktop AI assistant',
    icon: '💬',
    popular: true
  },
  {
    id: PLATFORMS.CLAUDE_CODE,
    name: 'Claude Code',
    description: 'Command-line AI coding assistant',
    icon: '⌨️',
    popular: true
  },
  {
    id: PLATFORMS.CLINE,
    name: 'Cline (VS Code)',
    description: 'VS Code extension for Claude',
    icon: '🔷',
    popular: false
  },
  {
    id: PLATFORMS.CUSTOM,
    name: 'Custom MCP Client',
    description: 'Other MCP-compatible tools',
    icon: '🔧',
    popular: false
  }
];
