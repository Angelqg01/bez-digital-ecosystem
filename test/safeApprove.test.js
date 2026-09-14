/**
 * Pruebas de `frontend/src/utils/safeApprove.js` contra contratos de verdad.
 *
 * Lo que importa aquí es que el ayudante elija bien la vía sin que quien lo
 * llama sepa qué token tiene delante:
 *
 *   - Contra un token CON `increaseAllowance`/`decreaseAllowance` —como será
 *     cualquier despliegue futuro de BEZ tras este cambio— debe usarlos.
 *   - Contra un token SIN ellos —como el BEZ ya desplegado, que no es
 *     actualizable— debe caer al patrón de poner a cero primero.
 *
 * La detección se hace preguntando a la cadena, no al ABI, así que estas
 * pruebas necesitan contratos desplegados de verdad. De ahí que vivan aquí y
 * no en Jest.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

// El ayudante vive en el frontend, que es ESM; este fichero es CommonJS, así
// que se carga con import() dinámico en el `before`.
let safeApprove;
let ALLOWANCE_ABI;

describe("safeApprove", function () {
    before(async function () {
        ({ safeApprove, ALLOWANCE_ABI } = await import("../frontend/src/utils/safeApprove.js"));
    });

    async function desplegar() {
        const [owner, spender] = await ethers.getSigners();

        // Token nuevo: tiene los ayudantes.
        const BezhasToken = await ethers.getContractFactory("BezhasToken");
        const conAyudantes = await BezhasToken.deploy(ethers.parseUnits("1000000", 18));
        await conAyudantes.waitForDeployment();

        // Token viejo: un ERC-20 pelado, sin ayudantes. Reproduce lo que hay
        // desplegado hoy.
        const ERC20Mock = await ethers.getContractFactory("src/mocks/ERC20Mock.sol:ERC20Mock");
        const sinAyudantes = await ERC20Mock.deploy("Viejo", "OLD", ethers.parseUnits("1000000", 18));
        await sinAyudantes.waitForDeployment();

        return { owner, spender, conAyudantes, sinAyudantes };
    }

    /** Envuelve el contrato en el ABI que usaría el frontend. */
    function comoEnElFrontend(contrato, signer) {
        return new ethers.Contract(contrato.target, ALLOWANCE_ABI, signer);
    }

    describe("token con increaseAllowance/decreaseAllowance", function () {
        it("sube la asignación con increaseAllowance, en una sola transacción", async function () {
            const { owner, spender, conAyudantes } = await desplegar();
            const token = comoEnElFrontend(conAyudantes, owner);

            await token.approve(spender.address, ethers.parseUnits("100", 18));

            const res = await safeApprove(token, owner.address, spender.address, ethers.parseUnits("150", 18));

            expect(res.strategy).to.equal("increaseAllowance");
            expect(res.txs).to.have.lengthOf(1);
            expect(await conAyudantes.allowance(owner.address, spender.address))
                .to.equal(ethers.parseUnits("150", 18));
        });

        it("baja la asignación con decreaseAllowance", async function () {
            const { owner, spender, conAyudantes } = await desplegar();
            const token = comoEnElFrontend(conAyudantes, owner);

            await token.approve(spender.address, ethers.parseUnits("100", 18));

            const res = await safeApprove(token, owner.address, spender.address, ethers.parseUnits("40", 18));

            expect(res.strategy).to.equal("decreaseAllowance");
            expect(await conAyudantes.allowance(owner.address, spender.address))
                .to.equal(ethers.parseUnits("40", 18));
        });
    });

    describe("token sin los ayudantes (el BEZ ya desplegado)", function () {
        it("cae al patrón de poner a cero primero, en dos transacciones", async function () {
            const { owner, spender, sinAyudantes } = await desplegar();
            const token = comoEnElFrontend(sinAyudantes, owner);

            await token.approve(spender.address, ethers.parseUnits("100", 18));

            const res = await safeApprove(token, owner.address, spender.address, ethers.parseUnits("40", 18));

            expect(res.strategy).to.equal("cero-primero");
            expect(res.txs).to.have.lengthOf(2);
            expect(await sinAyudantes.allowance(owner.address, spender.address))
                .to.equal(ethers.parseUnits("40", 18));
        });

        it("no deja la asignación intermedia sin confirmar: acaba en el valor pedido", async function () {
            const { owner, spender, sinAyudantes } = await desplegar();
            const token = comoEnElFrontend(sinAyudantes, owner);

            await token.approve(spender.address, ethers.parseUnits("100", 18));
            await safeApprove(token, owner.address, spender.address, ethers.parseUnits("250", 18));

            expect(await sinAyudantes.allowance(owner.address, spender.address))
                .to.equal(ethers.parseUnits("250", 18));
        });
    });

    describe("casos comunes a ambos", function () {
        it("desde cero aprueba directo, sin dar el rodeo", async function () {
            const { owner, spender, sinAyudantes } = await desplegar();
            const token = comoEnElFrontend(sinAyudantes, owner);

            const res = await safeApprove(token, owner.address, spender.address, ethers.parseUnits("75", 18));

            expect(res.strategy).to.equal("approve-desde-cero");
            expect(res.txs).to.have.lengthOf(1);
        });

        it("si ya está en el valor pedido, no gasta gas", async function () {
            const { owner, spender, conAyudantes } = await desplegar();
            const token = comoEnElFrontend(conAyudantes, owner);
            const cantidad = ethers.parseUnits("50", 18);

            await token.approve(spender.address, cantidad);
            const res = await safeApprove(token, owner.address, spender.address, cantidad);

            expect(res.skipped).to.equal(true);
            expect(res.txs).to.have.lengthOf(0);
        });

        it("bajar a cero funciona en los dos tipos de token", async function () {
            const { owner, spender, conAyudantes, sinAyudantes } = await desplegar();

            for (const contrato of [conAyudantes, sinAyudantes]) {
                const token = comoEnElFrontend(contrato, owner);
                await token.approve(spender.address, ethers.parseUnits("100", 18));

                await safeApprove(token, owner.address, spender.address, 0n);

                expect(await contrato.allowance(owner.address, spender.address)).to.equal(0);
            }
        });
    });
});
