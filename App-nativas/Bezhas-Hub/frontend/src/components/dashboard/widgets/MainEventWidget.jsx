import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Users, Award } from 'lucide-react';

const MainEventWidget = () => {
  // Estado para el evento actual
  const [currentEvent, setCurrentEvent] = useState({
    title: 'Evento Especial de Staking',
    description: 'Participa en nuestro evento de staking y gana recompensas exclusivas',
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 días desde ahora
    totalParticipants: 0,
    maxParticipants: 1000,
    image: 'https://i.imgur.com/s1Y3aE7.jpeg',
    cta: {
      text: 'Participar Ahora',
      link: '/staking'
    }
  });

  // Estado para el contador
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Estado para el progreso de participación
  const [progress, setProgress] = useState(0);

  // Efecto para el contador
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = currentEvent.endDate - now;

      if (distance < 0) {
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });

      // Actualizar progreso (simulado)
      const newProgress = Math.min(
        (currentEvent.totalParticipants / currentEvent.maxParticipants) * 100,
        100
      );
      setProgress(newProgress);
    }, 1000);

    return () => clearInterval(timer);
  }, [currentEvent]);

  // Formatear el contador
  const formatTime = (time) => {
    return time < 10 ? `0${time}` : time;
  };

  return (
    <div 
      className="relative rounded-3xl p-6 md:p-8 lg:p-12 min-h-[320px] flex flex-col justify-between overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${currentEvent.image}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white leading-tight">
              {currentEvent.title}
            </h2>
            <p className="mt-2 text-gray-300 max-w-2xl">
              {currentEvent.description}
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl text-center min-w-[180px]">
            <div className="text-xs text-gray-300 mb-1 flex items-center justify-center">
              <Clock className="w-4 h-4 mr-1" /> Tiempo restante
            </div>
            <div className="text-2xl font-bold text-white">
              {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-300 mb-1">
            <span>Progreso del evento</span>
            <span>{Math.round(progress)}% completado</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{currentEvent.totalParticipants} participantes</span>
            <span>Meta: {currentEvent.maxParticipants}</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-6 flex flex-col sm:flex-row gap-4">
        <Link 
          to={currentEvent.cta.link} 
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-full inline-flex items-center justify-center transition-all"
        >
          <span>{currentEvent.cta.text}</span>
          <ArrowRight className="ml-2 w-4 h-4" />
        </Link>
        
        <div className="flex items-center text-sm text-gray-300 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
          <Award className="w-4 h-4 mr-2 text-yellow-400" />
          <span>Recompensas exclusivas</span>
        </div>
      </div>
    </div>
  );
};

export default MainEventWidget;
