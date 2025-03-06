import 'dotenv/config';
import { Worker } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import readline from 'readline';


const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);


const worker = new Worker(
  'log-processing-queue',
  async (job) => {
    const { fileId, filePath } = job.data;

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream });

    for await (const line of rl) {
      const match = line.match(/\[(.*?)\] (\w+) (.*?) ({.*})?/);
      if (match) {
        const [, timestamp, level, message, payload] = match;

        const keywords = process.env.KEYWORDS.split(',');
        const hasKeyword = keywords.some((keyword) => message.includes(keyword));
        const ipMatch = payload?.match(/"ip":\s*"([^"]+)"/);
        const ip = ipMatch ? ipMatch[1] : null;


        await supabase.from('log_stats').insert([
          {
            jobId: fileId,
            timestamp,
            level,
            message,
            payload,
            keywords: hasKeyword ? keywords.join(',') : null,
            ips: ip,
          },
        ]);
      }
    }

    fs.unlinkSync(filePath);
  },
  {
    connection: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    },
    concurrency: 4,
  }
);

console.log('Worker iniciado...');