import 'dotenv/config';
import { Redis } from 'ioredis';
import fs from 'fs';
import path from 'path';

/**
 * BeZhas — Exportador de SKILLs para Fine-Tuning
 * ─────────────────────────────────────────────────────────────────────────────
 * Este script extrae los eventos de la cola de aprendizaje continuo
 * (bezhas:dataset:skills) y los guarda en un archivo JSONL (JSON Lines).
 * Este archivo puede ser usado posteriormente para fine-tunear modelos
 * locales de Ollama o entrenar LoRAs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

async function exportSkills() {
  console.log('🚀 Iniciando exportación de SKILLs (Dataset generation)...');
  
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl);
  
  try {
    const queueName = 'bezhas:dataset:skills';
    const totalSkills = await redis.llen(queueName);
    
    if (totalSkills === 0) {
      console.log('✅ No hay nuevos SKILLs en la cola para exportar.');
      process.exit(0);
    }
    
    console.log(`📦 Encontrados ${totalSkills} eventos de SKILL en memoria. Extrayendo...`);
    
    // Obtener todos los eventos
    const rawSkills = await redis.lrange(queueName, 0, -1);
    
    // Preparar el archivo de destino
    const dateStr = new Date().toISOString().split('T')[0];
    const outputDir = path.join(process.cwd(), 'datasets');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, `skills_dataset_${dateStr}.jsonl`);
    const stream = fs.createWriteStream(outputPath, { flags: 'a' });
    
    let exported = 0;
    
    for (const raw of rawSkills) {
      try {
        const skill = JSON.parse(raw);
        // Formato estandarizado de chat para fine-tuning
        const datasetEntry = {
          messages: [
            { role: 'system', content: `Agent: ${skill.agent}` },
            { role: 'user', content: skill.input },
            { role: 'assistant', content: skill.output }
          ],
          tools_used: skill.tools,
          provider: skill.provider,
          reward: skill.reward || 1, // Feedback (1: Aprobado/Cloud, -1: Rechazado)
          ts: skill.ts
        };
        
        stream.write(JSON.stringify(datasetEntry) + '\n');
        exported++;
      } catch (e) {
        console.warn('⚠️ Error parseando un SKILL event:', e.message);
      }
    }
    
    stream.end();
    
    // Limpiar la cola una vez exportados con éxito
    await redis.del(queueName);
    
    console.log(`🎉 Exportación completada: ${exported} interacciones guardadas en ${outputPath}`);
    console.log(`🔄 El dataset está listo para ser usado en procesos de fine-tuning (RLHF).`);
    
  } catch (error) {
    console.error('❌ Error fatal exportando SKILLs:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

exportSkills();
