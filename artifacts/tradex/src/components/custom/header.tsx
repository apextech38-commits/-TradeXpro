import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export function Header() {
  const { isAuthenticated, logout, account } = useAuth();
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-background">
      <Link to="/" className="font-bold text-xl tracking-tight">TradeX</Link>
      <nav className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <span className="text-sm text-muted-foreground">{account?.accountId}</span>
            <button onClick={logout} className="text-sm">Logout</button>
          </>
        ) : (
          <Link to="/login" className="text-sm">Login</Link>
        )}
      </nav>
    </header>
  );
}
export default Header;
