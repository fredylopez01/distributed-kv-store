# Sistema Distribuido KV Store - Demostración de Linealizabilidad

🎓 **Proyecto educativo para demostrar linealizabilidad en sistemas distribuidos**

Este proyecto implementa un almacén clave-valor distribuido con **consistencia linealizable**, diseñado específicamente para fines educativos. Permite visualizar en tiempo real cómo las operaciones se ordenan y replican a través de múltiples nodos.

## 🏗️ Arquitectura

### **Componentes Principales**
- **👑 Node1 (Líder)**: Coordina todas las operaciones de escritura
- **📡 Node2 & Node3 (Seguidores)**: Replican datos y hacen forward de lecturas
- **🌐 Frontend Web**: Interfaz interactiva para visualización en tiempo real
- **💻 Cliente CLI**: Herramienta de línea de comandos para testing

### **Características de Linealizabilidad**
✅ **Orden Total**: Todas las operaciones tienen un orden consistente  
✅ **Consistencia Fuerte**: Las lecturas siempre devuelven valores recientes  
✅ **Replicación Síncrona**: Las escrituras se replican antes de confirmarse  
✅ **Transparencia**: Los clientes no necesitan conocer la topología  

## 🚀 Quick Start

### **Prerrequisitos**
- Docker Desktop
- Docker Compose

### **Ejecución**
```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/distributed-kv-store-linealizability.git
cd distributed-kv-store-linealizability

# Iniciar el sistema
docker-compose up --build -d
```

### **Acceso**
- **🖥️ Interfaz Web (local)**: http://localhost:8080
- **📱 Interfaz Web (red)**: http://TU_IP_LOCAL:8080
- **🔧 APIs**: http://localhost:3000, http://localhost:3001, http://localhost:3002

## 🎮 Uso de la Interfaz Web

### **Operaciones Básicas**
1. **PUT**: Almacena clave-valor con replicación síncrona
   - Todas las escrituras van al líder (Node1 👑)
   - Se replica a seguidores antes de confirmar

2. **GET**: Recupera valores con consistencia fuerte
   - Las lecturas siempre van al líder
   - Los seguidores hacen forward automáticamente

### **Visualización**
- 🟢 **Nodos Activos**: Estado en tiempo real de cada nodo
- ⏱️ **Timeline**: Orden total de operaciones con timestamps
- 🎬 **Animaciones**: Feedback visual de operaciones
- 📊 **Estadísticas**: Contador de operaciones por nodo

## 🎓 Guía Educativa

### **Demostración Paso a Paso**

#### **1. Introducción (2 min)**
> "Este sistema demuestra **linealizabilidad** - la garantía de consistencia más fuerte en sistemas distribuidos. Node1 es el líder 👑, Node2 y Node3 son seguidores."

#### **2. Operación PUT (3 min)**
```bash
# Ejemplo: Sistema bancario
PUT saldo_cuenta_123 = 1000
PUT saldo_cuenta_123 = 1500
```
- ✅ Operaciones van al líder
- ✅ Replicación síncrona a seguidores
- ✅ Timeline muestra orden total

#### **3. Operación GET (2 min)**
```bash
GET saldo_cuenta_123  # Siempre devuelve 1500
```
- ✅ Lecturas desde el líder
- ✅ Consistencia fuerte garantizada

#### **4. Escenarios Interactivos**
- **Red Social**: Posts, likes, comentarios
- **Sistema de E-commerce**: Inventario, precios
- **Banco Digital**: Transferencias, saldos

### **Puntos Clave para Explicar**

🔍 **Replicación Síncrona**
> "Cada PUT se replica a Node2 y Node3 antes de confirmarse. Esto previene pérdida de datos si el líder falla."

🔍 **Líder Único**
> "Solo Node1 procesa escrituras. Esto evita conflictos y garantiza orden total."

🔍 **Forward Automático**
> "Si intentas leer de Node2, automáticamente se reenvía al líder para consistencia."

## 🌐 Acceso Multi-Dispositivo

### **Para Participación Estudiantil**
1. **Obtener IP local**:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

