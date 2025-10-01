import express from 'express';
import os from 'os';

const router = express.Router();

/**
 * Configuration API for offline demo setup
 * Provides server discovery and QR code configuration
 */

// Get server's local network IPs
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({
          interface: name,
          ip: iface.address,
          mac: iface.mac
        });
      }
    }
  }

  return ips;
}

// GET /api/config - Returns server configuration
router.get('/', (req, res) => {
  const ips = getLocalIPs();
  const hostname = os.hostname();
  const primaryIP = ips.length > 0 ? ips[0].ip : 'localhost';

  const config = {
    apiUrl: `http://${primaryIP}:3000/api`,
    wsUrl: `http://${primaryIP}:3000`,
    hostname: hostname,
    mdnsUrl: `http://${hostname}.local:3000/api`,
    availableIPs: ips,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    offline: true
  };

  res.json(config);
});

// GET /api/config/qr - Returns config as QR-friendly JSON string
router.get('/qr', (req, res) => {
  const ips = getLocalIPs();
  const primaryIP = ips.length > 0 ? ips[0].ip : 'localhost';
  const hostname = os.hostname();

  const configString = JSON.stringify({
    api: `http://${primaryIP}:3000/api`,
    ws: `http://${primaryIP}:3000`,
    mdns: `http://${hostname}.local:3000/api`,
    v: '1.0'
  });

  res.json({
    config: configString,
    displayUrl: `http://${primaryIP}:3000`,
    qrData: configString
  });
});

// GET /api/config/display - HTML page with QR code
router.get('/display', (req, res) => {
  const ips = getLocalIPs();
  const primaryIP = ips.length > 0 ? ips[0].ip : 'localhost';
  const hostname = os.hostname();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VerbumCare Server Configuration</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .container {
      max-width: 800px;
      width: 100%;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      margin-bottom: 20px;
    }
    h1 {
      color: #2196F3;
      margin-bottom: 10px;
      font-size: 32px;
    }
    .status {
      display: inline-block;
      padding: 6px 16px;
      background: #4CAF50;
      color: white;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 30px;
    }
    .config-item {
      margin: 20px 0;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #2196F3;
    }
    .label {
      font-weight: 600;
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .value {
      color: #333;
      font-size: 18px;
      font-family: 'Courier New', monospace;
      word-break: break-all;
    }
    .qr-container {
      text-align: center;
      padding: 40px;
      background: #ffffff;
      border-radius: 12px;
      border: 3px dashed #2196F3;
      margin: 30px 0;
    }
    .qr-title {
      color: #2196F3;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    #qrcode {
      display: inline-block;
      padding: 20px;
      background: white;
      border-radius: 8px;
    }
    .qr-hint {
      margin-top: 15px;
      font-size: 14px;
      color: #999;
    }
    .instructions {
      background: #e3f2fd;
      padding: 30px;
      border-radius: 12px;
      border-left: 4px solid #2196F3;
    }
    .instructions h3 {
      color: #1976D2;
      margin-bottom: 15px;
      font-size: 20px;
    }
    .instructions ol {
      margin-left: 20px;
      line-height: 1.8;
    }
    .instructions li {
      margin: 10px 0;
      color: #555;
    }
    .instructions code {
      background: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      color: #e91e63;
    }
    @media print {
      body { background: white; }
      .card { box-shadow: none; border: 1px solid #ddd; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>🏥 VerbumCare Server</h1>
      <div class="status">● ONLINE & READY</div>

      <div class="config-item">
        <div class="label">📡 Primary API URL</div>
        <div class="value">http://${primaryIP}:3000/api</div>
      </div>

      <div class="config-item">
        <div class="label">🔗 mDNS URL (Recommended for Apple devices)</div>
        <div class="value">http://${hostname}.local:3000/api</div>
      </div>

      <div class="config-item">
        <div class="label">⚡ WebSocket URL</div>
        <div class="value">http://${primaryIP}:3000</div>
      </div>

      ${ips.length > 1 ? `
      <div class="config-item">
        <div class="label">🌐 Alternative Network Interfaces</div>
        ${ips.slice(1).map(ip => `
          <div class="value" style="font-size: 14px; margin-top: 8px;">
            ${ip.interface}: http://${ip.ip}:3000/api
          </div>
        `).join('')}
      </div>
      ` : ''}

      <div class="qr-container">
        <div class="qr-title">📱 Scan to Auto-Configure</div>
        <div id="qrcode"></div>
        <div class="qr-hint">
          Use your iOS app to scan this QR code for instant configuration
        </div>
      </div>
    </div>

    <div class="card instructions">
      <h3>📋 Setup Instructions</h3>
      <ol>
        <li><strong>For Web Applications:</strong> Copy the mDNS URL (<code>http://${hostname}.local:3000/api</code>) to your <code>.env</code> file</li>
        <li><strong>For iOS/Mobile Apps:</strong> Scan the QR code above to automatically configure the app</li>
        <li><strong>Manual Configuration:</strong> Use the Primary API URL if auto-discovery fails</li>
        <li><strong>Troubleshooting:</strong> Run <code>./discover-backend.sh</code> from project root to find the server</li>
        <li><strong>Network:</strong> Ensure all devices are on the same WiFi network</li>
      </ol>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script>
    const config = {
      api: 'http://${primaryIP}:3000/api',
      ws: 'http://${primaryIP}:3000',
      mdns: 'http://${hostname}.local:3000/api',
      v: '1.0'
    };

    new QRCode(document.getElementById('qrcode'), {
      text: JSON.stringify(config),
      width: 256,
      height: 256,
      colorDark: '#2196F3',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  </script>
</body>
</html>`;

  res.send(html);
});

export default router;