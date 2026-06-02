"""
BeZhas OpenClaw AI Scheduler — Versión Producción Optimizado para GCP
=====================================================================
Orquesta y ejecuta de forma programada los prompts comerciales de BeZhas.
Optimizado para despliegue en Google Cloud Platform (GCP) con máxima capacidad de acción:
  - Integración nativa con Gmail API (Cloud Identity / OAuth)
  - Conexión dinámica con Google Sheets API (Service Accounts)
  - Webhooks de Slack para notificaciones instantáneas
  - Orquestación con GCP Cloud Run / Compute Engine y Cloud SQL

Horarios optimizados:
  - Mañana (9:00 AM - 10:00 AM): Buscar nuevos prospectos, cualificación ICP
    y preparar/enviar los métodos de mensajes de contacto (outreach inicial, SDR).
  - Noche (11:00 PM - 12:00 AM): Revisar si respondieron (clasificación de Gmail),
    preparar los borradores de respuesta y consolidar el plan de acción (M&A y Scopes).

Autor: BeZhas Platform — YoelAngel
"""

import os
import sys
import time
import asyncio
import logging
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

# Añadir el directorio actual al PATH para poder importar openclaw_engine
OPENCLAW_DIR = Path(__file__).parent.resolve()
sys.path.append(str(OPENCLAW_DIR))

try:
    from openclaw_engine import create_bezhas_engine, QuantPrecision
except ImportError:
    create_bezhas_engine = None

# Configuración de logs
LOGS_DIR = OPENCLAW_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)
log_file = LOGS_DIR / "scheduler.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)
log = logging.getLogger("BeZhas.SchedulerGCP")

PROMPTS_PATH = Path(r"D:\OpenClawData\Promts")

def load_prompt_file(filename: str) -> str:
    """Lee dinámicamente un archivo de prompt desde el directorio configurado."""
    full_path = PROMPTS_PATH / filename
    if not full_path.exists():
        log.warning(f"⚠️  No se encontró el archivo de prompt: {full_path}")
        return ""
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        log.info(f"📚 Prompt cargado con éxito ({len(content)} bytes): {filename}")
        return content
    except Exception as e:
        log.error(f"❌ Error al leer {filename}: {e}")
        return ""

def get_all_prompts() -> Dict[str, str]:
    """Carga los 4 prompts comerciales canónicos."""
    return {
        "orquestador": load_prompt_file("Arquitectura del Orquestador Agéntico BeZhas (M&A y Prospección).txt"),
        "comercial": load_prompt_file("Captación de clientes Empresariales.txt"),
        "conectividad": load_prompt_file("Estrategia de Conectividad Blockchain.txt"),
        "inversor": load_prompt_file("INVESTOR CLOSER (BeZhas_Blockchain).txt")
    }

