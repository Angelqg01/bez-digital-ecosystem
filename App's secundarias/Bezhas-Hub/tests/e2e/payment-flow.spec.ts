import { test, expect } from '@playwright/test';

test.describe('BeZhas Pago Nativo - E2E PostgreSQL Slice', () => {
  
  test('Debería cargar la página de compra, seleccionar token BEZ y procesar pago exitosamente', async ({ page }) => {
    // 1. Navegar a la página de pagos
    await page.goto('/market');
    
    // Validar carga
    await expect(page).toHaveTitle(/BeZhas*/i);
    
    // Si hay un modal the Wallet, lo cerramos o mockeamos (dependerá del estado local)
    // localstorage override para mock login si fuese necesario:
    await page.evaluate(() => {
      window.localStorage.setItem('walletAddress', '0x742d35Cc6634C0532925a3b8D0A4E5C4C0532925');
      window.localStorage.setItem('auth_token', 'mock_token_e2e_test');
    });

    // Recargar para aplicar storage
    await page.reload();

    // 2. Interaccionar con BEZ-Pay
    // Buscar un CTA de "Buy BEZ" o "Checkout" - asumimos texto habitual
    const buyButton = page.locator('button', { hasText: /Comprar|Buy BEZ|Checkout/i }).first();
    
    if (await buyButton.isVisible()) {
        await buyButton.click();
    } else {
        // Fallback al URL directo del gateway para aislar la prueba de la Home
        await page.goto('/payments');
    }

    // 3. Simular llenado de checkout
    // Asumiendo campos que mapean al objeto PaymentPG
    await expect(page.locator('text=/Total|Amount/i')).toBeVisible();
    
    const amountInput = page.locator('input[type="number"]').first();
    if (await amountInput.isVisible()) {
        await amountInput.fill('100'); // $100 USD
    }

    // Botón final de "Confirmar Pago"
    const confirmButton = page.locator('button', { hasText: /Confirm|Pay|Process/i }).first();
    
    // Interceptamos la llamada al API local (esto nos garantiza probar la ruta hacia PG)
    const paymentPromise = page.waitForResponse(
        response => response.url().includes('/api/payment') && response.status() === 200
    );

    // Activamos la compra
    await confirmButton.click();

    // 4. Esperar que el backend node responda confirmando que PaymentPG grabó bien
    const paymentResponse = await paymentPromise;
    const body = await paymentResponse.json();
    
    // 5. Validaciones Finales
    expect(body).toBeDefined();
    // Debe tener un intent de pago derivado del flujo BezPayService
    expect(body.paymentId || body.clientSecret || body.success).toBeTruthy();
    
    // Comprobar que en la UI aparece el mensaje de "Éxito"
    await expect(page.locator('text=/Success|Éxito|Completado/i').first()).toBeVisible({ timeout: 15000 });
  });

});
