# API -> Kafka -> MySQL -> Redis Distributed Demo Link Practice Guide

This project implements a complete end-to-end distributed system link: 
**API → Producer (Redis Lock) → Kafka → Consumer → MySQL → Redis (Mapping)**

## I. Prerequisites
- **Docker Desktop**: Must be running on Windows.
- **Node.js (v18+)**: Required for running the Producer and Consumer services.

## II. Infrastructure Setup
Run the following in the root directory to start the containers (Kafka, Zookeeper, MySQL, Redis):
```cmd
docker-compose up -d
```
*Note: Using bitnamilegacy/kafka:3.4.1 and bitnamilegacy/zookeeper:3.8.1 for Windows compatibility.*

## III. Service Setup

### 1. Producer Service
The Producer provides an HTTP API and uses a Redis distributed lock to ensure only one thread sends per `bizKey`.
```cmd
cd producer
npm install
npm run dev
```
- **Port**: 3000
- **Endpoint**: `POST /demo/send`

### 2. Consumer Service
The Consumer subscribes to Kafka, stores records in MySQL (idempotently), and maps the ID in Redis.
```cmd
cd consumer
npm install
npm run dev
```

---

## IV. API & Validation Examples (Windows CMD)

### 1. Basic Send 
```cmd
curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"order123\", \"payload\": {\"item\": \"laptop\", \"price\": 999}}"
```

### 2. Test Distributed Lock
Run two requests at the **exact same time** using the `&` operator:
```cmd
curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"lock-test\"}" & curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"lock-test\"}"
```
- **Success**: One returns `{"success":true,...}`, the other returns `{"error":"Busy..."}`.

### 3. Test Idempotency
Send the **exact same** `requestId` twice:
```cmd
curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"idem-test\", \"requestId\": \"fixed-uuid-123\"}"
```
- **Success**: Check the **Consumer Logs**. The second run will show: `Duplicate message detected, querying existing record...`.

---

## V. Data Verification Commands

### 1. Check MySQL Records
```cmd
docker exec -it demo-goal-mysql-1 mysql -u root -prootpassword -e "USE demo_db; SELECT * FROM demo_records;"
```

### 2. Check Redis ID Mapping
Replace `{requestId}` with the one from your API response:
```cmd
docker exec -it demo-goal-redis-1 redis-cli GET demo:req:{requestId}
```

## VI. Technical Features
- **ESM Support**: Running natively as ECMAScript Modules using `tsx`.
- **Atomic Lock Release**: Uses a Lua script to ensure only the owner of a lock can release it.
- **Reliable Networking**: Configured with `KAFKA_ADVERTISED_LISTENERS` for host-to-container communication.
- **Graceful Payloads**: Handles missing or empty JSON payloads safely.
