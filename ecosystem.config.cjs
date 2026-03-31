module.exports = {
  apps: [
    {
      name: "energy-ai-web",
      cwd: "/var/www/energy-ai/server",
      script: "src/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: "420M",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        NODE_OPTIONS: "--max-old-space-size=384",
        TZ: "UTC"
      }
    }
  ]
};
