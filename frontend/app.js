// Detect if we're running inside Docker or externally
// Si accedemos desde localhost, usar localhost con puertos (para desarrollo local)
// Si accedemos desde IP externa, usar IPs externas (para otros dispositivos)
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';

// Para linealizabilidad, todas las operaciones deben ir al líder (dinámico ahora)
const NODES = isLocalhost ? [
    { id: 'node1', url: 'http://localhost:3000', port: 3000, isLeader: false },
    { id: 'node2', url: 'http://localhost:3001', port: 3001, isLeader: false },
    { id: 'node3', url: 'http://localhost:3002', port: 3002, isLeader: false }
] : [
    { id: 'node1', url: 'http://192.168.20.150:3000', port: 3000, isLeader: false },
    { id: 'node2', url: 'http://192.168.20.150:3001', port: 3001, isLeader: false },
    { id: 'node3', url: 'http://192.168.20.150:3002', port: 3002, isLeader: false }
];

let operations = [];
let nodeStatuses = {};
let raftStates = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Hostname:', window.location.hostname);
    console.log('isLocalhost:', isLocalhost);
    console.log('NODES:', NODES);
    initializeNodes();
    refreshOperations();
    refreshRaftStates();
    // Auto-refresh every 3 seconds for better real-time feel
    setInterval(refreshOperations, 3000);
    setInterval(refreshRaftStates, 2000);
});

