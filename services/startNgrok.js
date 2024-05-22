const ngrok = require('ngrok');

async function startNgrok(port) {
  try {
    // Ensure any existing NGROK tunnels are disconnected
    await ngrok.disconnect(); // Attempts to disconnect all tunnels
    await ngrok.kill(); // Ensure all NGROK processes are terminated

    // Set NGROK auth token if required
    if (process.env.NGROK_AUTH_TOKEN) {
      await ngrok.authtoken(process.env.NGROK_AUTH_TOKEN);
    }

    // Start a new NGROK tunnel to the specified port
    const url = await ngrok.connect({
      addr: port,
      region: 'jp' // Optionally set the region
    });
    console.log(`NGROK is publicly exposing your localhost at port ${port} on: ${url}`);
    return url; // Return the NGROK URL for use in other parts of your application
  } catch (error) {
    console.error('Failed to start NGROK:', error);
    return null; // Return null or handle the error as appropriate
  }
}

module.exports = startNgrok;
