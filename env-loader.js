const fs = require('fs');

function loadEnv() {
  const encodedEnv = process.env.RAILWAY_B64_ENV || process.env.SECRET_ENV || process.env.APP_CONFIG;
  if (encodedEnv) {
    try {
      const decoded = Buffer.from(encodedEnv, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      let envFile = '';
      for (const [key, value] of Object.entries(parsed)) {
        envFile += `${key}="${value}"\n`;
        process.env[key] = value;
      }
      fs.writeFileSync('.env', envFile);
      console.log('[Setup] Environment securely loaded.');
    } catch (err) {
      console.error('[Setup] Failed to decode environment:', err.message);
    }
  }
}

loadEnv();
