// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract BeZhasAdminRegistry is Ownable {
    mapping(address => bool) private _admins;
    
    event AdminAdded(address indexed account);
    event AdminRemoved(address indexed account);

    constructor() Ownable(msg.sender) {
        // El creador del contrato es el primer admin por defecto
        _admins[msg.sender] = true;
        emit AdminAdded(msg.sender);
    }

    /**
     * @dev Agrega una wallet a la lista de administradores. Solo el dueño del contrato puede hacerlo.
     */
    function addAdmin(address account) public onlyOwner {
        require(account != address(0), "Direccion invalida");
        _admins[account] = true;
        emit AdminAdded(account);
    }

    /**
     * @dev Elimina una wallet de la lista de administradores.
     */
    function removeAdmin(address account) public onlyOwner {
        require(account != msg.sender, "No puedes eliminarte a ti mismo");
        _admins[account] = false;
        emit AdminRemoved(account);
    }

    /**
     * @dev Verifica si una direccion es administrador.
     */
    function isAdmin(address account) public view returns (bool) {
        return _admins[account];
    }
}