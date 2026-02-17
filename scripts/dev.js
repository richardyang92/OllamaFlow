// Dev script that unsets ELECTRON_RUN_AS_NODE before starting electron-vite
// This is needed because some environments (like VSCode) may set this variable

const { spawn } = require('child_process')
const path = require('path')

// Remove ELECTRON_RUN_AS_NODE from environment
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

// Start electron-vite dev
const child = spawn('npx', ['electron-vite', 'dev'], {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: 'inherit',
  shell: true
})

child.on('close', (code) => {
  process.exit(code)
})