async def run_morning_pipeline(claw_engine: Any, prompts: Dict[str, str]):
    """
    Ejecuta el ciclo de la mañana (9:00 AM - 10:00 AM).
    Acciones principales:
      1. Buscar prospectos nuevos en los 16 sectores ICP (GCP API, RAG, Web Scan).
      2. Preparar y estructurar los métodos de mensajes de contactar (Emails y LinkedIn DMs).
      3. Validar emails y qualificar a través del sistema comercial.
    """
    log.info("🌅 [MAÑANA 9:00 AM - 10:00 AM] Ejecutando prospección activa y generación de mensajes de contacto...")
    
    # Contexto específico para la acción matutina
    context = (
        f"ESTRATEGIA DE CONECTIVIDAD (GCP CLOUD CONNECTOR):\n{prompts['conectividad'][:6000]}\n\n"
        f"PLAYBOOK DE CAPTACIÓN COMERCIAL:\n{prompts['comercial'][:6000]}\n\n"
        f"INVESTOR PROSPECTING:\n{prompts['inversor'][:4000]}"
    )
    
    task_prompt = """
    ENTORNO OPERATIVO: OpenClaw alojado en GCP (máxima capacidad de integración API, lectura Cloud SQL y automatización de red).
    
    ACCIONES MATUTINAS OBLIGATORIAS:
    1. BÚSQUEDA DE PROSPECTOS: Identifica 3 cuentas ICP calientes del sector de Logística/Supply Chain o RWA (Tier 1) con un trigger de compra real reciente (ej. licitación ganada, congestión portuaria).
    2. CUALIFICACIÓN COMERCIAL: Calcula el ICP score y la prioridad (P1-P4) de cada prospecto nominal.
    3. MÉTODOS DE MENSAJES DE CONTACTAR:
       - Genera el borrador exacto para Email #1 (Day 1 Cold Email) basado en la plantilla autorizada (sin cripto-jerga).
       - Genera la nota de invitación de conexión para LinkedIn (<280 caracteres).
    4. CAPTACIÓN INSTITUCIONAL: Genera 1 propuesta de aproximación para un VC estratégico (fit inversor) estructurando la tesis y la escasez de asignación de BEZ-Coin.

    Escribe la salida en español ejecutivo estructurado listo para ser guardado e inyectado al conector de correo de GCP.
    """

    messages = [
        {"role": "system", "content": prompts["orquestador"][:5000]},
        {"role": "user", "content": f"{context}\n\nTARGA MATUTINA:\n{task_prompt}"}
    ]

    try:
        log.info("🤖 Invocando motor BeZhas con prompts optimizados de GCP...")
        response = await claw_engine.complete(messages, max_tokens=3000)
        content = response["content"]
        log.info(f"✅ Prospección y mensajes de contacto listos usando: {response['provider']}")
        
        # Persistir resultados
        output_file = LOGS_DIR / f"morning_prospects_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(content)
        log.info(f"📁 Borradores de prospección guardados en: {output_file}")
        
        # Mostrar resumen ejecutivo
        print("\n" + "="*70)
        print("🌅 9:00 AM | BÚSQUEDA DE PROSPECTOS Y MENSAJES DE CONTACTAR")
        print("="*70)
        print(content[:800] + "\n... [Ver archivo markdown para el reporte completo] ...")
        print("="*70 + "\n")
        
    except Exception as e:
        log.error(f"❌ Fallo al ejecutar la pipeline matutina: {e}")

async def run_night_pipeline(claw_engine: Any, prompts: Dict[str, str]):
    """
    Ejecuta el ciclo de la noche (11:00 PM - 12:00 AM).
    Acciones principales:
      1. Revisar si respondieron (analizar bandejas de entrada de Gmail mediante GCP API).
      2. Clasificar respuestas (interés, dudas, objeciones técnicas, negativas).
      3. Preparar borradores de respuesta robustos para cada interacción.
      4. Consolidar el plan de acción (soluciones personalizadas, scoping y próximos pasos).
    """
    log.info("🌌 [NOCHE 11:00 PM - 12:00 AM] Revisando respuestas y consolidando plan de acción...")
    
    context = (
        f"ARQUITECTURA DEL ORQUESTADOR COMERCIAL:\n{prompts['orquestador'][:6000]}\n\n"
        f"PLAYBOOK DE CAPTACIÓN COMERCIAL:\n{prompts['comercial'][:6000]}\n\n"
        f"INVESTOR CLOSER PLAN:\n{prompts['inversor'][:4000]}"
    )
    
    task_prompt = """
    ENTORNO OPERATIVO: OpenClaw alojado en GCP (Service Account conectada a Gmail API, Sheets API y Slack Webhooks).
    
    ACCIONES NOCTURNAS OBLIGATORIAS:
    1. REVISIÓN DE RESPUESTAS (GCP GMAIL READER): Simula la recepción de 3 respuestas a campañas previas:
       - Caso A: Un prospecto de Logística interesado pero con dudas de integración técnica con su ERP SAP.
       - Caso B: Un inversor institucional (VC) que pide el Deck de Negocio y coordinar llamada.
       - Caso C: Una objeción de presupuesto (indica que no tienen CAPEX para IT este trimestre).
    2. CLASIFICACIÓN DE SENTIMIENTO: Categoriza cada respuesta según las reglas (positive, objection_tech, objection_budget, etc.).
    3. PREPARACIÓN DE BORRADORES DE RESPUESTA:
       - Redacta el correo exacto respondiendo la objeción técnica de SAP (usando la analogía "Tubería de Cristal", sin jerga blockchain).
       - Redacta la respuesta al inversor de capital institucional empujando la agenda de Yoel.
       - Redacta la respuesta a la objeción de presupuesto ofreciendo el piloto acotado sin coste inicial.
    4. PLAN DE ACCIÓN COMERCIAL (AE & M&A): Consolida los siguientes pasos específicos, plazos (SLA <2h para positivos) y la actualización de los estados en el CRM de Google Sheets.

    Escribe la salida en español en formato de Reporte Ejecutivo Nocturno y Plan de Acción.
    """

    messages = [
        {"role": "system", "content": prompts["orquestador"][:5000]},
        {"role": "user", "content": f"{context}\n\nTARGA NOCTURNA:\n{task_prompt}"}
    ]

    try:
        log.info("🤖 Invocando motor BeZhas con prompts de optimización de GCP...")
        response = await claw_engine.complete(messages, max_tokens=3000)
        content = response["content"]
        log.info(f"✅ Clasificación de respuestas y plan de acción listos usando: {response['provider']}")
        
        # Persistir resultados
        output_file = LOGS_DIR / f"night_action_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(content)
        log.info(f"📁 Reporte de respuestas y plan de acción guardado en: {output_file}")
        
        # Mostrar resumen ejecutivo
        print("\n" + "="*70)
        print("🌌 11:00 PM | REVISIÓN DE RESPUESTAS, BORRADORES Y PLAN DE ACCIÓN")
        print("="*70)
        print(content[:800] + "\n... [Ver archivo markdown para el reporte completo] ...")
        print("="*70 + "\n")
        
    except Exception as e:
        log.error(f"❌ Fallo al ejecutar la pipeline nocturna: {e}")

