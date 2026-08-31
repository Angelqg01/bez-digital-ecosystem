import React from 'react';
import bezTokenImage from '../../assets/bez_token.png';

/**
 * BezCoinLoader - Animated 3D spinning coin loader
 * The coin rotates on its vertical axis in sync with page loading
 * 
 * @param {string} size - Size variant: 'sm', 'md', 'lg', 'xl'
 * @param {string} text - Optional loading text to display
 * @param {boolean} showProgress - Whether to show a progress indicator
 */

const sizeConfig = {
    sm: { coin: 'w-8 h-8', text: 'text-xs', container: 'gap-2' },
    md: { coin: 'w-12 h-12', text: 'text-sm', container: 'gap-3' },
    lg: { coin: 'w-20 h-20', text: 'text-base', container: 'gap-4' },
    xl: { coin: 'w-32 h-32', text: 'text-lg', container: 'gap-5' },
};

export const BezCoinLoader = ({
    size = 'lg',
    text = 'Cargando...',
    showProgress = true,
    fullScreen = false
}) => {
    const config = sizeConfig[size] || sizeConfig.lg;

    const containerClasses = fullScreen
        ? 'fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/50 to-gray-900'
        : `w-full h-full min-h-[200px] flex items-center justify-center ${config.container}`;

    return (
        <div className={containerClasses}>
            <div className={`flex flex-col items-center justify-center ${config.container}`}>
                {/* 3D Coin Container */}
                <div className="relative">
                    {/* Glow effect */}
                    <div
                        className={`absolute inset-0 ${config.coin} rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 blur-xl opacity-50 animate-pulse`}
                        style={{ animationDuration: '2s' }}
                    />

                    {/* Coin with 3D rotation */}
                    <div
                        className={`relative ${config.coin} bez-coin-spin`}
                        style={{
                            perspective: '1000px',
                            transformStyle: 'preserve-3d',
                        }}
                    >
                        <img
                            src={bezTokenImage}
                            alt="BEZ Token"
                            className={`${config.coin} rounded-full object-cover drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]`}
                            style={{
                                backfaceVisibility: 'visible',
                            }}
                        />
                    </div>

                    {/* Orbiting particles */}
                    <div className="absolute inset-0 bez-orbit">
                        <div className="absolute top-0 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-2 bg-yellow-400 rounded-full blur-[1px]" />
                    </div>
                    <div className="absolute inset-0 bez-orbit-reverse" style={{ animationDelay: '-0.5s' }}>
                        <div className="absolute bottom-0 left-1/2 w-1 h-1 -translate-x-1/2 translate-y-2 bg-amber-300 rounded-full blur-[1px]" />
                    </div>
                </div>

                {/* Loading text */}
                {text && (
                    <p className={`${config.text} text-gray-300 font-medium animate-pulse`}>
                        {text}
                    </p>
                )}

                {/* Progress bar */}
                {showProgress && (
                    <div className="w-32 h-1 bg-gray-700/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 rounded-full bez-progress"
                        />
                    </div>
                )}
            </div>

            {/* CSS Animations */}
            <style>{`
        @keyframes coinSpin {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(360deg);
          }
        }

        @keyframes orbit {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes orbitReverse {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }

        @keyframes progressSlide {
          0% {
            transform: translateX(-100%);
            width: 30%;
          }
          50% {
            width: 60%;
          }
          100% {
            transform: translateX(400%);
            width: 30%;
          }
        }

        .bez-coin-spin {
          animation: coinSpin 1.5s ease-in-out infinite;
          transform-style: preserve-3d;
        }

        .bez-orbit {
          animation: orbit 3s linear infinite;
        }

        .bez-orbit-reverse {
          animation: orbitReverse 2s linear infinite;
        }

        .bez-progress {
          animation: progressSlide 1.5s ease-in-out infinite;
        }
      `}</style>
        </div>
    );
};

/**
 * BezCoinLoaderFullScreen - Full screen version for initial app loading
 */
