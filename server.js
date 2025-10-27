const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const axios = require('axios');

class KVStore {
    constructor(isLeader = false, nodeUrls = []) {
        this.store = new Map();
        this.operations = [];
        this.isLeader = isLeader;
        this.nodeUrls = nodeUrls;
        this.leaderUrl = null;
        this.isReady = false;
        
        // Si es líder, iniciar elección
        if (isLeader) {
            this.becomeLeader();
        } else {
            // Si es seguidor, encontrar al líder
            this.findLeader();
        }
    }

    async becomeLeader() {
        this.isLeader = true;
        this.leaderUrl = `http://${process.env.NODE_ID || 'node1'}:3000`;
        this.isReady = true;
        console.log(`[${process.env.NODE_ID || 'node-1'}] Soy el líder`);
    }

    async findLeader() {
        // En implementación real, aquí habría un algoritmo de leader election
        // Para simplificar, asumimos que node1 es siempre el líder
        this.leaderUrl = 'http://node1:3000';
        this.isReady = true;
        console.log(`[${process.env.NODE_ID || 'node-1'}] Líder detectado: ${this.leaderUrl}`);
    }

    async put(key, value) {
        if (!this.isReady) {
            throw new Error('Sistema no está listo');
        }

        const operation = {
            id: uuidv4(),
            type: 'put',
            key,
            value,
            timestamp: Date.now(),
            nodeId: process.env.NODE_ID || 'node-1'
        };

        if (this.isLeader) {
            // Líder: replicar a todos los seguidores antes de confirmar
            try {
                await this.replicateToFollowers(operation);
                this.operations.push(operation);
                this.store.set(key, { value, timestamp: operation.timestamp });
                console.log(`[${process.env.NODE_ID || 'node-1'}] PUT ${key} = ${value} (replicado)`);
                return operation;
            } catch (error) {
                console.error(`Error replicando operación: ${error.message}`);
                throw new Error('No se pudo replicar la operación');
            }
        } else {
            // Seguidor: forward al líder
            throw new Error('No soy el líder. Las escrituras deben ir al líder');
        }
    }

    async get(key) {
        if (!this.isReady) {
            throw new Error('Sistema no está listo');
        }

        if (this.isLeader) {
            // Líder: leer localmente
            const item = this.store.get(key);
            const result = item ? { key, value: item.value, timestamp: item.timestamp } : null;
            console.log(`[${process.env.NODE_ID || 'node-1'}] GET ${key} = ${result ? result.value : 'null'} (líder)`);
            return result;
        } else {
            // Seguidor: forward al líder para consistencia linealizable
            try {
                const response = await axios.get(`${this.leaderUrl}/${key}`, { timeout: 2000 });
                console.log(`[${process.env.NODE_ID || 'node-1'}] GET ${key} = ${response.data.value} (forward al líder)`);
                return response.data.error ? null : response.data;
            } catch (error) {
                console.error(`Error forward a líder: ${error.message}`);
                throw new Error('No se pudo contactar al líder');
            }
        }
    }

    async replicateToFollowers(operation) {
        const replicationPromises = this.nodeUrls.map(async (url) => {
            try {
                await axios.post(`${url}/replicate`, operation, { timeout: 2000 });
                console.log(`[${process.env.NODE_ID || 'node-1'}] Replicado a ${url}`);
            } catch (error) {
                console.error(`Error replicando a ${url}: ${error.message}`);
                throw error;
            }
        });

        // Esperar a que todas las réplicas se completen (write quorum)
        await Promise.all(replicationPromises);
    }

    async receiveReplication(operation) {
        this.operations.push(operation);
        this.store.set(operation.key, { value: operation.value, timestamp: operation.timestamp });
        console.log(`[${process.env.NODE_ID || 'node-1'}] Recibida replicación: ${operation.key} = ${operation.value}`);
    }

    getOperations() {
        return this.operations.sort((a, b) => a.timestamp - b.timestamp);
    }
}

const app = express();
const port = process.env.PORT || 3000;
const nodeId = process.env.NODE_ID || 'node-1';

app.use(cors());
app.use(bodyParser.json());

// Configurar nodos para replicación
const isLeader = nodeId === 'node1';
const nodeUrls = nodeId === 'node1' 
    ? ['http://node2:3000', 'http://node3:3000']  // Líder conoce a los seguidores
    : [];  // Seguidores no necesitan conocer a otros nodos

const kvStore = new KVStore(isLeader, nodeUrls);

// PUT endpoint
app.put('/:key', async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    
    try {
        const result = await kvStore.put(key, value);
        res.json(result);
    } catch (error) {
        console.error(`[${nodeId}] Error PUT: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Get all operations (for visualization) - MUST come before /:key
app.get('/operations', (req, res) => {
    res.json({
        nodeId,
        isLeader: kvStore.isLeader,
        operations: kvStore.getOperations()
    });
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        nodeId,
        isLeader: kvStore.isLeader,
        isReady: kvStore.isReady,
        leaderUrl: kvStore.leaderUrl
    });
});

// GET endpoint
app.get('/:key', async (req, res) => {
    const { key } = req.params;
    
    try {
        const result = await kvStore.get(key);
        res.json(result || { error: 'Key not found' });
    } catch (error) {
        console.error(`[${nodeId}] Error GET: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Replication endpoint (solo para seguidores)
app.post('/replicate', async (req, res) => {
    try {
        await kvStore.receiveReplication(req.body);
        res.json({ success: true });
    } catch (error) {
        console.error(`[${nodeId}] Error replicación: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`KV Store ${nodeId} running on port ${port}`);
});
