import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');
const messageRoundTrip = new Trend('message_roundtrip_ms');
const debugCounter = new Counter('debug_msgs');
const debugRound = new Counter('debug_roundTrip');

export const options = {
  vus: 2,
  duration: '5s',
  thresholds: {
    message_roundtrip_ms: ['p(95)<500']
  },
};

export default function () {
  const roomId = `room_${Math.floor(__VU / 2)}`;
  const url = 'ws://host.docker.internal/socket.io/?EIO=4&transport=websocket';

  const res = ws.connect(url, {}, function (socket) {

  const pendingMessages = {};
  let isConnected = false; // track handshake completion

  console.log("connecting...");

  socket.on('open', () => {
    console.log("ws connected (transport level)");
  });

  let isSocketReady = false;

    socket.on('message', (data) => {
      debugCounter.add(1);
      console.log("raw:", data);

      // 🔹 Step 1: Handshake
      if (data.startsWith('0')) {
        socket.send('40'); // send connect
        return;
      }

      // 🔹 Step 2: Wait for server ack
      if (data === '40') {
        isSocketReady = true;

        // now safe to join room
        socket.send(`42["join_room","${roomId}"]`);
        return;
      }

      // 🔹 Step 3: Ping-pong
      if (data === '2') {
        socket.send('3');
        return;
      }

      // 🔹 Step 4: Events
      if (!data.startsWith('42')) return;

      const parsed = JSON.parse(data.slice(2));
      const event = parsed[0];
      const msg = parsed[1];
  

      if (event === 'receive_message' && msg) {
        console.log("msg:", msg);
        messagesReceived.add(1);
        if (msg.sender?._id !== `user_${__VU}`) {
          messageRoundTrip.add(Date.now() - msg.createdAt);
          debugRound.add(1);
        }
      }
    });
    socket.setInterval(() => {
      if(!isSocketReady) return;
      const msgId = `${__VU}_${Date.now()}`;
      const start = Date.now();

      pendingMessages[msgId] = start;

      const payload = {
        id: msgId,
        text: "load test message",
        room: roomId,
        sender: {
          _id: `user_${__VU}`,
          name: `User ${__VU}`
        },
        status: "sending",
        createdAt: Date.now()
      };

      socket.send(`42["send_message", ${JSON.stringify(payload)}]`);

      messagesSent.add(1); // ✅ track sent
    }, 3000);

    socket.on('error', (e) => {
      console.log("error:", e);
    });

    socket.setTimeout(() => {
      socket.close();
    }, 30000);
  });

  check(res, { 'Connected successfully': (r) => r && r.status === 101 });
}