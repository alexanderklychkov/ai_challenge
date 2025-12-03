import { HelpCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export function SupportButton() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Скрываем кнопку на странице поддержки
  const isSupportPage = location.pathname.startsWith('/support');
  
  if (isSupportPage) {
    return null;
  }

  const handleClick = () => {
    navigate('/support');
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white shadow-[0_4px_20px_rgba(0,102,255,0.4)] hover:shadow-[0_6px_30px_rgba(0,102,255,0.6)] hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group"
      aria-label="Поддержка"
      title="Поддержка"
      style={{
        animation: 'fadeInUp 0.5s ease-out',
      }}
    >
      <HelpCircle className="w-7 h-7 transition-transform group-hover:rotate-12" />
      {/* Эффект пульсации */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#0066ff] to-[#8000cc] opacity-75 animate-ping"></div>
    </button>
  );
}

