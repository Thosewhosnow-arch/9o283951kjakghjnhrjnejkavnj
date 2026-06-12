const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/api/worker/heartbeat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      console.log('Heartbeat received:', JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // Send a dummy task
      res.end(JSON.stringify([{
        id: 'task-1',
        type: 'L4_FLOOD',
        payload: { mode: 'UDP', targetIp: '127.0.0.1', targetPort: 9999, duration: 5000, intensity: 5 }
      }]));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(4000, () => {
  console.log('Mock Master Server running on port 4000');
});
