const { join } = require('path');
const { homedir } = require('os');

module.exports = {
  apps: [
    {
      name: 'engram',
      script: join(__dirname, 'bin', 'engram.js'),
      args: 'start',
      cwd: __dirname,
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: join(homedir(), '.engram', 'logs', 'pm2-error.log'),
      out_file: join(homedir(), '.engram', 'logs', 'pm2-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    }
  ]
};
