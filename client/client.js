const axios = require('axios');
const readline = require('readline');

const NODES = [
    { id: 'node1', url: 'http://node1:3000' },
    { id: 'node2', url: 'http://node2:3001' },
    { id: 'node3', url: 'http://node3:3002' }
];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let currentLeader = null;

async function findLeader() {
    for (const node of NODES) {
        try {
            const response = await axios.get(`${node.url}/raft-state`, { timeout: 2000 });
            if (response.data.state === 'leader') {
                currentLeader = node;
                console.log(`[CLIENT] Líder detectado: ${node.id}`);
                return node;
            }
        } catch (error) {
            // Node not available, continue
        }
    }
    console.log('[CLIENT] ⚠️ No se detectó líder, usando nodo aleatorio');
    return NODES[Math.floor(Math.random() * NODES.length)];
}

async function getLeader() {
    if (!currentLeader) {
        await findLeader();
    }
    return currentLeader;
}

async function putKeyValue(key, value) {
    const leader = await getLeader();
    try {
        const response = await axios.put(`${leader.url}/${key}`, { value });
        console.log(`[CLIENT] ✅ PUT ${key} = ${value} (via ${leader.id} - LÍDER, Term ${response.data.term})`);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 500) {
            console.log(`[CLIENT] 🔄 Líder ${leader.id} falló, buscando nuevo líder...`);
            currentLeader = null; // Reset leader
            const newLeader = await getLeader();
            if (newLeader.id !== leader.id) {
                return await putKeyValue(key, value); // Retry with new leader
            }
        }
        console.error(`[CLIENT] ❌ Error escribiendo en ${leader.id}:`, error.message);
    }
}

async function getKeyValue(key) {
    const leader = await getLeader();
    try {
        const response = await axios.get(`${leader.url}/${key}`);
        console.log(`[CLIENT] ✅ GET ${key} = ${response.data.value} (via ${leader.id} - LÍDER, timestamp: ${response.data.timestamp})`);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log(`[CLIENT] ⚠️ Clave "${key}" no encontrada`);
        } else {
            console.error(`[CLIENT] ❌ Error leyendo de ${leader.id}:`, error.message);
        }
    }
}

async function showOperations() {
    console.log('\n📜 Historial de Operaciones:');
    console.log('================================');
    
    for (const node of NODES) {
        try {
            const response = await axios.get(`${node.url}/operations`, { timeout: 3000 });
            const raftState = await axios.get(`${node.url}/raft-state`, { timeout: 3000 });
            
            const stateIcon = raftState.data.state === 'leader' ? '👑' : 
                           raftState.data.state === 'candidate' ? '🟡' : '🔵';
            
            console.log(`\n${stateIcon} Node: ${response.data.nodeId} (${raftState.data.state.toUpperCase()})`);
            console.log(`   Operaciones: ${response.data.operations.length}`);
            
            if (response.data.operations.length > 0) {
                response.data.operations.slice(-3).forEach(op => {
                    console.log(`   [${new Date(op.timestamp).toLocaleTimeString()}] ${op.type.toUpperCase()} ${op.key} = "${op.value}" (Term ${op.term})`);
                });
            } else {
                console.log('   (Sin operaciones)');
            }
        } catch (error) {
            console.error(`   ❌ Error conectando con ${node.id}:`, error.message);
        }
    }
}

async function showClusterStatus() {
    console.log('\n🏛️ Estado del Cluster Raft:');
    console.log('===============================');
    
    let leaderCount = 0;
    let onlineCount = 0;
    
    for (const node of NODES) {
        try {
            const response = await axios.get(`${node.url}/raft-state`, { timeout: 3000 });
            onlineCount++;
            
            const stateIcon = response.data.state === 'leader' ? '👑' : 
                           response.data.state === 'candidate' ? '🟡' : '🔵';
            
            console.log(`${stateIcon} ${node.id}: ${response.data.state.toUpperCase()} (Term ${response.data.term})`);
            
            if (response.data.state === 'leader') {
                leaderCount++;
                currentLeader = node;
            }
        } catch (error) {
            console.log(`❌ ${node.id}: OFFLINE`);
        }
    }
    
    console.log(`\n📊 Resumen: ${onlineCount}/${NODES.length} nodos online`);
    if (leaderCount === 1) {
        console.log('✅ Cluster saludable - 1 líder detectado');
    } else if (leaderCount === 0) {
        console.log('⚠️ Cluster sin líder - elecciones en progreso');
    } else {
        console.log('🚨 Cluster en estado inconsistente - múltiples líderes');
    }
}

function showMenu() {
    console.log('\n🚀 Distributed KV Store Client');
    console.log('=================================');
    console.log('1. 💾 PUT key-value pair');
    console.log('2. 🔍 GET value by key');
    console.log('3. 📜 Show operation history');
    console.log('4. 🏛️ Show cluster status');
    console.log('5. 🗳️ Force leader election');
    console.log('6. 🚪 Exit');
    console.log('=================================');

    rl.question('Select an option (1-6): ', async (answer) => {
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
                await showClusterStatus();
                showMenu();
                break;
            case '5':
                await forceElection();
                showMenu();
                break;
            case '6':
                console.log('👋 Goodbye!');
                rl.close();
                process.exit(0);
                break;
            default:
                console.log('❌ Invalid option. Please try again.');
                showMenu();
        }
    });
}

async function forceElection() {
    console.log('\n🗳️ Forzando elección en todos los nodos...');
    for (const node of NODES) {
        try {
            await axios.post(`${node.url}/force-election`, { timeout: 3000 });
            console.log(`✅ Elección forzada en ${node.id}`);
        } catch (error) {
            console.log(`❌ Error forzando elección en ${node.id}: ${error.message}`);
        }
    }
    console.log('⏳ Esperando nuevas elecciones...');
    setTimeout(async () => {
        currentLeader = null;
        await findLeader();
    }, 3000);
}

// Start the client
console.log('🚀 Distributed Key-Value Store Client');
console.log('📍 Nodes:', NODES.map(n => `${n.id}(${n.url})`).join(', '));
console.log('🔍 Detectando líder...');

// Initialize leader detection
findLeader().then(() => {
    showMenu();
});
