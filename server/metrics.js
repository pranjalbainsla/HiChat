const client = require('prom-client');

client.collectDefaultMetrics();
// ------------------ COUNTERS ------------------
const messagesTotal = new client.Counter({
  name: 'chat_messages_total',
  help: 'Total messages processed',
  labelNames: ['status'] // success | failed
});

// ------------------ GAUGE ------------------
const activeConnections = new client.Gauge({
  name: 'chat_active_connections',
  help: 'Current WebSocket connections'
});

// ------------------ HISTOGRAMS ------------------

// DB write latency
const dbLatency = new client.Histogram({
  name: 'chat_db_latency_ms',
  help: 'Time taken for DB operations',
  buckets: [5, 10, 25, 50, 100, 250, 500]
});

// Full processing latency (socket → emit)
const fullLatency = new client.Histogram({
  name: 'chat_full_latency_ms',
  help: 'End-to-end message processing time',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000]
});

// ------------------ METRICS ENDPOINT ------------------
const metricsHandler = async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
};

module.exports = {
  messagesTotal,
  activeConnections,
  dbLatency,
  fullLatency,
  metricsHandler
};