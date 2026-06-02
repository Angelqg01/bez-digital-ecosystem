# Test Failures & Fixes
> Base de conocimiento de tests fallidos y correcciones

## vm.prank() consumed by next call
**Síntoma**: Test falla con "not authorized" a pesar de usar vm.prank
**Causa**: `vm.prank()` se consume en la siguiente llamada (incluso view calls)
**Solución**: Usar `vm.startPrank()/vm.stopPrank()` para multi-call
```solidity
// Incorrecto
vm.prank(admin);
contract.ADMIN_ROLE(); // ← consume el prank
contract.doSomething(); // ← ya no es admin

// Correcto
vm.startPrank(admin);
contract.doSomething();
contract.doMore();
vm.stopPrank();
```
**Fecha**: 2026-03-05

## Assertion value mismatch (Paymaster deposit)
**Síntoma**: `assertion failed: 4995e18 != 495e18`
**Causa**: Test depositó 5000 ether pero asertó 500 - 5 = 495 en vez de 5000 - 5 = 4995
**Lección**: Siempre verificar las cantidades base en helpers de test
**Fecha**: 2026-03-19

## forge test exit code 1 with passing tests
**Síntoma**: Todos los tests pasan pero exit code es 1
**Causa**: Forge nightly muestra warnings como stderr que PowerShell interpreta como error
**Solución**: Ignorar exit code 1 si output muestra "X passed, 0 failed"
**Alternativa**: Set `$env:FOUNDRY_DISABLE_NIGHTLY_WARNING=1`

## SupplyChain cross-deps test failures
**Síntoma**: Tests de SupplyChain que dependen de contratos de otros módulos fallan
**Causa**: Contratos extras (4) tienen dependencias cruzadas entre módulos
**Solución**: Desplegar dependencias en setUp() del test
**Fecha**: 2026-03-12

## Test count tracking
- Total tests before wallet: 816+
- Wallet tests added: 115 (33+21+18+27+16)
- **Total tests: 931+**
- All passing: ✅
