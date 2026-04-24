# HiChat - Real-Time Messaging Platform

A horizontally scalable WebSocket messaging system capable of handling 300 concurrent connections with **99.8% message delivery** at p95 119ms.

## Features

- **Real-time messaging** via Socket.IO with Redis Pub/Sub adapter for cross-instance delivery
- **Horizontal scaling** with Nginx least-connections load balancing across Node.js cluster workers
- **Auth**: Google OAuth 2.0 + email/password (bcrypt), secured with JWT
- **Persistent messages**: MongoDB with pre-generated ObjectIds to decouple delivery from writes

## Architecture

```
Client → Nginx (least-conn LB)
              ↓
    Node.js Cluster (4 workers)
              ↓
    Socket.IO ←→ Redis Pub/Sub
              ↓
           MongoDB
```

## Performance (load tested with k6)

| Scenario | Connections | p95 Latency | Delivery Rate |
|---|---|---|---|
| Sustained | 200 VUs | **119ms** | **99.8%** |
| Spike | 300 VUs | graceful degradation | zero interruptions |

> Node.js cluster mode (4 workers) reduced p95 latency from 264ms → 119ms at 200 concurrent connections.

> Pre-generating MongoDB ObjectIds before DB writes eliminated a write-queue bottleneck that spiked to 24s at 100 msg/sec.

## Tech stack

`Node.js` · `Socket.IO` · `Redis` · `MongoDB` · `Nginx` · `React.js` · `JWT` · `k6`