export const BezCoinLoaderFullScreen = ({ text = 'Cargando BeZhas...' }) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
            }}
        >
            <div className="flex flex-col items-center gap-6">
                {/* Main coin container */}
                <div className="relative">
                    {/* Outer glow ring */}
                    <div
                        className="absolute -inset-8 rounded-full opacity-30"
                        style={{
                            background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)',
                            animation: 'pulse 2s ease-in-out infinite',
                        }}
                    />

                    {/* Inner glow */}
                    <div
                        className="absolute -inset-4 rounded-full bg-gradient-to-r from-yellow-400/20 via-amber-500/30 to-yellow-400/20 blur-2xl"
                        style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                    />

                    {/* The spinning coin */}
                    <div
                        className="relative w-24 h-24 bez-coin-spin-smooth"
                        style={{
                            transformStyle: 'preserve-3d',
                        }}
                    >
                        <img
                            src={bezTokenImage}
                            alt="BEZ Token"
                            className="w-24 h-24 rounded-full object-cover"
                            style={{
                                boxShadow: '0 0 30px rgba(251,191,36,0.5), 0 0 60px rgba(251,191,36,0.3)',
                                backfaceVisibility: 'visible',
                            }}
                        />
                    </div>

                    {/* Orbiting sparkles */}
                    <div className="absolute inset-0 bez-orbit" style={{ animationDuration: '4s' }}>
                        <div className="absolute -top-3 left-1/2 w-2 h-2 -translate-x-1/2 bg-yellow-300 rounded-full shadow-[0_0_10px_rgba(253,224,71,0.8)]" />
                    </div>
                    <div className="absolute inset-0 bez-orbit-reverse" style={{ animationDuration: '3s' }}>
                        <div className="absolute -bottom-3 left-1/2 w-1.5 h-1.5 -translate-x-1/2 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                    </div>
                    <div className="absolute inset-0 bez-orbit" style={{ animationDuration: '5s', animationDelay: '-1s' }}>
                        <div className="absolute top-1/2 -right-3 w-1 h-1 -translate-y-1/2 bg-yellow-200 rounded-full shadow-[0_0_6px_rgba(254,240,138,0.8)]" />
                    </div>
                </div>

                {/* Brand name */}
                <div className="text-center">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 bg-clip-text text-transparent">
                        BeZhas
                    </h1>
                    <p className="text-gray-400 text-sm mt-1 animate-pulse">
                        {text}
                    </p>
                </div>

                {/* Progress bar */}
                <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden shadow-inner">
                    <div
                        className="h-full rounded-full bez-progress"
                        style={{
                            background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24)',
                        }}
                    />
                </div>
            </div>

            {/* Enhanced CSS */}
            <style>{`
        @keyframes coinSpinSmooth {
          0% {
            transform: rotateY(0deg) scale(1);
          }
          25% {
            transform: rotateY(90deg) scale(0.95);
          }
          50% {
            transform: rotateY(180deg) scale(1);
          }
          75% {
            transform: rotateY(270deg) scale(0.95);
          }
          100% {
            transform: rotateY(360deg) scale(1);
          }
        }

        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes orbitReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes progressSlide {
          0% {
            transform: translateX(-100%);
            width: 30%;
          }
          50% {
            width: 50%;
          }
          100% {
            transform: translateX(400%);
            width: 30%;
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }

        .bez-coin-spin-smooth {
          animation: coinSpinSmooth 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          transform-style: preserve-3d;
        }

        .bez-coin-spin {
          animation: coinSpinSmooth 1.5s ease-in-out infinite;
          transform-style: preserve-3d;
        }

        .bez-orbit {
          animation: orbit 3s linear infinite;
        }

        .bez-orbit-reverse {
          animation: orbitReverse 2.5s linear infinite;
        }

        .bez-progress {
          animation: progressSlide 1.8s ease-in-out infinite;
        }
      `}</style>
        </div>
    );
};

export default BezCoinLoader;
