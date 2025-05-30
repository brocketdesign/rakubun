let reconnectAttempts = 0;
const maxReconnectAttempts = 3;
const reconnectInterval = 10000; // 10 seconds
let socket; // Make socket globally accessible
const messageHandlers = {}; // Store registered message handlers

function initializeWebSocket() {
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
      // Handle blog summary notifications
      if (data.notification.type === 'blog-summary-progress') {
        handleBlogSummaryProgress(data.notification);
      }
      if (data.notification.type === 'blog-summary-complete') {
        handleBlogSummaryComplete(data.notification);
      }
      if (data.notification.type === 'blog-summary-error') {
        handleBlogSummaryError(data.notification);
      }
    } else if (data.type && messageHandlers[data.type]) {
      // Handle custom message types through registered handlers
      messageHandlers[data.type](data);
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

// Function to register message handlers
function registerMessageHandler(messageType, handler) {
  messageHandlers[messageType] = handler;
}

// Function to unregister message handlers
function unregisterMessageHandler(messageType) {
  delete messageHandlers[messageType];
}

// Function to get WebSocket connection status
function isWebSocketConnected() {
  return socket && socket.readyState === WebSocket.OPEN;
}

// Blog summary notification handlers
function handleBlogSummaryProgress(notification) {
    console.log(`[Blog Summary Progress] ${notification.message}`);
    
    // Only show important progress messages, not percentage
    if (notification.progress === 0 || notification.progress === 100 || 
        notification.message.includes('開始') || notification.message.includes('完了') ||
        notification.message.includes('エラー') || notification.message.includes('生成中')) {
        showNotification(notification.message, 'info', 3000);
    }
}

function handleBlogSummaryComplete(notification) {
    console.log('[Blog Summary Complete]', notification.result);
    
    let message = '要約処理が完了しました';
    if (notification.result.processedPost) {
        message = `「${notification.result.processedPost}」の要約が完了しました`;
    } else if (notification.result.message) {
        message = notification.result.message;
    } else if (notification.result.processedCount > 0) {
        message = `${notification.result.processedCount}件の記事を処理しました`;
    }
    
    showNotification(message, 'success', 5000);
}

function handleBlogSummaryError(notification) {
    console.error('[Blog Summary Error]', notification.error);
    
    let message = `要約エラー: ${notification.error}`;
    if (notification.suggestion) {
        message += `\n\n💡 ${notification.suggestion}`;
    }
    
    showNotification(message, 'error', 8000);
}

// Initialize WebSocket
initializeWebSocket();
