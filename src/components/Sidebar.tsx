import { ActiveTab } from '../App';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
  const navItems = [
    { id: 'chat' as const, icon: '💬', label: 'Чат' },
    { id: 'knowledge' as const, icon: '📚', label: 'База знаний' },
    { id: 'settings' as const, icon: '⚙️', label: 'Настройки' },
  ];

  return (
    <aside className="hidden md:flex flex-col items-center w-[70px] border-r border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl relative">
      {/* Градиентная линия сверху */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
      
      {/* Логотип */}
      <div className="w-full flex items-center justify-center h-16 border-b border-[#2a2a3a] relative group">
        <div className="text-2xl font-bold gradient-text relative z-10">&lt;/&gt;</div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#00f0ff]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>

      {/* Навигационные иконки */}
      <nav className="flex flex-col items-center w-full flex-1 pt-4 gap-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              group relative w-full flex flex-col items-center justify-center py-4 transition-all duration-300 cursor-pointer
              ${activeTab === item.id 
                ? 'text-[#00f0ff]' 
                : 'text-[#a0a0b0] hover:text-[#e0e0e8]'
              }
            `}
            aria-label={item.label}
          >
            {/* Активный индикатор */}
            {activeTab === item.id && (
              <>
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#00f0ff] to-[#b026ff] rounded-r-full"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-[#00f0ff]/10 to-transparent rounded-lg"></div>
              </>
            )}
            
            <span className={`text-2xl relative z-10 transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-105'}`}>
              {item.icon}
            </span>
            
            {/* Эффект свечения при наведении */}
            <div className={`absolute inset-0 rounded-lg transition-opacity duration-300 ${
              activeTab === item.id 
                ? 'opacity-100 bg-[#00f0ff]/10 shadow-[0_0_20px_rgba(0,240,255,0.3)]' 
                : 'opacity-0 group-hover:opacity-100 bg-[#00f0ff]/5'
            }`}></div>
          </button>
        ))}
      </nav>
      
      {/* Градиентная линия снизу */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#b026ff] to-transparent"></div>
    </aside>
  );
};

export default Sidebar;
