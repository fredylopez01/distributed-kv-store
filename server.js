const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class RaftNode {
    constructor(nodeId, allNodes) {
        this.nodeId = nodeId;
        this.allNodes = allNodes; // [{id: 'node1', url: 'http://node1:3000'}, ...]
        this.currentTerm = 0;
        this.votedFor = null;
        this.state = 'follower'; // follower, candidate, leader
        this.leaderUrl = null;
        this.heartbeatInterval = null;
        this.electionTimeout = null;
        this.log = [];
        this.commitIndex = 0;
        this.lastApplied = 0;
        
        // KV Store data
        this.store = new Map();
        this.operations = [];
        this.isReady = false;
        
        // Start as follower
        this.becomeFollower();
        this.startElectionTimeout();
    }

    becomeFollower(term = this.currentTerm) {
        this.state = 'follower';
        this.currentTerm = term;
        this.votedFor = null;
        this.leaderUrl = null;
        this.clearHeartbeat();
        this.startElectionTimeout();
        console.log(`[${this.nodeId}] 🔵 Became FOLLOWER in term ${term}`);
    }

    becomeCandidate() {
        this.state = 'candidate';
        this.currentTerm++;
        this.votedFor = this.nodeId;
        this.leaderUrl = null;
        console.log(`[${this.nodeId}] 🟡 Became CANDIDATE in term ${this.currentTerm}`);
        
        // Start election
        this.startElection();
    }

    becomeLeader() {
        this.state = 'leader';
        this.leaderUrl = this.getNodeUrl(this.nodeId);
        this.clearElectionTimeout();
        this.startHeartbeat();
        console.log(`[${this.nodeId}] 👑 Became LEADER in term ${this.currentTerm}`);
        
        // Initialize log as leader
        this.log = [{
            term: this.currentTerm,
            index: 1,
            operation: null
        }];
    }

    getNodeUrl(nodeId) {
        const node = this.allNodes.find(n => n.id === nodeId);
        return node ? node.url : null;
    }

    startElectionTimeout() {
        this.clearElectionTimeout();
        const timeout = Math.random() * 3000 + 2000; // 2-5 seconds
        
        this.electionTimeout = setTimeout(() => {
            console.log(`[${this.nodeId}] ⏰ Election timeout, starting election`);
            this.becomeCandidate();
        }, timeout);
    }

    clearElectionTimeout() {
        if (this.electionTimeout) {
            clearTimeout(this.electionTimeout);
            this.electionTimeout = null;
        }
    }

    clearHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    async startElection() {
        const votes = await this.requestVotes();
        
        if (this.state === 'candidate') {
            const totalNodes = this.allNodes.length;
            const majority = Math.floor(totalNodes / 2) + 1;
            
            if (votes >= majority) {
                this.becomeLeader();
                this.isReady = true;
            } else {
                console.log(`[${this.nodeId}] ❌ Lost election with ${votes}/${totalNodes} votes`);
                this.becomeFollower();
            }
        }
    }

    async requestVotes() {
        const promises = this.allNodes
            .filter(node => node.id !== this.nodeId)
            .map(async (node) => {
                try {
                    const response = await axios.post(`${node.url}/vote`, {
                        term: this.currentTerm,
                        candidateId: this.nodeId
                    }, { timeout: 1000 });
                    
                    return response.data.voteGranted ? 1 : 0;
                } catch (error) {
                    console.log(`[${this.nodeId}] ❌ Failed to request vote from ${node.id}`);
                    return 0;
                }
            });
        
        const results = await Promise.all(promises);
        return results.reduce((sum, votes) => sum + votes, 0) + 1; // +1 for self vote
    }

    startHeartbeat() {
        this.clearHeartbeat();
        this.heartbeatInterval = setInterval(async () => {
            if (this.state === 'leader') {
                await this.sendHeartbeat();
            }
        }, 1000); // Send heartbeat every second
    }

    async sendHeartbeat() {
        const promises = this.allNodes
            .filter(node => node.id !== this.nodeId)
            .map(async (node) => {
                try {
                    await axios.post(`${node.url}/heartbeat`, {
                        term: this.currentTerm,
                        leaderId: this.nodeId
                    }, { timeout: 500 });
                } catch (error) {
                    console.log(`[${this.nodeId}] ❌ Failed to send heartbeat to ${node.id}`);
                }
            });
        
        await Promise.all(promises);
    }

    async handleVoteRequest(term, candidateId) {
        if (term > this.currentTerm) {
            this.becomeFollower(term);
        }
        
        const canVote = this.votedFor === null || this.votedFor === candidateId;
        
        if (canVote && term === this.currentTerm) {
            this.votedFor = candidateId;
            console.log(`[${this.nodeId}] ✅ Voted for ${candidateId} in term ${term}`);
            return { term: this.currentTerm, voteGranted: true };
        }
        
        return { term: this.currentTerm, voteGranted: false };
    }

    async handleHeartbeat(term, leaderId) {
        if (term > this.currentTerm) {
            this.becomeFollower(term);
        }
        
        if (this.state === 'follower' && term === this.currentTerm) {
            this.leaderUrl = this.getNodeUrl(leaderId);
            this.isReady = true;
            this.startElectionTimeout(); // Reset election timeout
            console.log(`[${this.nodeId}] 💓 Received heartbeat from ${leaderId}`);
        }
        
        return { term: this.currentTerm, success: true };
    }

    async put(key, value) {
        if (!this.isReady) {
            throw new Error('Sistema no está listo');
        }

        if (this.state !== 'leader') {
            throw new Error('No soy el líder. Las escrituras deben ir al líder');
        }

        const operation = {
            id: uuidv4(),
            type: 'put',
            key,
            value,
            timestamp: Date.now(),
            nodeId: this.nodeId,
            term: this.currentTerm
        };

        try {
            // Add to log
            const logIndex = this.log.length + 1;
            this.log.push({
                term: this.currentTerm,
                index: logIndex,
                operation: operation
            });

            // Replicate to followers
            await this.replicateToFollowers(operation);
            
            // Apply to store
            this.operations.push(operation);
            this.store.set(key, { value, timestamp: operation.timestamp });
            this.commitIndex = logIndex;
            
            console.log(`[${this.nodeId}] PUT ${key} = ${value} (replicado, term ${this.currentTerm})`);
            return operation;
        } catch (error) {
            console.error(`Error replicando operación: ${error.message}`);
            throw new Error('No se pudo replicar la operación');
        }
    }

    async get(key) {
        if (!this.isReady) {
            throw new Error('Sistema no está listo');
        }

        if (this.state === 'leader') {
            // Leader reads locally
            const item = this.store.get(key);
            const result = item ? { key, value: item.value, timestamp: item.timestamp } : null;
            console.log(`[${this.nodeId}] GET ${key} = ${result ? result.value : 'null'} (líder)`);
            return result;
        } else {
            // Follower forwards to leader
            if (!this.leaderUrl) {
                throw new Error('No hay líder disponible');
            }
            
            try {
                const response = await axios.get(`${this.leaderUrl}/${key}`, { timeout: 2000 });
                console.log(`[${this.nodeId}] GET ${key} = ${response.data.value} (forward al líder)`);
                return response.data.error ? null : response.data;
            } catch (error) {
                console.error(`Error forward a líder: ${error.message}`);
                throw new Error('No se pudo contactar al líder');
            }
        }
    }

    async replicateToFollowers(operation) {
        const promises = this.allNodes
            .filter(node => node.id !== this.nodeId)
            .map(async (node) => {
                try {
                    await axios.post(`${node.url}/replicate`, operation, { timeout: 2000 });
                    console.log(`[${this.nodeId}] Replicado a ${node.id}`);
                } catch (error) {
                    console.error(`Error replicando a ${node.id}: ${error.message}`);
                    throw error;
                }
            });

        await Promise.all(promises);
    }

    async receiveReplication(operation) {
        this.operations.push(operation);
        this.store.set(operation.key, { value: operation.value, timestamp: operation.timestamp });
        console.log(`[${this.nodeId}] Recibida replicación: ${operation.key} = ${operation.value}`);
    }

    getOperations() {
        return this.operations.sort((a, b) => a.timestamp - b.timestamp);
    }

    getStatus() {
        return {
            nodeId: this.nodeId,
            state: this.state,
            term: this.currentTerm,
            isLeader: this.state === 'leader',
            isReady: this.isReady,
            leaderUrl: this.leaderUrl,
            votedFor: this.votedFor,
            logLength: this.log.length,
            commitIndex: this.commitIndex
        };
    }
}