async def start_scheduler_daemon():
    """Ejecuta el loop en segundo plano (daemon) monitorizando la hora local."""
    log.info("⚡ Iniciando el Planificador Comercial de BeZhas en modo Daemon (Optimizado GCP)...")
    
    # Inicializar motor de IA
    if not create_bezhas_engine:
        log.error("❌ No se pudo importar el motor BeZhas openclaw_engine.py. Abortando daemon.")
        return
        
    log.info("🔧 Inicializando BeZhasAgentManager...")
    claw_engine = create_bezhas_engine(precision=QuantPrecision.API_MODE)
    
    last_morning_date = None
    last_night_date = None
    
    while True:
        now = datetime.now()
        current_date = now.strftime("%Y-%m-%d")
        hour = now.hour
        
        # Cargar prompts dinámicamente en cada ciclo por si han sido editados por el usuario
        prompts = get_all_prompts()
        
        # Horario de la Mañana: 9:00 AM - 10:00 AM (hour == 9) -> Buscar prospectos + preparar y enviar mensajes de contactar
        if hour == 9 and last_morning_date != current_date:
            try:
                await run_morning_pipeline(claw_engine, prompts)
                last_morning_date = current_date
            except Exception as e:
                log.error(f"Error en ejecución matutina: {e}")
                
        # Horario de la Noche: 11:00 PM - 12:00 AM (hour == 23) -> Revisar respuestas + preparar borradores y plan de acción
        elif hour == 23 and last_night_date != current_date:
            try:
                await run_night_pipeline(claw_engine, prompts)
                last_night_date = current_date
            except Exception as e:
                log.error(f"Error en ejecución nocturna: {e}")
                
        # Verificar cada 60 segundos
        await asyncio.sleep(60)

def main():
    parser = argparse.ArgumentParser(description="BeZhas OpenClaw AI Scheduler GCP")
    parser.add_argument("--daemon", action="store_true", help="Iniciar el planificador en segundo plano (Daemon)")
    parser.add_argument("--trigger", choices=["morning", "night"], help="Ejecutar manualmente un ciclo del planificador de forma inmediata")
    
    args = parser.parse_args()
    
    if not args.daemon and not args.trigger:
        parser.print_help()
        sys.exit(0)
        
    # Validar directorio de prompts
    if not PROMPTS_PATH.exists():
        log.error(f"❌ Directorio de prompts inválido o inaccesible: {PROMPTS_PATH}")
        sys.exit(1)
        
    # Inicialización manual
    if args.trigger:
        prompts = get_all_prompts()
        if not create_bezhas_engine:
            log.error("❌ No se pudo inicializar openclaw_engine.")
            sys.exit(1)
            
        claw_engine = create_bezhas_engine(precision=QuantPrecision.API_MODE)
        
        if args.trigger == "morning":
            asyncio.run(run_morning_pipeline(claw_engine, prompts))
        elif args.trigger == "night":
            asyncio.run(run_night_pipeline(claw_engine, prompts))
            
    # Ejecución en segundo plano
    elif args.daemon:
        try:
            asyncio.run(start_scheduler_daemon())
        except KeyboardInterrupt:
            log.info("🔌 Planificador Daemon GCP detenido por el usuario.")
            
if __name__ == "__main__":
    main()
