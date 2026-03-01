import express from 'express';
import { Redis } from 'ioredis';
import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

const redis = new Redis({
    host: 'localhost',
    port: 6379,
});

const kafka = new Kafka({
    clientId: 'demo-producer',
    brokers: ['localhost:9092'],
});

const producer = kafka.producer();

const TOPIC = 'demo-topic';

async function setup() {
    await producer.connect();
    console.log('Producer connected to Kafka');
}

setup().catch(console.error);

app.post('/demo/send', async (req, res) => {
    const { bizKey, payload, requestId: providedId } = req.body;

    if (!bizKey) {
        return res.status(400).json({ error: 'bizKey is required' });
    }

    const requestId = providedId || uuidv4();
    const lockKey = `lock:kafka:send:${bizKey}`;
    const lockValue = requestId;
    const ttl = 10000; // 10 seconds

    console.log(`[${requestId}] Request received for bizKey: ${bizKey}`);

    try {
        // 1. Acquire Redis distributed lock
        const acquired = await redis.set(lockKey, lockValue, 'NX', 'PX', ttl);

        if (!acquired) {
            console.log(`[${requestId}] Lock acquisition failed for bizKey: ${bizKey}`);
            return res.status(429).json({ error: 'Busy, please try again later' });
        }

        console.log(`[${requestId}] Lock acquired for bizKey: ${bizKey}`);

        // 2. Send Kafka message
        const message = {
            requestId,
            bizKey,
            payload,
            timestamp: new Date().toISOString(),
        };

        await producer.send({
            topic: TOPIC,
            messages: [
                { value: JSON.stringify(message) },
            ],
        });

        console.log(`[${requestId}] Kafka message sent successfully`);

        // 3. Release lock (using Lua script to ensure atomicity)
        const luaScript = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;
        await redis.eval(luaScript, 1, lockKey, lockValue);
        console.log(`[${requestId}] Lock released`);

        return res.json({
            success: true,
            requestId,
            message: 'Message sent successfully'
        });

    } catch (error) {
        console.error(`[${requestId}] Error:`, error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Producer service listening on port ${PORT}`);
});
