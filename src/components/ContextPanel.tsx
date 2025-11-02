const ContextPanel = () => {
  return (
    <aside className="hidden lg:flex flex-col w-[300px] border-l border-gray-200 bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Контекстная панель</h2>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-gray-500">
          <p className="text-sm">Правая панель</p>
          <p className="text-xs mt-2">Дополнительная информация</p>
        </div>
      </div>
    </aside>
  );
};

export default ContextPanel;
