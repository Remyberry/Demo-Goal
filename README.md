# API -> Kafka -> MySQL -> Redis Distributed Demo Link Practice Guide

This project implements a complete end-to-end distributed system link: 
**API → Producer (Redis Lock) → Kafka → Consumer → MySQL → Redis (Mapping)**

## I. Prerequisites
- **Docker Desktop**: Must be installed and running.

## II. Quick Start (Full Docker Setup)

### 1. Clone the repository
```bash
git clone <your-repository-url>
cd Demo-Goal
```

### 2. Start Everything
This will start the infrastructure (Kafka, MySQL, Redis) AND the application services (Producer, Consumer) in one command:
```bash
docker-compose up -d
```

### 3. Verify Services are Running
```bash
docker-compose ps
```

---

## III. API & Validation Examples

### 1. Basic Send 
```bash
curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"order123\", \"payload\": {\"item\": \"laptop\", \"price\": 999}}"
```

### 2. Test Distributed Lock
Run two requests at the **exact same time**:
```bash
curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"lock-test\"}" & curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"lock-test\"}"
```
- **Expected**: One returns `success: true`, the other returns `error: "Busy..."`.

### 3. Test Idempotency
Send the **exact same** `requestId` twice:
```bash
curl -X POST http://localhost:3000/demo/send -H "Content-Type: application/json" -d "{\"bizKey\": \"idem-test\", \"requestId\": \"fixed-uuid-123\"}"
```
- **Expected**: Run `docker-compose logs -f consumer` to see: `Duplicate message detected...`.

---

## IV. Data Verification Commands

### 1. Check MySQL Records
```bash
docker exec -it demo-goal-mysql-1 mysql -u root -prootpassword -e "USE demo_db; SELECT * FROM demo_records;"
```

### 2. Check Redis ID Mapping
```bash
# Replace {requestId} with the one from your API response
docker exec -it demo-goal-redis-1 redis-cli GET demo:req:{requestId}
```

## V. Development & Customization
If you want to modify the code and see changes:
1. Edit the files in `producer/src` or `consumer/src`.
2. Run `docker-compose up --build` to rebuild and restart the containers.
