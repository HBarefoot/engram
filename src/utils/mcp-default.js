/**
 * Decide whether a bare CLI invocation should default to the MCP stdio server.
 *
 * MCP clients, proxies, and registries (Glama, mcp-proxy, some IDE launchers)
 * spawn the package's entry point with NO subcommand — e.g. `node bin/engram.js`
 * — and a piped (non-interactive) stdin, expecting a JSON-RPC server to come up
 * over stdio. Commander's default for "no subcommand" is to print help and exit,
 * which those tools read as "server died / connection closed".
 *
 * So: when invoked with no args over a non-TTY stdin, behave as
 * `start --mcp-only`. A human running `engram` in a terminal (TTY stdin) still
 * gets the help text, and any explicit subcommand/flag is left untouched.
 *
 * @param {string[]} args - process.argv.slice(2)
 * @param {boolean|undefined} stdinIsTTY - process.stdin.isTTY
 * @returns {boolean} true if the bare invocation should boot the stdio server
 */
export function shouldDefaultToMcp(args, stdinIsTTY) {
  return args.length === 0 && !stdinIsTTY;
}
