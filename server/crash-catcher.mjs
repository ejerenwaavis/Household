// Temporary diagnostic script - captures all errors from server startup
process.on('uncaughtException', (err) => {
  const fs = await import('fs');
  // Use sync write since we're about to crash
  const { writeFileSync } = await import('fs');
  writeFileSync('C:\\Temp\\crash.txt', `uncaughtException: ${err.message}\n${err.stack}`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const { writeFileSync } = require('fs');
  writeFileSync('C:\\Temp\\crash.txt', `unhandledRejection: ${reason?.message || reason}\n${reason?.stack || ''}`);
  process.exit(1);
});
