# PM2 Deployment Guide

This guide covers running Engram as a production service using PM2 process manager.

## Overview

PM2 is a production-grade process manager for Node.js applications. It provides:

- Automatic restarts on crashes
- Zero-downtime reloads
- Log management
- Startup scripts for system boot
- Resource monitoring
- Cluster mode support (future)

## Installation

### Install PM2 Globally

```bash
npm install -g pm2
```

### Verify Installation

```bash
pm2 --version
```

## Quick Start

### Start Engram Service

```bash
# From the engram directory
npm run pm2:start

# Or directly with PM2
pm2 start ecosystem.config.js
```

### Check Service Status

```bash
npm run pm2:status
# or
pm2 status engram
```

You should see output like:

```
┌─────┬───────────┬─────────┬─────────┬─────────┬──────────┐
│ id  │ name      │ mode    │ ↺      │ status  │ cpu      │
├─────┼───────────┼─────────┼─────────┼─────────┼──────────┤
│ 0   │ engram    │ fork    │ 0       │ online  │ 0.2%     │
└─────┴───────────┴─────────┴─────────┴─────────┴──────────┘
```

### View Logs

```bash
# Real-time logs
npm run pm2:logs
# or
pm2 logs engram

# Last 100 lines
pm2 logs engram --lines 100

# Only error logs
pm2 logs engram --err

# Only output logs
pm2 logs engram --out
```

## Common Operations

### Restart Service

```bash
npm run pm2:restart
# or
pm2 restart engram
```

### Stop Service

```bash
npm run pm2:stop
# or
pm2 stop engram
```

### Delete Service

```bash
npm run pm2:delete
# or
pm2 delete engram
```

### Monitor Resources

```bash
npm run pm2:monit
# or
pm2 monit
```

This opens an interactive dashboard showing:
- CPU usage
- Memory usage
- Log output in real-time

## Auto-Start on Boot

To ensure Engram starts automatically when the system boots:

### 1. Generate Startup Script

```bash
pm2 startup
```

This will output a command to run with sudo. Execute that command. Example:

```bash
sudo env PATH=$PATH:/usr/local/bin pm2 startup systemd -u username --hp /home/username
```

### 2. Save Current Process List

```bash
pm2 save
```

### 3. Test (Optional)

```bash
# Reboot and check if engram is running
sudo reboot

# After reboot
pm2 status
```

### Disable Auto-Start

```bash
pm2 unstartup
```

## Configuration

The PM2 configuration is defined in [ecosystem.config.js](../ecosystem.config.js):

```javascript
export default {
  apps: [
    {
      name: 'engram',
      script: './bin/engram.js',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '~/.engram/logs/pm2-error.log',
      out_file: '~/.engram/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    }
  ]
};
```

### Key Configuration Options

- **name**: Process name (used in PM2 commands)
- **script**: Entry point for the application
- **args**: Command-line arguments passed to the script
- **instances**: Number of instances (1 for single instance, use `max` for cluster mode)
- **exec_mode**: `fork` for single instance, `cluster` for load balancing
- **autorestart**: Automatically restart on crash
- **max_memory_restart**: Restart if memory exceeds limit
- **watch**: Watch file changes and auto-reload (disabled for production)
- **error_file**: Path to error log file
- **out_file**: Path to output log file
- **min_uptime**: Minimum uptime before considering app as stable
- **max_restarts**: Maximum restart attempts within min_uptime window
- **restart_delay**: Delay between restart attempts (ms)

### Customizing Configuration

Edit `ecosystem.config.js` to customize:

```javascript
// Change port
args: 'start --port 8080',

// Run MCP-only mode
args: 'start --mcp-only',

// Increase memory limit
max_memory_restart: '1G',

// Enable file watching (dev only)
watch: true,
ignore_watch: ['node_modules', 'logs', '~/.engram'],

// Custom environment variables
env: {
  NODE_ENV: 'production',
  ENGRAM_PORT: '3838'
}
```

## Log Management

### Log Locations

- **PM2 logs**: `~/.engram/logs/pm2-out.log` and `~/.engram/logs/pm2-error.log`
- **Application logs**: Written to stdout/stderr (captured by PM2)

### View Logs

```bash
# All logs (combined)
pm2 logs engram

# Error logs only
pm2 logs engram --err

# Output logs only
pm2 logs engram --out

# Last N lines
pm2 logs engram --lines 200

# Clear logs
pm2 flush engram
```

