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
        id: "mock-task-1",
        type: "NET_TEST_A",
        payload: {
          targetUrl: "http://example.com",
          intensity: 50,
          mode: "GET",
          duration: 600000
        }
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
