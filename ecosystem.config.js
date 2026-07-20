// ecosystem.config.js 
module.exports = { 
    apps: [{ 
      name: "db-viewer", 
      script: "npm", 
      args: "start", 
      cwd: "/mnt/disk1/deploy/db-viewer", 
      env: { 
        PORT: 8001, 
        NODE_ENV: "production" 
      } 
    }] 
  } 
  