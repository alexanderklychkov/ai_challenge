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
    <aside className="hidden md:flex flex-col items-center w-[60px] border-r border-gray-200 bg-white">
      {/* Логотип */}
      <div className="w-full flex items-center justify-center h-16 border-b border-gray-200">
        <div className="text-2xl font-bold text-gray-800">&lt;/&gt;</div>
      </div>

      {/* Навигационные иконки */}
      <nav className="flex flex-col items-center w-full flex-1 pt-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              w-full flex flex-col items-center justify-center py-4 transition-all duration-200
              ${activeTab === item.id 
                ? 'bg-gray-100 text-gray-900' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }
            `}
            aria-label={item.label}
          >
            <span className="text-2xl">{item.icon}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
