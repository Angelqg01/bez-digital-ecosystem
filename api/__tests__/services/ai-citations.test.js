const { validarCitas } = require('../../services/ai-workspace/citations');

describe('validación de citas [n]', () => {
    it('conserva las citas que existen', () => {
        expect(validarCitas('El plan cuesta 29 € [1] y el token vive en Polygon [2].', 2)).toEqual({ text: 'El plan cuesta 29 € [1] y el token vive en Polygon [2].', eliminadas: [] });
    });
    it('quita la cita a una fuente inexistente', () => {
        const r = validarCitas('Según la documentación [3] y [1].', 2);
        expect(r.text).toBe('Según la documentación y [1].');
        expect(r.eliminadas).toEqual([3]);
    });
    it('quita [0] y con cero fuentes quita todas', () => {
        expect(validarCitas('a [0] b [1]', 0).text).toBe('a b');
    });
    it('no toca enlaces Markdown, definiciones ni código', () => {
        const t = 'Mira [9](/planes) y `x[5]` y\n```\ny[7]\n```\n[8]: /ruta';
        expect(validarCitas(t, 1).text).toBe(t);
    });
    it('entrada vacía o no string', () => {
        expect(validarCitas('', 2).text).toBe('');
        expect(validarCitas(null, 2).text).toBe('');
    });
});