function initializeNodes() {
    const container = document.getElementById('nodesContainer');
    container.innerHTML = '';
    
    NODES.forEach(node => {
        const nodeCard = document.createElement('div');
        nodeCard.className = 'bg-white rounded-lg shadow-md p-6 border-2 border-gray-200';
        nodeCard.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-gray-800">${node.id}</h3>
                <div class="flex items-center space-x-2">
                    <div id="status-${node.id}" class="w-3 h-3 rounded-full bg-gray-400"></div>
                    <span id="state-${node.id}" class="text-xs font-semibold text-gray-600">UNKNOWN</span>
                </div>
            </div>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                    <span class="text-gray-600">Operaciones:</span>
                    <span id="ops-${node.id}" class="font-semibold">0</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Term:</span>
                    <span id="term-${node.id}" class="font-semibold">0</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Log:</span>
                    <span id="log-${node.id}" class="font-semibold">0</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Última:</span>
                    <span id="last-${node.id}" class="font-semibold">-</span>
                </div>
            </div>
            <div class="mt-4 space-y-2">
                <button onclick="forceElection('${node.id}')" class="w-full bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors">
                    🗳️ Forzar Elección
                </button>
                <button onclick="simulatePartition('${node.id}')" class="w-full bg-orange-500 text-white px-3 py-1 rounded text-xs hover:bg-orange-600 transition-colors">
                    🔌 Simular Partición
                </button>
            </div>
        `;
        container.appendChild(nodeCard);
        checkNodeStatus(node);
    });
}

async function checkNodeStatus(node) {
    try {
        console.log(`Verificando nodo: ${node.id} en ${node.url}`);
        const response = await axios.get(`${node.url}/operations`, { timeout: 5000 });
        console.log(`Respuesta de ${node.id}:`, response.data);
        updateNodeStatus(node.id, true, response.data.operations.length);
    } catch (error) {
        console.error(`Error verificando ${node.id}:`, error.message);
        updateNodeStatus(node.id, false, 0);
    }
}

async function refreshRaftStates() {
    for (const node of NODES) {
        try {
            const response = await axios.get(`${node.url}/raft-state`, { timeout: 3000 });
            updateRaftState(node.id, response.data);
        } catch (error) {
            console.error(`Error obteniendo estado Raft de ${node.id}:`, error.message);
        }
    }
}

function updateRaftState(nodeId, state) {
    raftStates[nodeId] = state;
    
    // Update state display
    const stateElement = document.getElementById(`state-${nodeId}`);
    const statusDot = document.getElementById(`status-${nodeId}`);
    const termElement = document.getElementById(`term-${nodeId}`);
    const logElement = document.getElementById(`log-${nodeId}`);
    
    if (stateElement) {
        let stateText = state.state.toUpperCase();
        let stateColor = 'text-gray-600';
        let dotColor = 'bg-gray-400';
        
        switch (state.state) {
            case 'leader':
                stateText = '👑 LÍDER';
                stateColor = 'text-yellow-600 font-bold';
                dotColor = 'bg-yellow-500';
                break;
            case 'candidate':
                stateText = '🟡 CANDIDATO';
                stateColor = 'text-orange-600 font-semibold';
                dotColor = 'bg-orange-500';
                break;
            case 'follower':
                stateText = '🔵 SEGUIDOR';
                stateColor = 'text-blue-600';
                dotColor = 'bg-blue-500';
                break;
        }
        
        stateElement.textContent = stateText;
        stateElement.className = `text-xs font-semibold ${stateColor}`;
        statusDot.className = `w-3 h-3 rounded-full ${dotColor}`;
    }
    
    if (termElement) termElement.textContent = state.term;
    if (logElement) logElement.textContent = state.log?.length || 0;
    
    // Update node leader status
    const nodeIndex = NODES.findIndex(n => n.id === nodeId);
    if (nodeIndex !== -1) {
        NODES[nodeIndex].isLeader = state.state === 'leader';
    }
}

function updateNodeStatus(nodeId, isOnline, opCount) {
    const statusDot = document.getElementById(`status-${nodeId}`);
    const opsCount = document.getElementById(`ops-${nodeId}`);
    
    if (isOnline) {
        if (!raftStates[nodeId] || raftStates[nodeId].state === 'follower') {
            statusDot.className = 'w-3 h-3 rounded-full bg-blue-500';
        }
        opsCount.textContent = opCount;
        nodeStatuses[nodeId] = true;
    } else {
        statusDot.className = 'w-3 h-3 rounded-full bg-red-500';
        opsCount.textContent = '0';
        nodeStatuses[nodeId] = false;
    }
    
    updateSystemStatus();
}

function updateSystemStatus() {
    const onlineNodes = Object.values(nodeStatuses).filter(status => status).length;
    const totalNodes = NODES.length;
    const leader = NODES.find(node => node.isLeader);
    
    document.getElementById('systemStatus').innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-lg font-semibold">Estado del Sistema</span>
            <span class="text-sm ${onlineNodes === totalNodes ? 'text-green-600' : 'text-orange-600'}">
                ${onlineNodes}/${totalNodes} nodos activos
            </span>
        </div>
        ${leader ? `
            <div class="text-sm text-gray-600 mt-1">
                Líder actual: <span class="font-semibold text-yellow-600">${leader.id} 👑</span>
            </div>
        ` : `
            <div class="text-sm text-red-600 mt-1">
                ⚠️ Sin líder detectado
            </div>
        `}
    `;
}

async function refreshOperations() {
    try {
        const promises = NODES.map(async (node) => {
            try {
                const response = await axios.get(`${node.url}/operations`, { timeout: 3000 });
                return response.data;
            } catch (error) {
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        const allOperations = results
            .filter(result => result && result.operations)
            .flatMap(result => result.operations);
        
        // Sort by timestamp
        operations = allOperations.sort((a, b) => a.timestamp - b.timestamp);
        updateTimeline();
        updateOperationCount();
    } catch (error) {
        console.error('Error refreshing operations:', error);
    }
}

function updateTimeline() {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';
    
    operations.slice(-10).forEach(op => {
        const item = document.createElement('div');
        item.className = 'bg-white rounded p-3 border-l-4 border-blue-500 shadow-sm';
        item.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <span class="font-semibold text-sm">${op.type.toUpperCase()}</span>
                    <span class="text-gray-600 text-sm ml-2">${op.key} = "${op.value}"</span>
                </div>
                <div class="text-xs text-gray-500">
                    <div>${op.nodeId}</div>
                    <div>Term ${op.term || 1}</div>
                </div>
            </div>
            <div class="text-xs text-gray-400 mt-1">
                ${new Date(op.timestamp).toLocaleTimeString()}
            </div>
        `;
        timeline.appendChild(item);
    });
}

function updateOperationCount() {
    document.getElementById('operationCount').textContent = operations.length;
}

async function putValue() {
    const key = document.getElementById('putKey').value.trim();
    const value = document.getElementById('putValue').value.trim();
    
    if (!key || !value) {
        showNotification('Por favor ingrese clave y valor', 'error');
        return;
    }
    
    // Encontrar al líder dinámicamente
    const leader = NODES.find(node => node.isLeader);
    if (!leader) {
        showNotification('No hay líder disponible. Esperando elección...', 'warning');
        return;
    }
    
    try {
        const response = await axios.put(`${leader.url}/${key}`, { value });
        showNotification(`PUT ${key} = ${value} (via ${leader.id} - LÍDER, Term ${response.data.term})`, 'success');
        animateNode(leader.id, 'put');
        document.getElementById('putKey').value = '';
        document.getElementById('putValue').value = '';
        setTimeout(refreshOperations, 500);
    } catch (error) {
        showNotification(`Error en ${leader.id}: ${error.message}`, 'error');
    }
}

async function getValue() {
    const key = document.getElementById('getKey').value.trim();
    
    if (!key) {
        showNotification('Por favor ingrese una clave', 'error');
        return;
    }
    
    // Encontrar al líder dinámicamente
    const leader = NODES.find(node => node.isLeader);
    if (!leader) {
        showNotification('No hay líder disponible. Esperando elección...', 'warning');
        return;
    }
    
    try {
        const response = await axios.get(`${leader.url}/${key}`);
        if (response.data.value) {
            showNotification(`GET ${key} = ${response.data.value} (via ${leader.id} - LÍDER)`, 'success');
            animateNode(leader.id, 'get');
            document.getElementById('getKey').value = '';
        } else if (response.data.error) {
            showNotification(`Clave "${key}" no encontrada`, 'warning');
        } else {
            showNotification(`Clave "${key}" no encontrada`, 'warning');
        }
    } catch (error) {
        showNotification(`Error en ${leader.id}: ${error.message}`, 'error');
    }
}

async function forceElection(nodeId) {
    try {
        const node = NODES.find(n => n.id === nodeId);
        await axios.post(`${node.url}/force-election`);
        showNotification(`🗳️ Elección forzada en ${nodeId}`, 'info');
        setTimeout(refreshRaftStates, 1000);
    } catch (error) {
        showNotification(`Error forzando elección en ${nodeId}: ${error.message}`, 'error');
    }
}

async function simulatePartition(nodeId) {
    try {
        const node = NODES.find(n => n.id === nodeId);
        await axios.post(`${node.url}/simulate-partition`, { partitioned: true });
        showNotification(`🔌 Partición simulada en ${nodeId}`, 'warning');
        setTimeout(refreshRaftStates, 1000);
    } catch (error) {
        showNotification(`Error simulando partición en ${nodeId}: ${error.message}`, 'error');
    }
}

function animateNode(nodeId, operation) {
    const nodeCard = document.querySelector(`#nodesContainer > div:nth-child(${NODES.findIndex(n => n.id === nodeId) + 1})`);
    if (nodeCard) {
        nodeCard.classList.add(operation === 'put' ? 'border-green-500' : 'border-blue-500');
        setTimeout(() => {
            nodeCard.classList.remove('border-green-500', 'border-blue-500');
        }, 1000);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 
                   type === 'error' ? 'bg-red-500' : 
                   type === 'warning' ? 'bg-orange-500' : 'bg-blue-500';
    
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
