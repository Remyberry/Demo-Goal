# API -> Kafka -> MySQL -> Redis Distributed Demo Link Practice Guide

This project implements a complete end-to-end distributed system link: 
**API → Producer (Redis Lock) → Kafka → Consumer → MySQL → Redis (Mapping)**

## I. Prerequisites
- **Docker Desktop**: Must be installed and running.
- **Node.js (v18+)**: Required for running the Producer and Consumer services.

## II. Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/Remyberry/Demo-Goal.git
cd Demo-Goal
```

### 2. Infrastructure Setup
Run the following in the root directory to start the containers (Kafka, Zookeeper, MySQL, Redis):
```bash
docker-compose up -d
```
*Note: Using bitnamilegacy/kafka:3.4.1 and bitnamilegacy/zookeeper:3.8.1 for Windows compatibility.*

### 3. Service Setup

#### Producer Service
The Producer provides an HTTP API and uses a Redis distributed lock to ensure only one thread sends per `bizKey`.
```bash
# Open a new terminal
cd producer
npm install
npm run dev
```
- **Port**: 3000
- **Endpoint**: `POST /demo/send`

#### Consumer Service
The Consumer subscribes to Kafka, stores records in MySQL (idempotently), and maps the ID in Redis.
```bash
# Open a new terminal
cd consumer
npm install
npm run dev
```

---

## III. API & Validation Examples

### 1. Basic Send 
```bash
curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"order123\", \"payload\": {\"status\": \"test\"}}"
```

### 2. Test Distributed Lock
Run two requests at the **exact same time** (using `&` in CMD/Bash):
```bash
curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"lock-test\"}" & curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"lock-test\"}"
```
- **Expected**: One returns `success: true`, the other returns `error: "Busy..."`.

### 3. Test Idempotency
Send the **exact same** `requestId` twice:
```bash
curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"idem-test\", \"requestId\": \"fixed-uuid-123\"}"
```
- **Expected**: Check the **Consumer Logs**. The second run will show: `Duplicate message detected...`.

---

## IV. Data Verification Commands

### 1. Check MySQL Records
```bash
docker exec -it demo-goal-mysql-1 mysql -u root -prootpassword -e "USE demo_db; SELECT * FROM demo_records;"
```

### 2. Check Redis ID Mapping
Replace `{requestId}` with the one from your API response:
```bash
docker exec -it demo-goal-redis-1 redis-cli GET demo:req:{requestId}
```

## V. Technical Features
- **ESM Support**: Running natively as ECMAScript Modules using `tsx`.
- **Atomic Lock Release**: Uses a Lua script to ensure only the owner of a lock can release it.
- **Reliable Networking**: Configured with `KAFKA_ADVERTISED_LISTENERS` for host-to-container communication.
- **Idempotency**: MySQL unique constraints and Redis mapping prevent duplicate processing.
