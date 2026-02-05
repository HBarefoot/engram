/**
 * Patterns for detecting various types of secrets
 */
const SECRET_PATTERNS = [
  // API Keys
  { pattern: /sk-[a-zA-Z0-9]{32,}/, name: 'OpenAI API Key' },
  { pattern: /pk_[a-zA-Z0-9]{32,}/, name: 'Stripe Publishable Key' },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/, name: 'Stripe Secret Key' },
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key ID' },
  { pattern: /ghp_[a-zA-Z0-9]{20,}/, name: 'GitHub Personal Access Token' },
  { pattern: /gho_[a-zA-Z0-9]{36,}/, name: 'GitHub OAuth Token' },
  { pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/, name: 'GitHub Fine-grained PAT' },
  { pattern: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/, name: 'Slack Bot Token' },
  { pattern: /xoxp-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/, name: 'Slack User Token' },
  { pattern: /AIza[0-9A-Za-z\\-_]{35}/, name: 'Google API Key' },
  { pattern: /ya29\.[0-9A-Za-z\\-_]+/, name: 'Google OAuth Token' },

  // Private Keys
  { pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, name: 'Private Key' },
  { pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/, name: 'PGP Private Key' },

  // Connection Strings with Credentials
  { pattern: /[a-zA-Z]+:\/\/[^:]+:[^@]+@[^/]+/, name: 'Connection String with Credentials' },
  { pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/, name: 'MongoDB Connection String' },
  { pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@/, name: 'PostgreSQL Connection String' },
  { pattern: /mysql:\/\/[^:]+:[^@]+@/, name: 'MySQL Connection String' },

  // JWT Tokens
  { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/, name: 'JWT Token' },

  // Generic High-Entropy Strings (common in secrets)
  { pattern: /['"]([\da-f]{32,}|[A-Za-z0-9+/]{40,}={0,2})['"]/, name: 'High-Entropy String' },

  // Common Secret Environment Variables
  { pattern: /(password|passwd|pwd|secret|token|api_key|apikey|access_key|secret_key|private_key)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/i, name: 'Secret Environment Variable' }
];

/**
 * Check if content contains secrets
 * @param {string} content - Content to check
 * @returns {Object} Result object with detected secrets
 */
export function detectSecrets(content) {
  const detected = [];

  for (const { pattern, name } of SECRET_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      detected.push({
        type: name,
        match: matches[0],
        position: matches.index
      });
    }
  }

  return {
    hasSecrets: detected.length > 0,
    secrets: detected
  };
}

/**
 * Redact secrets from content
 * @param {string} content - Content to redact
 * @returns {string} Content with secrets redacted
 */
export function redactSecrets(content) {
  let redacted = content;

  for (const { pattern } of SECRET_PATTERNS) {
    // Use global flag to replace all occurrences
    const flags = pattern.flags || '';
    const globalPattern = new RegExp(pattern.source, flags.includes('g') ? flags : flags + 'g');
    redacted = redacted.replace(globalPattern, '[REDACTED]');
  }

  return redacted;
}

/**
 * Validate that content is safe to store
 * @param {string} content - Content to validate
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.autoRedact=false] - Auto-redact instead of rejecting
 * @returns {Object} Validation result
 */
export function validateContent(content, options = {}) {
  const { autoRedact = false } = options;
  const detection = detectSecrets(content);

  if (!detection.hasSecrets) {
    return {
      valid: true,
      content,
      warnings: []
    };
  }

  if (autoRedact) {
    return {
      valid: true,
      content: redactSecrets(content),
      warnings: detection.secrets.map(s => `Redacted ${s.type}`)
    };
  }

  return {
    valid: false,
    content,
    errors: detection.secrets.map(s => `Detected ${s.type}: ${s.match.substring(0, 20)}...`),
    warnings: ['Content contains sensitive information and was rejected']
  };
}
