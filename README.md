# Sistema Distribuido KV Store - Demostración de Linealizabilidad

Este proyecto demuestra la linealizabilidad en un sistema distribuido usando un almacén clave-valor simple con múltiples nodos y una interfaz web.

## Componentes

- **3 Nodos Servidores**: Cada uno ejecutando una instancia del almacén clave-valor
- **Frontend Web**: Interfaz web interactiva para visualizar el sistema distribuido
- **Cliente CLI**: Cliente de línea de comandos para interacción por terminal

## Prerrequisitos

- Docker
- Docker Compose

## Cómo Ejecutar

1. Clona este repositorio
2. Navega al directorio del proyecto
3. Ejecuta el siguiente comando:

```bash
docker-compose up --build
```

4. Abre tu navegador web y ve a:
   - **Interfaz Web**: http://localhost:8080
   - **API Nodo 1**: http://localhost:3000
   - **API Nodo 2**: http://localhost:3001
   - **API Nodo 3**: http://localhost:3002

## Cómo Usar la Interfaz Web

1. **PUT**: Almacena un par clave-valor en el sistema distribuido
   - Ingresa una clave y valor en el panel de control
   - Click en PUT para almacenar el valor
   - La operación se enviará a un nodo aleatorio

2. **GET**: Recupera un valor por clave desde un nodo aleatorio
   - Ingresa la clave que quieres recuperar
   - Click en GET para obtener el valor

3. **Características Visuales**:
   - Estado de nodos en tiempo real (verde = online, rojo = offline)
   - Línea de tiempo de operaciones mostrando el orden de operaciones
   - Animaciones en nodos cuando se realizan operaciones
   - Auto-refresco cada 5 segundos

## Cómo Demuestra la Linealizabilidad

1. Cada operación (PUT/GET) tiene un ID único y timestamp
2. El sistema mantiene un orden total de operaciones a través de todos los nodos
3. La interfaz web muestra cómo las operaciones se ordenan cronológicamente
4. El sistema asegura que si la operación A completa antes de que la B inicie, entonces A aparecerá antes que B en el orden total

## Escenario de Ejemplo

1. Abre http://localhost:8080 en tu navegador
2. Realiza algunas operaciones:
   - PUT nombre "Alice"
   - GET nombre (debería retornar "Alice")
   - PUT nombre "Bob"
   - GET nombre (debería retornar "Bob")
3. Observa la línea de tiempo para ver cómo se ordenan las operaciones en todos los nodos
4. Nota cómo los nodos se iluminan cuando reciben operaciones

## Cliente CLI (Opcional)

Si prefieres usar el cliente de línea de comandos:

```bash
docker exec -it distributed-kv-store-client-1 sh
node client.js
```

## Limpieza

Para detener y remover todos los contenedores:

```bash
docker-compose down
```