### Log Rotation

PM2 includes built-in log rotation via `pm2-logrotate`:

```bash
# Install log rotation module
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Monitoring

### Real-time Monitoring

```bash
pm2 monit
```

### Web Dashboard (PM2 Plus)

For advanced monitoring, consider PM2 Plus (formerly Keymetrics):

```bash
pm2 link <secret> <public>
```

Visit https://app.pm2.io for web dashboard.

### Basic Metrics

```bash
# Process info
pm2 show engram

# Resource usage
pm2 monit

# List all processes
pm2 list
```

## Troubleshooting

### Service Won't Start

```bash
# Check PM2 logs
pm2 logs engram --err --lines 50

# Check if port is in use
lsof -i :3838

# Try starting manually to see errors
node bin/engram.js start
```

### Service Keeps Restarting

```bash
# Check error logs
pm2 logs engram --err

# Check if it's hitting memory limit
pm2 show engram | grep memory

# Increase memory limit in ecosystem.config.js
max_memory_restart: '1G'
```

### Logs Not Appearing

```bash
# Check log directory permissions
ls -la ~/.engram/logs/

# Create logs directory if missing
mkdir -p ~/.engram/logs

# Restart service
pm2 restart engram
```

### Auto-Start Not Working

```bash
# Verify startup script
pm2 startup

# Check saved process list
pm2 status

# Re-save if needed
pm2 save

# Check system logs
journalctl -u pm2-$USER
```

### High Memory Usage

```bash
# Check current memory usage
pm2 show engram | grep memory

# Restart to clear memory
pm2 restart engram

# Adjust memory limit
# Edit ecosystem.config.js and set lower max_memory_restart

# Reload configuration
pm2 reload ecosystem.config.js
```

## Production Checklist

- [ ] PM2 installed globally
- [ ] Service starts successfully: `pm2 start ecosystem.config.js`
- [ ] Service auto-restarts on crash (test by killing process)
- [ ] Logs are being written to `~/.engram/logs/`
- [ ] Auto-start on boot configured: `pm2 startup` + `pm2 save`
- [ ] Log rotation configured (optional but recommended)
- [ ] Monitoring setup (pm2 monit or PM2 Plus)
- [ ] Memory limits appropriate for your system
- [ ] Service accessible at configured port

## Advanced Usage

### Multiple Instances (Future)

For load balancing across CPU cores:

```javascript
// ecosystem.config.js
{
  instances: 'max',  // or specific number
  exec_mode: 'cluster'
}
```

**Note**: Cluster mode requires additional work for SQLite synchronization. Not recommended for v1.

### Environment-Specific Configs

```javascript
export default {
  apps: [{
    name: 'engram',
    script: './bin/engram.js',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3838
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3839
    }
  }]
};
```

Start with specific environment:

```bash
pm2 start ecosystem.config.js --env production
```

### Graceful Shutdown

PM2 sends SIGINT/SIGTERM for graceful shutdown. Engram already handles these signals in [bin/engram.js:47-55](../bin/engram.js#L47-L55).

### Zero-Downtime Reload

```bash
pm2 reload engram
```

Gracefully reloads the application with zero downtime (useful for cluster mode).

## Comparison with Other Methods

| Method | Use Case | Pros | Cons |
|--------|----------|------|------|
| `npm start` | Development | Simple, immediate logs | No auto-restart, not persistent |
| `pm2` | Production | Auto-restart, monitoring, logs | Requires PM2 installation |
| `systemd` | Linux servers | Native, no dependencies | OS-specific, more complex |
| `docker` | Containerized | Portable, isolated | Requires Docker, overhead |

## References

- [PM2 Official Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 Startup Script](https://pm2.keymetrics.io/docs/usage/startup/)
- [PM2 Log Management](https://pm2.keymetrics.io/docs/usage/log-management/)
- [PM2 Process Management](https://pm2.keymetrics.io/docs/usage/process-management/)

## Support

For PM2-specific issues:
- PM2 GitHub: https://github.com/Unitech/pm2
- PM2 Documentation: https://pm2.keymetrics.io

For Engram-specific issues:
- Check [main documentation](../README.md)
- Open an issue: https://github.com/your-username/engram/issues
