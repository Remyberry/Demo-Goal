import { Kafka } from 'kafkajs';
import mysql from 'mysql2/promise';
import { Redis } from 'ioredis';

const kafka = new Kafka({
    clientId: 'demo-consumer',
    brokers: ['localhost:9092'],
});

const redis = new Redis({
    host: 'localhost',
    port: 6379,
});

const mysqlConfig = {
    host: 'localhost',
    user: 'root',
    password: 'rootpassword',
    database: 'demo_db',
};

const TOPIC = 'demo-topic';

async function setup() {
    const db = await mysql.createConnection(mysqlConfig);
    console.log('Consumer connected to MySQL');

    const consumer = kafka.consumer({ groupId: 'demo-group' });
    await consumer.connect();
    console.log('Consumer connected to Kafka');
    await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const data = JSON.parse(message.value?.toString() || '{}');
            const { requestId, bizKey, payload } = data;

            if (!requestId || !bizKey) {
                console.warn('Received invalid message:', data);
                return;
            }

            console.log(`[${requestId}] Message received for bizKey: ${bizKey}`);

            try {
                // Write to MySQL
                let mysqlDataId: number;
                try {
                    const [result]: any = await db.execute(
                        'INSERT INTO demo_records (request_id, biz_key, payload) VALUES (?, ?, ?)',
                        [requestId, bizKey, payload ? JSON.stringify(payload) : null]
                    );
                    mysqlDataId = result.insertId;
                    console.log(`[${requestId}] MySQL insert success, ID: ${mysqlDataId}`);
                } catch (err: any) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        console.log(`[${requestId}] Duplicate message detected, querying existing record...`);
                        const [rows]: any = await db.execute(
                            'SELECT id FROM demo_records WHERE request_id = ?',
                            [requestId]
                        );
                        mysqlDataId = rows[0].id;
                        console.log(`[${requestId}] Existing MySQL ID: ${mysqlDataId}`);
                    } else {
                        throw err;
                    }
                }

                // Write to Redis 
                const redisKey = `demo:req:${requestId}`;
                await redis.set(redisKey, mysqlDataId);
                console.log(`[${requestId}] Redis write success: ${redisKey} -> ${mysqlDataId}`);

            } catch (error) {
                console.error(`[${requestId}] Consumer processing error:`, error);
            }
        },
    });
}

setup().catch(console.error);