2. **Acceso desde otros dispositivos**:
- Escanear QR o ir a `http://TU_IP_LOCAL:8080`
- Los estudiantes pueden hacer operaciones en tiempo real
- Todos ven la misma timeline sincronizada

## 🔧 Desarrollo y Testing

### **Cliente CLI**
```bash
# Acceder al cliente
docker exec -it distributed-kv-store-client-1 sh
node client.js

# Ejemplos de uso
PUT nombre "Alice"
GET nombre
PUT edad "25"
GET edad
```

### **API Endpoints**
```bash
# PUT operation
curl -X PUT -H "Content-Type: application/json" \
  -d '{"value":"test"}' http://localhost:3000/mi-clave

# GET operation  
curl http://localhost:3000/mi-clave

# Ver operaciones
curl http://localhost:3000/operations

# Estado del nodo
curl http://localhost:3000/status
```

### **Logs y Debugging**
```bash
# Ver logs de cada nodo
docker logs distributed-kv-store-node1-1  # Líder
docker logs distributed-kv-store-node2-1  # Seguidor
docker logs distributed-kv-store-node3-1  # Seguidor

# Ver logs del frontend
docker logs distributed-kv-store-frontend-1
```

## 🏛️ Conceptos Teóricos

### **Linealizabilidad vs Otras Consistencias**

| Consistencia | Orden Total | Lecturas Recientes | Performance |
|-------------|-------------|-------------------|-------------|
| **Linealizable** | ✅ Sí | ✅ Siempre | 🐌 Más lenta |
| Secuencial | ✅ Sí | ❌ No siempre | 🚀 Rápida |
| Eventual | ❌ No | ❌ No siempre | ⚡ Más rápida |

### **Casos de Uso Reales**
- **💰 Sistemas Bancarios**: Transacciones financieras
- **🛒 E-commerce**: Inventario y precios
- **📱 Redes Sociales**: Posts y perfiles
- **🏥 Sistemas Médicos**: Registros de pacientes

## 🛠️ Arquitectura Técnica

### **Stack Tecnológico**
- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Comunicación**: HTTP + Axios
- **Containerización**: Docker + Docker Compose
- **Red**: Docker Networks con mapeo de puertos

### **Patrones Implementados**
- **Leader Election**: Node1 como líder estático
- **Replication**: Síncrona con write quorum
- **Forwarding**: Seguidores reenvían lecturas al líder
- **Heartbeat**: Detección de nodos caídos

## 🧪 Testing y Validación

### **Escenarios de Prueba**
1. **Operaciones Concurrentes**: Múltiples clientes escribiendo
2. **Fall del Líder**: Simular caída de Node1
3. **Partición de Red**: Desconectar nodos temporalmente
4. **Consistencia**: Verificar que todas las lecturas sean recientes

### **Métricas Importantes**
- **Latencia de PUT**: Tiempo de replicación síncrona
- **Latencia de GET**: Tiempo de respuesta del líder
- **Throughput**: Operaciones por segundo
- **Disponibilidad**: Porcentaje de tiempo online

## 📝 Licencia y Contribuciones

### **Uso Educativo**
Este proyecto está diseñado para fines educativos. Siéntete libre de:
- 🎓 Usarlo en tus clases
- 🔄 Modificarlo para experimentos
- 📚 Compartirlo con estudiantes

### **Mejoras Posibles**
- [ ] Leader election dinámico (Raft/Paxos)
- [ ] Persistencia con base de datos
- [ ] Métricas y monitoring avanzado
- [ ] Tests automatizados
- [ ] Documentación API con Swagger

## 🧹 Limpieza

```bash
# Detener y remover contenedores
docker-compose down

# Remover imágenes (opcional)
docker-compose down --rmi all

# Limpiar completamente
docker system prune -f
```

---

## 📞 Soporte

¿Problemas o preguntas?
- 🐛 **Issues**: Reporta bugs en GitHub
- 💡 **Sugerencias**: Abre un issue con etiqueta "enhancement"
- 📧 **Contacto**: [tu-email@ejemplo.com]

---

**🎓 Hecho con ❤️ para la educación en sistemas distribuidos**
