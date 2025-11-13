import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import type { Location } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { register as registerRequest } from '../services/auth';

export default function RegisterPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo =
    typeof location.state === 'object' && location.state && 'from' in location.state
      ? (location.state as { from?: Location }).from?.pathname ?? '/'
      : '/';

  if (!isLoading && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const identifier = username.trim() || phone.trim();
    if (!identifier) {
      setError('Введите имя или телефон');
      return;
    }
    if (!password.trim()) {
      setError('Введите пароль');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await registerRequest({
        username: identifier,
        password: password.trim(),
        phone_number: phone.trim() || undefined,
      });
      await login(identifier, password.trim());
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Регистрация не удалась';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-md border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Новый аккаунт</h1>
          <p className="text-sm text-muted-foreground">
            Имя или телефон, пароль — ничего лишнего. Можно начать сразу.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="username">Имя (если есть)</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isSubmitting}
              placeholder="Например astra_user"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Телефон (опционально)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={isSubmitting}
              placeholder="+7XXXXXXXXXX"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Создание...' : 'Зарегистрироваться'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
