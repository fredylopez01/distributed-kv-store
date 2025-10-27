// Configuración de nodos - usar proxy a través del frontend
const NODES = [
    { id: 'node1', url: 'http://localhost:8080/api/node1', port: 3000, isLeader: false },
    { id: 'node2', url: 'http://localhost:8080/api/node2', port: 3001, isLeader: false },
    { id: 'node3', url: 'http://localhost:8080/api/node3', port: 3002, isLeader: false }
];

let operations = [];
let nodeStatuses = {};
let raftStates = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Hostname:', window.location.hostname);
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
        console.log(`[FRONTEND] Verificando nodo: ${node.id} en ${node.url}`);
        const response = await axios.get(`${node.url}/operations`, { timeout: 5000 });
        console.log(`[FRONTEND] ✅ Respuesta de ${node.id}:`, response.data);
        // response.data es un array directamente
        const operationCount = Array.isArray(response.data) ? response.data.length : 0;
        updateNodeStatus(node.id, true, operationCount);
    } catch (error) {
        console.error(`[FRONTEND] ❌ Error verificando ${node.id}:`, error.message);
        console.error(`[FRONTEND] Error completo:`, error);
        updateNodeStatus(node.id, false, 0);
    }
}

async function refreshRaftStates() {
    console.log('[FRONTEND] 🔄 Actualizando estados Raft...');
    for (const node of NODES) {
        try {
            console.log(`[FRONTEND] Verificando estado Raft de ${node.id} en ${node.url}`);
            const response = await axios.get(`${node.url}/raft-state`, { timeout: 3000 });
            console.log(`[FRONTEND] ✅ Estado Raft de ${node.id}:`, response.data);
            updateRaftState(node.id, response.data);
            // Mark node as online when we get a response
            nodeStatuses[node.id] = true;
        } catch (error) {
            console.error(`[FRONTEND] ❌ Error obteniendo estado Raft de ${node.id}:`, error.message);
            // Mark node as offline if we can't reach it
            nodeStatuses[node.id] = false;
        }
    }
    // Update system status after all nodes have been checked
    updateSystemStatus();
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
    
    // Update the active nodes count
    const activeNodesElement = document.getElementById('activeNodes');
    if (activeNodesElement) {
        activeNodesElement.textContent = `${onlineNodes}/${totalNodes}`;
        activeNodesElement.className = `font-semibold ${onlineNodes === totalNodes ? 'text-green-600' : 'text-orange-600'}`;
    }
    
    // Update the total operations count
    const totalOpsElement = document.getElementById('totalOps');
    if (totalOpsElement) {
        totalOpsElement.textContent = operations.length;
    }
    
    // Add leader info if exists
    const systemStatusDiv = document.getElementById('systemStatus');
    if (systemStatusDiv && leader) {
        // Remove existing leader info if any
        const existingLeaderInfo = systemStatusDiv.querySelector('.leader-info');
        if (existingLeaderInfo) {
            existingLeaderInfo.remove();
        }
        
        // Add leader info
        const leaderInfo = document.createElement('p');
        leaderInfo.className = 'leader-info text-sm text-gray-600';
        leaderInfo.innerHTML = `Líder actual: <span class="font-semibold text-yellow-600">${leader.id} 👑</span>`;
        systemStatusDiv.appendChild(leaderInfo);
    }
}

