import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Code } from 'lucide-react';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Валидация
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    setLoading(true);

    try {
      await register(email, password, name);
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
      {/* Фоновые эффекты */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00f0ff] opacity-10 rounded-full blur-3xl animate-slow-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#b026ff] opacity-10 rounded-full blur-3xl animate-slow-pulse" style={{ animationDelay: '1.5s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-[#151520]/80 backdrop-blur-xl border border-[#2a2a3a] rounded-2xl p-8 shadow-2xl">
          {/* Градиентная линия сверху */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent rounded-t-2xl"></div>
          
          {/* Логотип */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-[#0066ff] to-[#8000cc] rounded-xl">
                <Code className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">AI Mentor</h1>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-white mb-6 text-center">Регистрация</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#a0a0b0] mb-2">
                Имя
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-white placeholder-[#606070] focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-colors"
                placeholder="Ваше имя"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#a0a0b0] mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-white placeholder-[#606070] focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-colors"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#a0a0b0] mb-2">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-white placeholder-[#606070] focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-colors"
                placeholder="Минимум 6 символов"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#a0a0b0] mb-2">
                Подтвердите пароль
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg text-white placeholder-[#606070] focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-colors"
                placeholder="Повторите пароль"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white font-medium rounded-lg hover:from-[#0055ff] hover:to-[#7000bb] transition-all shadow-[0_0_20px_rgba(0,102,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#a0a0b0]">
              Уже есть аккаунт?{' '}
              <Link
                to="/login"
                className="text-[#00f0ff] hover:text-[#00d0ff] font-medium transition-colors"
              >
                Войти
              </Link>
            </p>
          </div>

          {/* Градиентная линия снизу */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#b026ff] to-transparent rounded-b-2xl"></div>
        </div>
      </div>
    </div>
  );
}

