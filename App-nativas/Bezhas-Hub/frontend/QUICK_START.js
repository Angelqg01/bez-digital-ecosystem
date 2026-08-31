// ============================================
// GUÍA DE INTEGRACIÓN RÁPIDA - BEZHAS WEB3
// Sistema de Diseño Light Mode (Pastel/Lavanda)
// ============================================

/*
  PASO 1: IMPORTAR EN TU APP PRINCIPAL (App.jsx o main.jsx)
*/

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importar página de demostración
import LightHomePage from './pages/LightHomePage';

// Otras páginas que quieras crear
// import MiPagina from './pages/MiPagina';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Página de inicio con diseño Light Mode */}
                <Route path="/" element={<LightHomePage />} />

                {/* Agrega más rutas aquí */}
                {/* <Route path="/mi-pagina" element={<MiPagina />} /> */}
            </Routes>
        </BrowserRouter>
    );
}

export default App;

/*
  PASO 2: CREAR TU PROPIA PÁGINA USANDO EL LAYOUT
*/

// Archivo: src/pages/MiPagina.jsx
import React from 'react';
import LightLayout from '../components/layout/LightLayout';
import { NFTCard, CardGrid } from '../components/cards/LightCards';

export default function MiPagina() {
    return (
        <LightLayout>
            {/* Tu contenido aquí */}
            <h1 className="text-4xl font-bold text-gradient mb-8">
                Mi Página Personalizada
            </h1>

            <CardGrid columns={4}>
                <NFTCard
                    image="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400"
                    title="Mi NFT"
                    creator="Mi Nombre"
                    price="2.5"
                    likes={150}
                    views={2500}
                    trending={true}
                    verified={true}
                    onClick={() => alert('NFT clickeado!')}
                />

                {/* Más cards aquí */}
            </CardGrid>
        </LightLayout>
    );
}

/*
  PASO 3: USAR COMPONENTES INDIVIDUALES
*/

// === HEADER ===
import LightHeader from './components/layout/LightHeader';

function MiHeader() {
    const [menuOpen, setMenuOpen] = React.useState(false);

    return (
        <LightHeader
            onMenuToggle={() => setMenuOpen(!menuOpen)}
            isMenuOpen={menuOpen}
        />
    );
}

// === SIDEBAR ===
import LightSidebar from './components/layout/LightSidebar';

function MiSidebar() {
    const [open, setOpen] = React.useState(false);

    return (
        <LightSidebar
            isOpen={open}
            onClose={() => setOpen(false)}
        />
    );
}

// === CARDS ===
import { NFTCard, CollectionCard, SimpleCard, CardGrid } from './components/cards/LightCards';

// NFT Card
function MiNFTCard() {
    return (
        <NFTCard
            image="url-de-imagen"
            title="Título del NFT"
            creator="Nombre del Creador"
            price="2.5"
            likes={100}
            views={500}
            trending={true}
            verified={true}
            onLike={() => console.log('Like!')}
            onAddToCart={() => console.log('Añadido al carrito')}
            onClick={() => console.log('Card clickeada')}
        />
    );
}

// Collection Card
function MiCollectionCard() {
    return (
        <CollectionCard
            banner="url-banner"
            avatar="url-avatar"
            name="Nombre Colección"
            creator="Creador"
            itemCount="10K"
            floorPrice="2.5 BZH"
            volume="45K BZH"
            verified={true}
            onClick={() => console.log('Colección clickeada')}
        />
    );
}

// Simple Card
function MiSimpleCard() {
    return (
        <SimpleCard
            image="url-imagen"
            title="Título"
            description="Descripción del contenido"
            tag="Nuevo"
            onClick={() => console.log('Card clickeada')}
        />
    );
}

/*
  PASO 4: USAR CLASES DE UTILIDAD PREDEFINIDAS
*/

function EjemplosDeEstilos() {
    return (
        <div>
            {/* Gradientes */}
            <div className="bg-gradient-light p-8 rounded-2xl">
                Fondo con gradiente light
            </div>

            <div className="bg-gradient-primary p-8 rounded-2xl">
                Fondo con gradiente primary
            </div>

            {/* Botones */}
            <button className="btn btn-primary">
                Botón Primario
            </button>

            <button className="btn btn-secondary">
                Botón Secundario
            </button>

            <button className="btn btn-outline">
                Botón Outline
            </button>

            {/* Cards */}
            <div className="card p-6">
                Card básica
            </div>

            <div className="card glass p-6">
                Card con efecto glass
            </div>

            {/* Inputs */}
            <input
                type="text"
                placeholder="Escribe aquí..."
                className="input"
            />

            {/* Texto con gradiente */}
            <h1 className="text-gradient">
                Texto con Gradiente
            </h1>

            {/* Animaciones */}
            <div className="animate-fade-in">
                Aparece con fade
            </div>

            <div className="animate-slide-up">
                Desliza hacia arriba
            </div>

            <div className="animate-scale-in">
                Escala al entrar
            </div>

            {/* Responsive */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1 col en móvil, 2 en tablet, 4 en desktop */}
            </div>

            {/* Dark mode support */}
            <div className="bg-white dark:bg-gray-800 text-text-primary dark:text-white">
                Soporta dark mode
            </div>
        </div>
    );
}

/*
  PASO 5: PERSONALIZAR COLORES (OPCIONAL)
*/

// Edita tailwind.config.js para cambiar la paleta:
/*
colors: {
  primary: {
    600: '#TU_COLOR_PERSONALIZADO',
  },
  accent: {
    500: '#TU_COLOR_ACENTO',
  }
}
*/

/*
  COLORES DISPONIBLES EN LA PALETA:

  Primary (Lavanda/Morado):
  - primary-50 a primary-900

  Accent (Rosa):
  - accent-50 a accent-600

  Sky (Azul):
  - sky-50 a sky-500

  Backgrounds:
  - light-bg, light-card, light-hover, light-border, light-muted

  Text:
  - text-primary, text-secondary, text-muted, text-accent

  USO:
  className="bg-primary-100 text-primary-600 border-primary-200"
  className="bg-accent-50 text-accent-500"
  className="bg-sky-100 text-sky-600"
*/

/*
  BREAKPOINTS RESPONSIVE:

  sm:  640px   (Tablet pequeña)
  md:  768px   (Tablet)
  lg:  1024px  (Desktop)
  xl:  1280px  (Desktop grande)
  2xl: 1536px  (Desktop XL)

  USO:
  className="text-sm md:text-base lg:text-lg"
  className="grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  className="p-4 md:p-6 lg:p-8"
*/

/*
  ✅ CHECKLIST DE INTEGRACIÓN:

  □ Importar LightHomePage o crear tu propia página
  □ Usar <LightLayout> para envolver tu contenido
  □ Usar componentes de Cards para mostrar contenido
  □ Aplicar clases de utilidad (btn, card, input, etc.)
  □ Verificar responsividad en móvil, tablet y desktop
  □ Probar dark mode (agregar clase 'dark' al <html>)
  □ Personalizar colores si es necesario
  □ Disfrutar del diseño hermoso! 🎉
*/

// ============================================
// Para más información, consulta:
// DESIGN_SYSTEM.md
// ============================================
