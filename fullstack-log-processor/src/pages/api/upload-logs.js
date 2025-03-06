import 'dotenv/config'; // <-- Esto carga las variables de entorno
import { Queue } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Configura Multer para subir archivos
const upload = multer({ dest: 'uploads/' });

// Inicializa Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Inicializa la cola de BullMQ
const queue = new Queue('log-processing-queue', {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

export const config = {
  api: {
    bodyParser: false, // Desactiva el bodyParser predeterminado para usar Multer
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  // Maneja la subida del archivo
  upload.single('logFile')(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ message: 'Error al subir el archivo' });
    }

    const filePath = req.file.path;
    const fileId = path.basename(filePath);

    // Agrega el trabajo a la cola de BullMQ
    await queue.add('process-log', { fileId, filePath });

    res.status(200).json({ jobId: fileId });
  });
}