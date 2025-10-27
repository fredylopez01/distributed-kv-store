const axios = require('axios');
const readline = require('readline');

const NODES = [
    'http://node1:3000',
    'http://node2:3001',
    'http://node3:3002'
];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function getRandomNode() {
    return NODES[Math.floor(Math.random() * NODES.length)];
}

async function putKeyValue(key, value) {
    const node = getRandomNode();
    try {
        const response = await axios.put(`${node}/${key}`, { value });
        console.log(`[CLIENT] PUT ${key} = ${value} (via ${node})`);
        return response.data;
    } catch (error) {
        console.error(`Error writing to ${node}:`, error.message);
    }
}

async function getKeyValue(key) {
    const node = getRandomNode();
    try {
        const response = await axios.get(`${node}/${key}`);
        console.log(`[CLIENT] GET ${key} = ${response.data.value} (via ${node}, timestamp: ${response.data.timestamp})`);
        return response.data;
    } catch (error) {
        console.error(`Error reading from ${node}:`, error.message);
    }
}

async function showOperations() {
    console.log('\nOperation History:');
    console.log('-----------------');
    
    for (const node of NODES) {
        try {
            const response = await axios.get(`${node}/operations`);
            console.log(`\nNode: ${response.data.nodeId}`);
            console.log('Operations:');
            response.data.operations.forEach(op => {
                console.log(`  [${new Date(op.timestamp).toISOString()}] ${op.type.toUpperCase()} ${op.key} = ${op.value}`);
            });
        } catch (error) {
            console.error(`Error getting operations from ${node}:`, error.message);
        }
    }
}

function showMenu() {
    console.log('\nDistributed KV Store Client');
    console.log('-------------------------');
    console.log('1. PUT key-value pair');
    console.log('2. GET value by key');
    console.log('3. Show operation history');
    console.log('4. Exit');
    console.log('-------------------------');

    rl.question('Select an option (1-4): ', async (answer) => {
        switch (answer) {
            case '1':
                rl.question('Enter key: ', async (key) => {
                    rl.question('Enter value: ', async (value) => {
                        await putKeyValue(key, value);
                        showMenu();
                    });
                });
                break;
            case '2':
                rl.question('Enter key: ', async (key) => {
                    await getKeyValue(key);
                    showMenu();
                });
                break;
            case '3':
                await showOperations();
                showMenu();
                break;
            case '4':
                console.log('Goodbye!');
                rl.close();
                process.exit(0);
                break;
            default:
                console.log('Invalid option. Please try again.');
                showMenu();
        }
    });
}

// Start the client
console.log('Distributed Key-Value Store Client');
console.log('Nodes:', NODES.join(', '));
showMenu();
