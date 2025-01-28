const WebSocket = require('ws');

const connections = new Map();

function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (connection, req) => {
    try {
      const userId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('userId');
      if (!userId) {
        console.error('Connection rejected: User ID is missing');
        connection.close(4001, 'User ID is required');
        return;
      }

      const normalizedUserId = userId.toString();

      if (!connections.has(normalizedUserId)) {
        connections.set(normalizedUserId, new Set());
        console.log(`New user registered: ${normalizedUserId}`);
      }

      connections.get(normalizedUserId).add(connection);
      console.log(`Connection added for user ${normalizedUserId}. Total connections: ${connections.get(normalizedUserId).size}`);

      connection.on('message', (message) => {
        console.log(`Message received from user ${normalizedUserId}:`, message.toString());
        try {
          connection.send(message); // Echo back the message
        } catch (err) {
          console.error(`Error sending message to user ${normalizedUserId}:`, err);
        }
      });

      connection.on('close', () => {
        console.log(`Connection closed for user: ${normalizedUserId}`);
        const userConnections = connections.get(normalizedUserId);
        if (userConnections) {
          userConnections.delete(connection);
          console.log(`Remaining connections for user ${normalizedUserId}: ${userConnections.size}`);
          if (userConnections.size === 0) {
            connections.delete(normalizedUserId);
            console.log(`All connections closed for user ${normalizedUserId}. User removed.`);
          }
        }
      });
    } catch (err) {
      console.error('Unexpected error in WebSocket connection:', err);
    }
  });

  // Ping all connections every 30 seconds
  setInterval(() => {
    for (const [userId, userConnections] of connections.entries()) {
      for (const conn of userConnections) {
        if (conn.readyState === WebSocket.OPEN) {
          conn.send(JSON.stringify({ type: 'ping' }));
        }
      }
    }
  }, 30000);

  console.log('WebSocket server initialized');
}

function sendNotificationToUser(userId, type, additionalData) {
  try {
    const normalizedUserId = userId.toString();
    const userConnections = connections.get(normalizedUserId);
    if (userConnections) {
      const notification = {
        type,
        ...additionalData,
      };
      for (const conn of userConnections) {
        conn.send(JSON.stringify({ notification }));
      }
      console.log(`Notification sent to user ${normalizedUserId}`);
    } else {
      console.log(`No active connections for user ${normalizedUserId}`);
    }
  } catch (err) {
    console.error(`Error sending notification to user ${userId}:`, err);
  }
}

function getActiveConnections() {
  return Array.from(connections.keys());
}

module.exports = {
  setupWebSocketServer,
  sendNotificationToUser,
  getActiveConnections,
};
