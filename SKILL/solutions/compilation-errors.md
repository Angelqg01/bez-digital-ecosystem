# Compilation Errors & Solutions
> Base de conocimiento de errores de compilación en Solidity

## Error: `sealed` is a reserved keyword
**Solidity**: 0.8.34+
**Síntoma**: `ParserError: Expected identifier but got 'sealed'`
**Solución**: Renombrar variable `sealed` → `isSealed`
**Fecha**: 2026-03-10

## Error: Stack too deep (13+ struct fields)
**Síntoma**: `CompilerError: Stack too deep`
**Causa**: Auto-generated public mapping getters with large structs exceed stack limit
**Solución**: Use `internal` mapping + custom `view` helper function
**Fecha**: 2026-03-08

## Error: ReentrancyGuard import path
**OZ Version**: v5
**Incorrecto**: `openzeppelin-contracts/contracts/security/ReentrancyGuard.sol`
**Correcto**: `openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol`
**Nota**: OZ v5 movió ReentrancyGuard de security/ a utils/

## Error: Counters.sol not found
**OZ Version**: v5
**Causa**: OZ v5 eliminó Counters.sol
**Solución**: Usar `uint256` directamente e incrementar manualmente
**Fecha**: 2026-03-01

## Error: Constructor arguments for Ownable
**OZ Version**: v5
**Incorrecto**: `Ownable()` (sin argumentos)
**Correcto**: `Ownable(initialOwner)` — requiere dirección explícita
**Fecha**: 2026-03-01

## Warning: unsafe-typecast (forge lint)
**Síntoma**: Lint warning, no error de compilación
**Causa**: Foundry lint detecta casts potencialmente inseguros
**Acción**: Ignorar si el cast es seguro, o añadir comment:
```solidity
// forge-lint: disable-next-line(unsafe-typecast)
```

## Warning: erc20-unchecked-transfer
**Síntoma**: Forge lint warning on `token.transfer()`
**Solución**: Usar `SafeERC20.safeTransfer()` de OpenZeppelin
```solidity
using SafeERC20 for IERC20;
token.safeTransfer(to, amount);
```
