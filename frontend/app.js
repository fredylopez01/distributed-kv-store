// Detect if we're running inside Docker or externally
// Si accedemos desde localhost, usar localhost con puertos (para desarrollo local)
// Si accedemos desde IP externa, usar IPs externas (para otros dispositivos)
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';

// Para linealizabilidad, todas las operaciones deben ir al líder (node1)
const NODES = isLocalhost ? [
    { id: 'node1', url: 'http://localhost:3000', port: 3000, isLeader: true },
    { id: 'node2', url: 'http://localhost:3001', port: 3001, isLeader: false },
    { id: 'node3', url: 'http://localhost:3002', port: 3002, isLeader: false }
] : [
    { id: 'node1', url: 'http://192.168.20.150:3000', port: 3000, isLeader: true },
    { id: 'node2', url: 'http://192.168.20.150:3001', port: 3001, isLeader: false },
    { id: 'node3', url: 'http://192.168.20.150:3002', port: 3002, isLeader: false }
];

let operations = [];
let nodeStatuses = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Hostname:', window.location.hostname);
    console.log('isLocalhost:', isLocalhost);
    console.log('NODES:', NODES);
    initializeNodes();
    refreshOperations();
    // Auto-refresh every 5 seconds
    setInterval(refreshOperations, 5000);
});

function initializeNodes() {
    const container = document.getElementById('nodesContainer');
    container.innerHTML = '';
    
    NODES.forEach(node => {
        const nodeCard = document.createElement('div');
        nodeCard.className = 'node-card bg-gray-50 rounded-lg p-4 border-2 border-gray-200';
        nodeCard.id = `node-${node.id}`;
        nodeCard.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <h4 class="font-semibold text-gray-800">${node.id} ${node.isLeader ? '👑' : ''}</h4>
                <div class="w-3 h-3 rounded-full bg-gray-400" id="status-${node.id}"></div>
            </div>
            <p class="text-sm text-gray-600 mb-2">Puerto: ${node.port}</p>
            <p class="text-xs ${node.isLeader ? 'text-purple-600 font-semibold' : 'text-gray-500'}">
                ${node.isLeader ? 'LÍDER' : 'Seguidor'}
            </p>
            <div class="text-xs text-gray-500 mt-2">
                <p>Operaciones: <span id="ops-${node.id}" class="font-semibold">0</span></p>
                <p>Última: <span id="last-${node.id}" class="font-semibold">-</span></p>
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

function updateNodeStatus(nodeId, isOnline, opCount) {
    const statusDot = document.getElementById(`status-${nodeId}`);
    const opsCount = document.getElementById(`ops-${nodeId}`);
    
    if (isOnline) {
        statusDot.className = 'w-3 h-3 rounded-full bg-green-500';
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
    const activeNodes = Object.values(nodeStatuses).filter(status => status).length;
    document.getElementById('activeNodes').textContent = `${activeNodes}/3`;
    document.getElementById('totalOps').textContent = operations.length;
}

async function putValue() {
    const key = document.getElementById('putKey').value.trim();
    const value = document.getElementById('putValue').value.trim();
    
    if (!key || !value) {
        showNotification('Por favor ingrese clave y valor', 'error');
        return;
    }
    
    // Para linealizabilidad, siempre enviar PUT al líder
    const leader = NODES.find(node => node.isLeader);
    try {
        const response = await axios.put(`${leader.url}/${key}`, { value });
        showNotification(`PUT ${key} = ${value} (via ${leader.id} - LÍDER)`, 'success');
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
    
    // Para linealizabilidad, siempre enviar GET al líder
    const leader = NODES.find(node => node.isLeader);
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

function getRandomNode() {
    const onlineNodes = NODES.filter(node => nodeStatuses[node.id]);
    if (onlineNodes.length === 0) {
        showNotification('No hay nodos disponibles', 'error');
        return null;
    }
    return onlineNodes[Math.floor(Math.random() * onlineNodes.length)];
}

async function refreshOperations() {
    const timeline = document.getElementById('operationsTimeline');
    timeline.innerHTML = '<p class="text-gray-500 text-center">Cargando operaciones...</p>';
    
    try {
        const allOperations = [];
        
        for (const node of NODES) {
            try {
                const response = await axios.get(`${node.url}/operations`, { timeout: 2000 });
                const nodeOps = response.data.operations.map(op => ({
                    ...op,
                    nodeId: node.id
                }));
                allOperations.push(...nodeOps);
                updateNodeStatus(node.id, true, nodeOps.length);
            } catch (error) {
                updateNodeStatus(node.id, false, 0);
            }
        }
        
        // Sort operations by timestamp to show linearizability
        operations = allOperations.sort((a, b) => a.timestamp - b.timestamp);
        displayOperations();
    } catch (error) {
        timeline.innerHTML = '<p class="text-red-500 text-center">Error al cargar operaciones</p>';
    }
}

function displayOperations() {
    const timeline = document.getElementById('operationsTimeline');
    
    if (operations.length === 0) {
        timeline.innerHTML = '<p class="text-gray-500 text-center">No hay operaciones registradas</p>';
        return;
    }
    
    timeline.innerHTML = '';
    operations.forEach((op, index) => {
        const opElement = document.createElement('div');
        opElement.className = 'operation-item bg-gray-50 rounded-lg p-3 border-l-4 ' + 
            (op.type === 'put' ? 'border-blue-500' : 'border-green-500');
        
        const time = new Date(op.timestamp).toLocaleTimeString();
        const typeColor = op.type === 'put' ? 'text-blue-600' : 'text-green-600';
        
        opElement.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <span class="text-xs text-gray-500">#${index + 1}</span>
                    <span class="font-semibold ${typeColor}">${op.type.toUpperCase()}</span>
                    <span class="text-gray-700">${op.key} = ${op.value}</span>
                </div>
                <div class="text-xs text-gray-500">
                    <span class="bg-gray-200 px-2 py-1 rounded">${op.nodeId}</span>
                    <span class="ml-2">${time}</span>
                </div>
            </div>
        `;
        timeline.appendChild(opElement);
    });
}

function animateNode(nodeId, operation) {
    const nodeCard = document.getElementById(`node-${nodeId}`);
    if (operation === 'put') {
        nodeCard.classList.add('pulse-blue');
    } else {
        nodeCard.classList.add('pulse-green');
    }
    
    setTimeout(() => {
        nodeCard.classList.remove('pulse-blue', 'pulse-green');
    }, 1000);
}

function clearOperations() {
    if (confirm('¿Está seguro de que desea limpiar todas las operaciones?')) {
        operations = [];
        displayOperations();
        showNotification('Operaciones limpiadas', 'info');
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
