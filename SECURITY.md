# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Engram, please report it privately. **Do not open a public issue.**

### How to Report

Send an email to: **hbarefoot@pm.me**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- We will acknowledge receipt within 48 hours
- We will provide an initial assessment within 7 days
- We will keep you updated on the progress of the fix

### Supported Versions

We release security updates for the latest stable version only. Please ensure you're running the latest version before reporting:

```bash
npm install -g @hbarefoot/engram@latest
```

## Security Best Practices

When using Engram:

1. **Secrets Detection**: Engram automatically detects and blocks common secrets (API keys, tokens, passwords). This is enabled by default.

2. **Local-First**: All data is stored locally in `~/.engram/` - no cloud services are used.

3. **Namespace Isolation**: Use different namespaces for different projects or contexts to isolate sensitive data.

4. **Access Control**: The REST API runs on localhost by default. Only expose it to other networks if you understand the security implications.

5. **Review Memories**: Regularly review stored memories to ensure no sensitive data has been inadvertently saved.

## Known Security Considerations

- **Local Storage**: Memory data is stored unencrypted in SQLite at `~/.engram/memory.db`
- **MCP Integration**: When used with MCP clients, memories are accessible to the AI agent
- **REST API**: The HTTP API has no authentication by default (intended for local use only)

## Disclosure Policy

When we receive a security report:

1. We will confirm the issue and determine its severity
2. We will prepare a fix and release it as soon as possible
3. We will credit the reporter (unless they prefer to remain anonymous)
4. We will publish a security advisory on GitHub

Thank you for helping keep Engram secure!
