const ngrok = require('ngrok');
const { exec } = require('child_process');

async function startNgrok(port) {
  try {
    // Attempt to kill any existing ngrok processes
    await new Promise((resolve, reject) => {
      exec('pkill -f ngrok', (error, stdout, stderr) => {
        if (error) {
          console.warn('Failed to kill existing ngrok processes:', stderr);
          resolve(); // Resolve anyway to continue with ngrok setup
        } else {
          console.log('Existing ngrok processes killed', stdout);
          resolve();
        }
      });
    });

    // Ensure any existing NGROK tunnels are disconnected
    await ngrok.disconnect();
    await ngrok.kill();

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
