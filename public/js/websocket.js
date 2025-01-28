let reconnectAttempts = 0;
const maxReconnectAttempts = 3;
const reconnectInterval = 10000; // 10 seconds

function initializeWebSocket() {

  let socket;
  if (MODE === 'local') {
    socket = new WebSocket(`ws://localhost:3000/ws?userId=${user._id}`);
  } else {
    socket = new WebSocket(`wss://app.rakubun.com/ws?userId=${user._id}`);
  }

  socket.onopen = () => {
    console.log('WebSocket connection established');
    reconnectAttempts = 0; // Reset reconnect attempts

    if($('#chatContainer').is(':visible')) {
      fetchChatData(chatId,user._id)
    }
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.notification) {
      // log message
      if (data.notification.type == 'log') {
        console.log(data.notification.message);
      }
      // handle showNotification (message, icon)
      if (data.notification.type == 'showNotification') {
        const { message, icon } = data.notification;
        showNotification( message, icon );
      }
      // handle updateElementText (message, icon)
      if (data.notification.type == 'updateElementText') {
        const { selector, message } = data.notification;
        updateElementText(selector, message );
      }
    } else {
      //console.log('Message from server:', event.data);
    }
  };

  socket.onclose = () => {
    console.log('WebSocket connection closed');
    showNotification(translations.websocket.connection_lost, 'warning');
    if (reconnectAttempts < maxReconnectAttempts) {
      setTimeout(() => {
        console.log(`Reconnecting... Attempt ${reconnectAttempts + 1}`);
        reconnectAttempts++;
        initializeWebSocket();
      }, reconnectInterval);
    } else {
      console.error('Max reconnect attempts reached. Could not reconnect to WebSocket.');
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// Initialize WebSocket
initializeWebSocket();