async function refreshOperations() {
    try {
        const promises = NODES.map(async (node) => {
            try {
                const response = await axios.get(`${node.url}/operations`, { timeout: 3000 });
                return { nodeId: node.id, operations: response.data };
            } catch (error) {
                console.error(`Error obteniendo operaciones de ${node.id}:`, error.message);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        const allOperations = results
            .filter(result => result && result.operations)
            .flatMap(result => 
                result.operations.map(op => ({ ...op, nodeId: result.nodeId }))
            );
        
        // Sort by timestamp
        operations = allOperations.sort((a, b) => a.timestamp - b.timestamp);
        console.log('Operaciones cargadas:', operations.length);
        updateTimeline();
        updateOperationCount();
    } catch (error) {
        console.error('Error refreshing operations:', error);
    }
}

function updateTimeline() {
    const timeline = document.getElementById('operationsTimeline');
    if (!timeline) {
        console.error('[FRONTEND] ❌ Elemento operationsTimeline no encontrado');
        return;
    }
    
    timeline.innerHTML = '';
    
    if (operations.length === 0) {
        timeline.innerHTML = '<p class="text-gray-500 text-center">No hay operaciones registradas</p>';
        return;
    }
    
    operations.slice(-10).reverse().forEach(op => {
        const item = document.createElement('div');
        item.className = 'bg-white rounded p-3 border-l-4 border-blue-500 shadow-sm operation-item';
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
    document.getElementById('totalOps').textContent = operations.length;
}

function clearOperations() {
    operations = [];
    updateTimeline();
    updateOperationCount();
    showNotification('Operaciones limpiadas', 'info');
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
    const selectedNodeId = document.getElementById('getNode').value;
    
    if (!key) {
        showNotification('Por favor ingrese una clave', 'error');
        return;
    }
    
    // Si se selecciona un nodo específico, usarlo; si no, usar el líder
    let targetNode;
    if (selectedNodeId) {
        targetNode = NODES.find(node => node.id === selectedNodeId);
        if (!targetNode) {
            showNotification('Nodo no encontrado', 'error');
            return;
        }
    } else {
        targetNode = NODES.find(node => node.isLeader);
        if (!targetNode) {
            showNotification('No hay líder disponible. Esperando elección...', 'warning');
            return;
        }
    }
    
    try {
        const response = await axios.get(`${targetNode.url}/${key}`);
        if (response.data.value) {
            const nodeType = targetNode.isLeader ? 'LÍDER' : 'SEGUIDOR';
            showNotification(`GET ${key} = ${response.data.value} (via ${targetNode.id} - ${nodeType})`, 'success');
            animateNode(targetNode.id, 'get');
            document.getElementById('getKey').value = '';
        } else if (response.data.error) {
            showNotification(`Clave "${key}" no encontrada en ${targetNode.id}`, 'warning');
        } else {
            showNotification(`Clave "${key}" no encontrada en ${targetNode.id}`, 'warning');
        }
    } catch (error) {
        showNotification(`Error en ${targetNode.id}: ${error.message}`, 'error');
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

// Track partition state
let partitionedNodes = new Set();

async function simulatePartition(nodeId) {
    try {
        console.log(`[FRONTEND] Simulando partición en ${nodeId}`);
        const node = NODES.find(n => n.id === nodeId);
        if (!node) {
            showNotification(`Nodo ${nodeId} no encontrado`, 'error');
            return;
        }
        
        const isCurrentlyPartitioned = partitionedNodes.has(nodeId);
        console.log(`[FRONTEND] Estado actual de ${nodeId}: ${isCurrentlyPartitioned ? 'particionado' : 'conectado'}`);
        
        // Toggle partition state
        if (isCurrentlyPartitioned) {
            // Remove partition
            console.log(`[FRONTEND] Restaurando ${nodeId}...`);
            await axios.post(`${node.url}/simulate-partition`, { partitioned: false });
            partitionedNodes.delete(nodeId);
            showNotification(`✅ Nodo ${nodeId} restaurado al cluster`, 'success');
        } else {
            // Add partition
            console.log(`[FRONTEND] Aislando ${nodeId}...`);
            await axios.post(`${node.url}/simulate-partition`, { partitioned: true });
            partitionedNodes.add(nodeId);
            showNotification(`🔌 Nodo ${nodeId} aislado del cluster (partición simulada)`, 'warning');
        }
        
        console.log(`[FRONTEND] Partición simulada exitosamente en ${nodeId}`);
        console.log(`[FRONTEND] Nodos particionados:`, Array.from(partitionedNodes));
        
        // Update button text and style
        updatePartitionButton(nodeId, !isCurrentlyPartitioned);
        
        setTimeout(refreshRaftStates, 1000);
    } catch (error) {
        console.error(`[FRONTEND] Error simulando partición en ${nodeId}:`, error);
        showNotification(`Error simulando partición en ${nodeId}: ${error.message}`, 'error');
    }
}

function updatePartitionButton(nodeId, isPartitioned) {
    console.log(`[FRONTEND] Actualizando botón de ${nodeId}, particionado: ${isPartitioned}`);
    // Find the button for this node
    const nodeIndex = NODES.findIndex(n => n.id === nodeId);
    const nodeCard = document.querySelector(`#nodesContainer > div:nth-child(${nodeIndex + 1})`);
    if (nodeCard) {
        const button = nodeCard.querySelector('button[onclick*="simulatePartition"]');
        if (button) {
            if (isPartitioned) {
                button.textContent = '🔌 Restaurar Nodo';
                button.className = 'w-full bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600 transition-colors';
            } else {
                button.textContent = '🔌 Simular Partición';
                button.className = 'w-full bg-orange-500 text-white px-3 py-1 rounded text-xs hover:bg-orange-600 transition-colors';
            }
            console.log(`[FRONTEND] Botón actualizado para ${nodeId}`);
        } else {
            console.error(`[FRONTEND] Botón de partición no encontrado para ${nodeId}`);
        }
    } else {
        console.error(`[FRONTEND] Tarjeta de nodo no encontrada para ${nodeId}`);
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
