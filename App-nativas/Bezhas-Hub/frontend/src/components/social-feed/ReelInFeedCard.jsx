import React, { useRef, useState } from 'react';
import { Play, Volume2, VolumeX, Heart, MessageCircle, Share2 } from 'lucide-react';

const ReelInFeedCard = ({ reel }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef(null);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = (e) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    return (
        <div className="bg-black rounded-xl overflow-hidden mb-6 relative aspect-[9/16] md:aspect-video group">
            <video
                ref={videoRef}
                src={reel?.videoUrl || "https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4"}
                className="w-full h-full object-cover"
                loop
                playsInline
                onClick={togglePlay}
            />

            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play size={32} className="text-white fill-white ml-1" />
                    </div>
                </div>
            )}

            {/* Overlay Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex justify-between items-end">
                    <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                                <img
                                    src={reel?.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reel?.userId || 'User'}`}
                                    alt="User"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <span className="text-white font-medium text-sm">{reel?.username || 'Creator'}</span>
                            <button className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-full transition-colors">
                                Follow
                            </button>
                        </div>
                        <p className="text-white text-sm line-clamp-2">{reel?.caption || 'Check out this awesome video! #viral #trending'}</p>
                    </div>

                    <div className="flex flex-col items-center space-y-4 ml-4">
                        <button className="flex flex-col items-center space-y-1 group">
                            <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                                <Heart size={24} className="text-white" />
                            </div>
                            <span className="text-xs text-white">{reel?.likes || '1.2k'}</span>
                        </button>

                        <button className="flex flex-col items-center space-y-1 group">
                            <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                                <MessageCircle size={24} className="text-white" />
                            </div>
                            <span className="text-xs text-white">{reel?.comments || '234'}</span>
                        </button>

                        <button className="flex flex-col items-center space-y-1 group">
                            <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                                <Share2 size={24} className="text-white" />
                            </div>
                            <span className="text-xs text-white">Share</span>
                        </button>
                    </div>
                </div>
            </div>

            <button
                onClick={toggleMute}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
        </div>
    );
};

export default ReelInFeedCard;