const app = express();
const port = process.env.PORT || 3000;
const nodeId = process.env.NODE_ID || 'node1';

app.use(cors());
app.use(bodyParser.json());

// Configurar todos los nodos del cluster
const allNodes = [
    { id: 'node1', url: 'http://node1:3000' },
    { id: 'node2', url: 'http://node2:3000' },
    { id: 'node3', url: 'http://node3:3000' }
];

// Inicializar nodo Raft
const raftNode = new RaftNode(nodeId, allNodes);

// PUT endpoint
app.put('/:key', async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    
    try {
        const result = await raftNode.put(key, value);
        res.json(result);
    } catch (error) {
        console.error(`[${nodeId}] Error PUT: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Raft endpoints
app.post('/vote', async (req, res) => {
    try {
        const { term, candidateId } = req.body;
        const result = await raftNode.handleVoteRequest(term, candidateId);
        res.json(result);
    } catch (error) {
        console.error(`[${nodeId}] Error vote: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.post('/heartbeat', async (req, res) => {
    try {
        const { term, leaderId } = req.body;
        const result = await raftNode.handleHeartbeat(term, leaderId);
        res.json(result);
    } catch (error) {
        console.error(`[${nodeId}] Error heartbeat: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.post('/replicate', async (req, res) => {
    try {
        const operation = req.body;
        await raftNode.receiveReplication(operation);
        res.json({ success: true });
    } catch (error) {
        console.error(`[${nodeId}] Error replicate: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.get('/operations', (req, res) => {
    res.json(raftNode.operations);
});

app.get('/status', (req, res) => {
    res.json({
        nodeId: raftNode.nodeId,
        state: raftNode.state,
        term: raftNode.currentTerm,
        leaderUrl: raftNode.leaderUrl,
        isReady: raftNode.isReady
    });
});

app.get('/raft-state', (req, res) => {
    res.json({
        nodeId: raftNode.nodeId,
        state: raftNode.state,
        term: raftNode.currentTerm,
        votedFor: raftNode.votedFor,
        leaderUrl: raftNode.leaderUrl,
        isReady: raftNode.isReady,
        log: raftNode.log,
        commitIndex: raftNode.commitIndex,
        lastApplied: raftNode.lastApplied
    });
});

// Force election endpoint (for testing)
app.post('/force-election', async (req, res) => {
    try {
        raftNode.becomeCandidate();
        res.json({ success: true, message: 'Election started' });
    } catch (error) {
        console.error(`[${nodeId}] Error force election: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Simulate partition endpoint (for testing)
app.post('/simulate-partition', (req, res) => {
    try {
        const { partitioned } = req.body;
        raftNode.isPartitioned = partitioned;
        console.log(`[${nodeId}] 🔌 Partition simulation: ${partitioned ? 'ENABLED' : 'DISABLED'}`);
        res.json({ success: true, partitioned });
    } catch (error) {
        console.error(`[${nodeId}] Error simulate partition: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// GET endpoint (generic KV store - must be last)
app.get('/:key', async (req, res) => {
    const { key } = req.params;
    
    try {
        const result = await raftNode.get(key);
        res.json(result || { error: 'Key not found' });
    } catch (error) {
        console.error(`[${nodeId}] Error GET: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});


app.listen(port, () => {
    console.log(`Raft KV Store ${nodeId} running on port ${port}`);
});
