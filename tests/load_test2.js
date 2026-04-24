import ws from 'k6/ws';
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const messageRoundTrip = new Trend('message_roundtrip_ms', true); // true = percentiles
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');

/*export const options = {
  vus: 10,
  duration: '10s',

  thresholds: {
    // connection sanity
    ws_connecting: ['p(95)<500'],

    // messages actually flowing
    ws_msgs_sent: ['count>0'],
    ws_msgs_received: ['count>0'],

    // your custom metrics
    messages_sent: ['count>0'],
    message_roundtrip_ms: ['count>0'],

    // latency sanity
    message_roundtrip_ms: ['p(95)<1000'],
  },
};
export const options = {

  scenarios: {
    chat_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // normal
        { duration: '30s', target: 200 }, // sudden spike
        { duration: '3m', target: 200 },  // hold
        { duration: '30s', target: 50 },  // recover
        { duration: '1m', target: 50 },   // verify recovery
      ],
      stages: [
        { duration: '2m', target: 100 },
        { duration: '3m', target: 200 },  // where does it start breaking?
        { duration: '2m', target: 200 },  // hold and observe
        { duration: '1m', target: 0 },
      ],
      gracefulStop: '30s',
    },
  },

  thresholds: {
    messages_sent: ['count>0'],
    messages_received: ['count>0'],
    message_roundtrip_ms: ['p(95)<1000'],
  },
};*/
export const options = {
  scenarios: {
    // Scenario 1 — steady state
    sustained_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },  // ramp
        { duration: '5m', target: 200 },  // hold — get clean p95 here
        { duration: '1m', target: 0 },    // ramp down
      ],
      gracefulStop: '30s',
    },

    // Scenario 2 — spike
    spike: {
      executor: 'ramping-vus',
      startTime: '8m',  // starts after sustained load finishes
      startVUs: 50,
      stages: [
        { duration: '30s', target: 50 },   // normal
        { duration: '30s', target: 300 },  // sudden spike
        { duration: '2m', target: 300 },   // hold spike
        { duration: '30s', target: 50 },   // recover
        { duration: '1m', target: 50 },    // verify recovery clean
      ],
      gracefulStop: '30s',
    },
  },

  thresholds: {
    message_roundtrip_ms: ['p(95)<500'],
    messages_sent: ['count>1000'],
    messages_received: ['count>1000'],
  },
};


const shared = new SharedArray('seed data', function () {
  return [JSON.parse(open('./server/seed_output.json'))];
});

const USERS = shared[0].users;
const ROOMS = shared[0].rooms;
const TOKENS = shared[0].tokens;

let globalMessageCount = 0;

export default function () {
  const vuIndex = __VU - 1;
  const userIndex = vuIndex % USERS.length;
  const roomIndex = Math.floor(userIndex / 2);

  const token  = TOKENS[userIndex];
  const userId = USERS[userIndex];
  const roomId = ROOMS[roomIndex];

  // pending is a Map of msg tempId -> timestamp sent
  // used to calculate round-trip when receive_message fires
  const pending = new Map();
  let msgCount = 0;
  let connected = false;

  const url = `ws://localhost:80/socket.io/?EIO=4&transport=websocket&token=${token}`;

  const res = ws.connect(url, {}, function (socket) {

    socket.on('open', () => {
      // Socket.IO connect packet — sends token in auth
      socket.send("40");
    });

    socket.on('message', (raw) => {
      // Engine.IO open packet — ignore
      if (raw.startsWith('0')){
        return;
      }

      // Socket.IO connected — now join your room
      if (raw.startsWith('40')) {

        connected = true;
        return;
      }

      // Heartbeat ping from server — respond with pong
      if (raw === '2') {
        socket.send('3');
        return;
      }

      // Actual event packet
      if (raw.startsWith('42')) {
      
        try {
          const [event, data] = JSON.parse(raw.slice(2));
          console.log(`VU${__VU} event:`, data, 'tempId:', data?.tempId);

          if (event === 'receive_message' && data.tempId) {
            const sentAt = pending.get(data.tempId);
            if (sentAt) {
              messageRoundTrip.add(Date.now() - sentAt);
              messagesReceived.add(1);
              pending.delete(data.tempId);
            }
          }
        } catch (e) {
          console.log(`VU${__VU} parse error:`, e.message, raw.substring(0, 50))
        }
      }
    });

    socket.on('error', (e) => console.error(`VU ${__VU} error:`, e));

    // Send a message every 3 seconds once connected
    socket.setInterval(() => {
        if (!connected) return;

        const tempId = `${__VU}-${globalMessageCount++}`;
        pending.set(tempId, Date.now());

        socket.send(`42["send_message", ${JSON.stringify({
            room: roomId,
            text: 'load test message',
            id: tempId,
            createdAt: Date.now(),
            sender: {
              _id: userId
            }
        })}]`);

        messagesSent.add(1);
    }, 4000);

    // Each VU stays connected for 30 seconds then disconnects cleanly
    socket.setTimeout(() => socket.close(), 30000);
  });

  check(res, { 'WebSocket handshake 101': (r) => r && r.status === 101 });
}