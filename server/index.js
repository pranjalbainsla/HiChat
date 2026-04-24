const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  const numWorkers = os.cpus().length;
  console.log(`Primary ${process.pid} starting ${numWorkers} workers`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died — restarting`);
    cluster.fork();
  });

} else {
  require('./server.js'); // your actual server entry point
  console.log(`Worker ${process.pid} started`);
}