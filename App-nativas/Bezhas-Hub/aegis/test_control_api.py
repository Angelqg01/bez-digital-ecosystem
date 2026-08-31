"""
Test script for Aegis Control API
Ejemplos de uso de todos los endpoints disponibles
"""

import requests
import json
from typing import Dict, Any

# Configuración
API_URL = "http://localhost:8000/api/aegis"

def print_response(response: requests.Response):
    """Pretty print de la respuesta"""
    print(f"\n{'='*60}")
    print(f"Status Code: {response.status_code}")
    print(f"{'='*60}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    print(f"{'='*60}\n")


def test_set_mode():
    """Test: Cambiar modo de operación"""
    print("🔄 Cambiando modo a 'autonomous'...")
    response = requests.put(
        f"{API_URL}/control/set_mode",
        json={"mode": "autonomous"}
    )
    print_response(response)


def test_pause_system():
    """Test: Pausa de emergencia"""
    print("⏸️ Pausando sistema...")
    response = requests.post(f"{API_URL}/control/pause")
    print_response(response)


def test_resume_system():
    """Test: Reanudar sistema"""
    print("▶️ Reanudando sistema...")
    response = requests.post(f"{API_URL}/control/resume")
    print_response(response)


def test_trigger_action():
    """Test: Ejecutar acción manual"""
    print("🔧 Ejecutando 'purge_cache'...")
    response = requests.post(
        f"{API_URL}/control/trigger_action",
        json={"action": "purge_cache"}
    )
    print_response(response)


def test_approve_action():
    """Test: Aprobar sugerencia"""
    print("✅ Aprobando sugerencia sug_12345...")
    response = requests.post(
        f"{API_URL}/control/approve_action/sug_12345",
        json={"feedback": "Acción correcta, proceder"}
    )
    print_response(response)


def test_reject_action():
    """Test: Rechazar sugerencia"""
    print("❌ Rechazando sugerencia sug_67890...")
    response = requests.post(
        f"{API_URL}/control/reject_action/sug_67890",
        json={"feedback": "Falso positivo, no ejecutar"}
    )
    print_response(response)


def test_set_threshold():
    """Test: Ajustar umbral de anomalías"""
    print("📊 Ajustando umbral de detección a 0.7...")
    response = requests.put(
        f"{API_URL}/config/anomaly_threshold",
        json={"level": 0.7}
    )
    print_response(response)


def test_mark_false_positive():
    """Test: Marcar falso positivo"""
    print("🏷️ Marcando log_12345 como falso positivo...")
    response = requests.post(
        f"{API_URL}/model/mark_false_positive",
        json={
            "log_id": "log_12345",
            "reason": "Usuario legítimo con comportamiento inusual"
        }
    )
    print_response(response)


def test_retrain_model():
    """Test: Iniciar re-entrenamiento"""
    print("🧠 Iniciando re-entrenamiento del modelo...")
    response = requests.post(
        f"{API_URL}/model/retrain",
        params={
            "include_false_positives": True,
            "include_approved_actions": True
        }
    )
    print_response(response)


def test_retrain_status():
    """Test: Consultar estado de re-entrenamiento"""
    print("📈 Consultando estado del job de re-entrenamiento...")
    job_id = "retrain_job_1730505600.0"
    response = requests.get(f"{API_URL}/model/retrain/status/{job_id}")
    print_response(response)


def test_set_telemetry():
    """Test: Habilitar telemetría"""
    print("📡 Habilitando telemetría...")
    response = requests.put(
        f"{API_URL}/config/telemetry",
        json={"enabled": True}
    )
    print_response(response)


def test_set_samplerate():
    """Test: Ajustar tasa de muestreo"""
    print("⚖️ Ajustando tasa de muestreo a 10%...")
    response = requests.put(
        f"{API_URL}/config/telemetry_samplerate",
        json={"rate": 0.1}
    )
    print_response(response)


def test_get_status():
    """Test: Obtener estado del sistema"""
    print("🔍 Obteniendo estado del sistema...")
    response = requests.get(f"{API_URL}/status")
    print_response(response)


def test_get_pending_suggestions():
    """Test: Obtener sugerencias pendientes"""
    print("📋 Obteniendo sugerencias pendientes...")
    response = requests.get(
        f"{API_URL}/suggestions/pending",
        params={"limit": 10}
    )
    print_response(response)


def run_all_tests():
    """Ejecutar todos los tests"""
    print("\n" + "="*60)
    print("🚀 INICIANDO TESTS DE AEGIS CONTROL API")
    print("="*60 + "\n")

    try:
        # Tests de control
        test_set_mode()
        test_trigger_action()
        test_approve_action()
        test_reject_action()
        
        # Tests de configuración
        test_set_threshold()
        test_mark_false_positive()
        test_retrain_model()
        test_retrain_status()
        
        # Tests de telemetría
        test_set_telemetry()
        test_set_samplerate()
        
        # Tests de monitoreo
        test_get_status()
        test_get_pending_suggestions()
        
        # Tests de pausa/reanudación
        test_pause_system()
        test_resume_system()

        print("\n" + "="*60)
        print("✅ TODOS LOS TESTS COMPLETADOS")
        print("="*60 + "\n")

    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: No se pudo conectar al servidor.")
        print("Asegúrate de que el servidor esté corriendo en http://localhost:8000")
        print("\nPara iniciar el servidor:")
        print("  cd aegis")
        print("  python main.py")


def interactive_menu():
    """Menú interactivo para probar endpoints"""
    while True:
        print("\n" + "="*60)
        print("🎮 AEGIS CONTROL API - MENÚ INTERACTIVO")
        print("="*60)
        print("\nCONTROL:")
        print("  1. Cambiar modo de operación")
        print("  2. Pausar sistema")
        print("  3. Reanudar sistema")
        print("  4. Ejecutar acción manual")
        print("  5. Aprobar sugerencia")
        print("  6. Rechazar sugerencia")
        print("\nCONFIGURACIÓN:")
        print("  7. Ajustar umbral de anomalías")
        print("  8. Marcar falso positivo")
        print("  9. Iniciar re-entrenamiento")
        print("  10. Consultar estado de re-entrenamiento")
        print("\nTELEMETRÍA:")
        print("  11. Habilitar/deshabilitar telemetría")
        print("  12. Ajustar tasa de muestreo")
        print("\nMONITOREO:")
        print("  13. Obtener estado del sistema")
        print("  14. Ver sugerencias pendientes")
        print("\nOTROS:")
        print("  15. Ejecutar todos los tests")
        print("  0. Salir")
        print("="*60)
        
        choice = input("\nSelecciona una opción: ").strip()
        
        if choice == "0":
            print("\n👋 ¡Hasta luego!")
            break
        elif choice == "1":
            test_set_mode()
        elif choice == "2":
            test_pause_system()
        elif choice == "3":
            test_resume_system()
        elif choice == "4":
            test_trigger_action()
        elif choice == "5":
            test_approve_action()
        elif choice == "6":
            test_reject_action()
        elif choice == "7":
            test_set_threshold()
        elif choice == "8":
            test_mark_false_positive()
        elif choice == "9":
            test_retrain_model()
        elif choice == "10":
            test_retrain_status()
        elif choice == "11":
            test_set_telemetry()
        elif choice == "12":
            test_set_samplerate()
        elif choice == "13":
            test_get_status()
        elif choice == "14":
            test_get_pending_suggestions()
        elif choice == "15":
            run_all_tests()
        else:
            print("❌ Opción inválida")
        
        input("\nPresiona Enter para continuar...")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        # Ejecutar todos los tests
        run_all_tests()
    else:
        # Menú interactivo
        interactive_menu()
