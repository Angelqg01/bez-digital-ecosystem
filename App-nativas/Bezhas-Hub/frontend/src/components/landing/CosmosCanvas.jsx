import { useEffect, useRef } from 'react';

const CosmosCanvas = () => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
    const particlesRef = useRef([]);
    const nodesRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const COUNT = 1200;
        const NODES = 30;

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };

        // Proyección 3D con movimiento LENTO
        const project3D = (x, y, z) => {
            const cx = width / 2;
            const cy = height / 2;
            const mouse = mouseRef.current;

            mouse.x += (mouse.tx - mouse.x) * 0.02;
            mouse.y += (mouse.ty - mouse.y) * 0.02;

            const ax = 0.5 + (mouse.y * 0.05);
            const ay = mouse.x * 0.05;

            const cx_cos = Math.cos(ax);
            const cx_sin = Math.sin(ax);
            const cy_cos = Math.cos(ay);
            const cy_sin = Math.sin(ay);

            let rx = x * cy_cos - z * cy_sin;
            let rz = x * cy_sin + z * cy_cos;
            let ry = y * cx_cos - rz * cx_sin;
            let fz = y * cx_sin + rz * cx_cos;

            const perspective = 1000 / (1000 + fz);
            return { x: cx + rx * perspective, y: cy + ry * perspective, s: perspective, z: fz };
        };

        class Star {
            constructor(isNode) {
                this.isNode = isNode;
                this.colorPhase = Math.random() * 360;
                this.reset();
            }

            reset() {
                this.theta = Math.random() * Math.PI * 2;
                this.phi = Math.random() * Math.PI * 2;
                this.rad = Math.random() * 150;
                this.R = 350;
                this.speed = (Math.random() * 0.0005) + 0.0002;
            }

            update() {
                this.theta += this.speed;
                this.phi += 0.002;
                const r = this.R + this.rad * Math.cos(this.phi);
                this.x = r * Math.cos(this.theta);
                this.y = r * Math.sin(this.theta);
                this.z = this.rad * Math.sin(this.phi);
                this.colorPhase += 0.5;
            }

            draw() {
                const p = project3D(this.x, this.y, this.z);
                if (p.s < 0) return;

                const hue = (this.colorPhase + (this.x * 0.1)) % 360;
                const alpha = Math.min(1, p.s * 0.8);

                ctx.fillStyle = `hsla(${hue}, 80%, 75%, ${alpha})`;

                const size = (this.isNode ? 2.5 : 1) * p.s;
                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const initCosmos = () => {
            particlesRef.current = [];
            nodesRef.current = [];

            for (let i = 0; i < COUNT; i++) {
                particlesRef.current.push(new Star(false));
            }
            for (let i = 0; i < NODES; i++) {
                nodesRef.current.push(new Star(true));
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'lighter';

            // Glow Central
            const center = project3D(0, 0, 0);
            const g = ctx.createRadialGradient(center.x, center.y, 10 * center.s, center.x, center.y, 250 * center.s);
            g.addColorStop(0, 'rgba(0,0,0,1)');
            g.addColorStop(0.2, 'rgba(139, 92, 246, 0.15)');
            g.addColorStop(0.5, 'rgba(6, 182, 212, 0.05)');
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(center.x, center.y, 250 * center.s, 0, Math.PI * 2);
            ctx.fill();

            // Render Stars
            particlesRef.current.forEach(p => {
                p.update();
                p.draw();
            });

            // Render Connections
            ctx.lineWidth = 0.5;
            nodesRef.current.forEach((n, i) => {
                n.update();
                n.draw();
                for (let j = i + 1; j < nodesRef.current.length; j++) {
                    const n2 = nodesRef.current[j];
                    const d = Math.sqrt((n.x - n2.x) ** 2 + (n.y - n2.y) ** 2 + (n.z - n2.z) ** 2);
                    if (d < 100) {
                        const p1 = project3D(n.x, n.y, n.z);
                        const p2 = project3D(n2.x, n2.y, n2.z);
                        ctx.strokeStyle = `rgba(150, 220, 255, ${(1 - d / 100) * 0.2})`;
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            });

            ctx.globalCompositeOperation = 'source-over';
            animationRef.current = requestAnimationFrame(animate);
        };

        const handleResize = () => resize();
        const handleMouseMove = (e) => {
            mouseRef.current.tx = (e.clientX / width - 0.5) * 2;
            mouseRef.current.ty = (e.clientY / height - 0.5) * 2;
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);

        initCosmos();
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed top-0 left-0 w-full h-full -z-10"
            style={{ background: '#000000' }}
        />
    );
};

export default CosmosCanvas;
