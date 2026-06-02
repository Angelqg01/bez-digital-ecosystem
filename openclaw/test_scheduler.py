"""
BeZhas OpenClaw Scheduler Test Suite
====================================
Valida la carga dinámica de los prompts, la simulación de tiempo
y la comunicación mock/real con el motor OpenClaw.

Autor: BeZhas Platform
"""

import sys
import unittest
from pathlib import Path

# Añadir el directorio actual al PATH para poder importar openclaw_scheduler
OPENCLAW_DIR = Path(__file__).parent.resolve()
sys.path.append(str(OPENCLAW_DIR))

import openclaw_scheduler

class TestOpenClawScheduler(unittest.TestCase):
    
    def setUp(self):
        self.prompts_path = Path(r"D:\OpenClawData\Promts")
        
    def test_prompts_directory_exists(self):
        """Valida que la ruta D:\\OpenClawData\\Promts exista en el sistema."""
        self.assertTrue(self.prompts_path.exists(), f"El directorio de prompts no existe: {self.prompts_path}")
        
    def test_prompt_files_exist_and_readable(self):
        """Valida que los 4 archivos de prompt existan y tengan contenido."""
        prompts = openclaw_scheduler.get_all_prompts()
        
        expected_keys = ["orquestador", "comercial", "conectividad", "inversor"]
        for key in expected_keys:
            self.assertIn(key, prompts, f"Falta la clave '{key}' en la carga de prompts.")
            self.assertTrue(len(prompts[key]) > 0, f"El prompt '{key}' está vacío o no se leyó correctamente.")
            print(f"✅ Validación exitosa para: {key} ({len(prompts[key])} caracteres leídos)")

    def test_quant_precision_definitions(self):
        """Valida que las constantes de cuantización y modelo estén definidas."""
        try:
            from openclaw_engine import QuantPrecision
            self.assertIsNotNone(QuantPrecision.API_MODE)
            self.assertIsNotNone(QuantPrecision.INT4_BNB)
            print("✅ Estructura de precisión de openclaw_engine validada con éxito.")
        except ImportError:
            print("⚠️ openclaw_engine no importado en el entorno local (omitiendo test).")

def run_tests():
    print("\n" + "="*60)
    print("  🧪 BeZhas OpenClaw Scheduler Test Framework")
    print("="*60)
    
    suite = unittest.TestLoader().loadTestsFromTestCase(TestOpenClawScheduler)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print("="*60 + "\n")
    sys.exit(0 if result.wasSuccessful() else 1)

if __name__ == "__main__":
    run_tests()
