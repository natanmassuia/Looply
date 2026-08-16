module.exports = {
  apps: [
    {
      name: 'looply-backend',
      script: './backend/dist/server.js',
      cwd: '/opt/looply',

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,
      max_memory_restart: '500M',

      env: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    }
  ]
}
