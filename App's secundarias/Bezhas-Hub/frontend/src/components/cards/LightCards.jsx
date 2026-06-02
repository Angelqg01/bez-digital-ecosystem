import React from 'react';
import { Heart, ShoppingCart, Eye, TrendingUp, Verified } from 'lucide-react';

/**
 * NFT CARD COMPONENT - Light Mode Design
 * Card reutilizable para mostrar NFTs, colecciones, productos, etc.
 * Inspirado en el diseño de cards de BeZhas (estilo libro/tile)
 */

export function NFTCard({
    image,
    title,
    creator,
    price,
    likes = 0,
    views = 0,
    trending = false,
    verified = false,
    onLike,
    onAddToCart,
    onClick
}) {
    return (
        <div
            className="group card card-interactive bg-white dark:bg-gray-800 overflow-hidden animate-scale-in"
            onClick={onClick}
        >
            {/* === IMAGE CONTAINER === */}
            <div className="relative aspect-[3/4] overflow-hidden bg-gradient-card">
                <img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                />

                {/* Overlay con acciones (aparece en hover) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute top-3 right-3 flex gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onLike?.();
                            }}
                            className="p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-soft"
                        >
                            <Heart className="w-4 h-4 text-accent-500 hover:fill-accent-500 transition-colors" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddToCart?.();
                            }}
                            className="p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-soft"
                        >
                            <ShoppingCart className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </button>
                    </div>

                    {/* Stats en hover */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 text-white text-sm">
                        <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            <span>{views}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Heart className="w-4 h-4" />
                            <span>{likes}</span>
                        </div>
                    </div>
                </div>

                {/* Badges */}
                <div className="absolute top-3 left-3 flex gap-2">
                    {trending && (
                        <span className="px-2 py-1 bg-accent-500 text-white text-xs font-semibold rounded-lg shadow-soft flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Trending
                        </span>
                    )}
                </div>
            </div>

            {/* === CONTENT === */}
            <div className="p-4 space-y-3">
                {/* Title */}
                <h3 className="font-semibold text-text-primary dark:text-white line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {title}
                </h3>

                {/* Creator */}
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-primary rounded-full" />
                    <span className="text-sm text-text-secondary dark:text-gray-400 flex items-center gap-1">
                        {creator}
                        {verified && (
                            <Verified className="w-3 h-3 text-sky-500 fill-sky-500" />
                        )}
                    </span>
                </div>

                {/* Price & Action */}
                <div className="flex items-center justify-between pt-2 border-t border-primary-100 dark:border-gray-700">
                    <div>
                        <p className="text-xs text-text-muted">Precio</p>
                        <p className="text-lg font-bold text-gradient">
                            {price} BZH
                        </p>
                    </div>
                    <button className="px-4 py-2 bg-gradient-primary text-white rounded-lg font-semibold text-sm hover:shadow-glow transition-shadow">
                        Comprar
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * COLLECTION CARD - Para mostrar colecciones
 */
export function CollectionCard({
    banner,
    avatar,
    name,
    creator,
    itemCount,
    floorPrice,
    volume,
    verified = false,
    onClick
}) {
    return (
        <div
            className="group card card-interactive bg-white dark:bg-gray-800 overflow-hidden animate-scale-in"
            onClick={onClick}
        >
            {/* Banner */}
            <div className="relative h-32 overflow-hidden bg-gradient-hero">
                <img
                    src={banner}
                    alt={name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
            </div>

            {/* Avatar (overlapping) */}
            <div className="px-4 -mt-8 relative z-10">
                <div className="w-16 h-16 rounded-xl border-4 border-white dark:border-gray-800 overflow-hidden shadow-card">
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                </div>
            </div>

            {/* Content */}
            <div className="p-4 pt-3 space-y-3">
                <div>
                    <h3 className="font-semibold text-lg text-text-primary dark:text-white flex items-center gap-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {name}
                        {verified && (
                            <Verified className="w-4 h-4 text-sky-500 fill-sky-500" />
                        )}
                    </h3>
                    <p className="text-sm text-text-secondary dark:text-gray-400">
                        por {creator}
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-primary-100 dark:border-gray-700">
                    <div>
                        <p className="text-xs text-text-muted">Items</p>
                        <p className="font-semibold text-text-primary dark:text-white">{itemCount}</p>
                    </div>
                    <div>
                        <p className="text-xs text-text-muted">Floor</p>
                        <p className="font-semibold text-primary-600 dark:text-primary-400">{floorPrice}</p>
                    </div>
                    <div>
                        <p className="text-xs text-text-muted">Volumen</p>
                        <p className="font-semibold text-text-primary dark:text-white">{volume}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * SIMPLE CARD - Card genérico para cualquier contenido
 */
export function SimpleCard({
    image,
    title,
    description,
    tag,
    onClick
}) {
    return (
        <div
            className="card card-interactive bg-white dark:bg-gray-800 overflow-hidden animate-scale-in"
            onClick={onClick}
        >
            {image && (
                <div className="relative aspect-video overflow-hidden bg-gradient-card">
                    <img
                        src={image}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    {tag && (
                        <span className="absolute top-3 left-3 px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-lg shadow-soft">
                            {tag}
                        </span>
                    )}
                </div>
            )}

            <div className="p-4 space-y-2">
                <h3 className="font-semibold text-text-primary dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {title}
                </h3>
                {description && (
                    <p className="text-sm text-text-secondary dark:text-gray-400 line-clamp-2">
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * GRID CONTAINER - Container responsivo para cards
 */
export function CardGrid({ children, columns = 4 }) {
    const gridClasses = {
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
    };

    return (
        <div className={`grid ${gridClasses[columns]} gap-4 md:gap-6`}>
            {children}
        </div>
    );
}
