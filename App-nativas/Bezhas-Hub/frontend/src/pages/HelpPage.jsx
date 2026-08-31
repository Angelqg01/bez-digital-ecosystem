import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import './HelpPage.css';

const FaqItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="faq-item">
      <button className="faq-question" onClick={() => setIsOpen(!isOpen)}>
        <span>{question}</span>
        <ChevronDown className={`chevron-icon ${isOpen ? 'open' : ''}`} />
      </button>
      {isOpen && (
        <div className="faq-answer">
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
};

const HelpPage = () => {
  const faqs = [
    {
      question: '¿Cómo conecto mi wallet?',
      answer: 'Para conectar tu wallet, haz clic en el botón "Conectar Wallet" en la esquina superior derecha de la página. Asegúrate de tener una extensión de wallet como MetaMask instalada en tu navegador.'
    },
    {
      question: '¿Qué es un perfil de usuario y cómo lo creo?',
      answer: 'Tu perfil de usuario es tu identidad en la plataforma. Para crearlo, ve a la página de Perfil después de conectar tu wallet y completa el formulario con tu nombre de usuario, biografía y foto de perfil.'
    },
    {
      question: '¿Cómo participo en las misiones?',
      answer: 'Ve a la página de Misiones, busca un desafío que te interese y haz clic en "Unirse al Desafío". Una vez que cumplas los requisitos, el sistema registrará tu progreso.'
    },
    {
      question: '¿Cómo puedo vender un NFT en el marketplace?',
      answer: 'Para vender un NFT, ve a la Tienda y haz clic en "Listar Artículo". Deberás proporcionar la dirección del contrato del NFT y el ID del token que deseas vender, junto con otros detalles como el precio.'
    },
    {
      question: '¿Cómo funcionan los foros?',
      answer: 'En la página de Foros, puedes crear nuevos hilos de discusión o participar en los existentes. Para responder a un hilo, simplemente ve a la página del hilo y usa el formulario de respuesta en la parte inferior.'
    }
  ];

  return (
    <div className="help-page">
      <header className="help-header">
        <h1><HelpCircle size={28} /> Centro de Ayuda</h1>
        <p>Encuentra respuestas a las preguntas más comunes sobre BeZhas.</p>
      </header>

      <div className="faq-container">
        {faqs.map((faq, index) => (
          <FaqItem key={index} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </div>
  );
};

export default HelpPage;
