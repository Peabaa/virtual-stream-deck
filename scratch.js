import OBSWebSocket from 'obs-websocket-js';

const obs = new OBSWebSocket();

async function main() {
  try {
    await obs.connect('ws://localhost:4455', 'your_password_here'); // Note: I don't know the user's password, so I'll just skip the password or assume it's blank. Wait, I can't connect if there's a password!
    // Instead of connecting directly, let's just inspect the typedefs in node_modules!
  } catch(e) {}
}
