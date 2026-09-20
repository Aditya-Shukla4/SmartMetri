import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiServices } from '../services/api';

type ApiError = { response?: { data?: { message?: string } } };

export default function BusinessRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (form.password.length < 8) return setError('Password must contain at least 8 characters.');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await apiServices.register({ name: form.name.trim(), email: form.email.trim(), password: form.password, phone: form.phone.trim() || undefined, role: 'BUSINESS' });
      setSuccess('Business account created. Redirecting to login…');
      window.setTimeout(() => navigate('/login'), 800);
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.response?.data?.message || 'Registration failed. Please check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="min-h-screen bg-industrial-bg text-industrial-border font-sans flex items-center justify-center p-4"><section className="border-2 border-industrial-border bg-industrial-surface p-8 max-w-lg w-full"><h1 className="text-3xl font-bold tracking-tight uppercase mb-2 border-b-2 border-industrial-border pb-2">Business Registration</h1><p className="font-mono text-sm mb-6 text-industrial-accent">[ CREATE BUSINESS ACCESS ]</p>{error && <div role="alert" className="bg-red-900/20 border-2 border-red-500 text-red-500 p-2 font-mono text-sm font-bold mb-4">{error}</div>}{success && <div role="status" className="bg-green-900/20 border-2 border-green-600 text-green-700 p-2 font-mono text-sm font-bold mb-4">{success}</div>}<form onSubmit={submit} className="flex flex-col gap-4 font-mono"><label className="flex flex-col gap-1 font-bold">BUSINESS / CONTACT NAME<input required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className="border-2 border-industrial-border bg-transparent p-2 font-normal" /></label><label className="flex flex-col gap-1 font-bold">EMAIL<input required type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className="border-2 border-industrial-border bg-transparent p-2 font-normal" /></label><label className="flex flex-col gap-1 font-bold">PHONE <span className="font-normal text-xs">(OPTIONAL)</span><input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className="border-2 border-industrial-border bg-transparent p-2 font-normal" /></label><label className="flex flex-col gap-1 font-bold">PASSWORD<input required minLength={8} type="password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} className="border-2 border-industrial-border bg-transparent p-2 font-normal" /></label><label className="flex flex-col gap-1 font-bold">CONFIRM PASSWORD<input required minLength={8} type="password" value={form.confirmPassword} onChange={event => setForm(current => ({ ...current, confirmPassword: event.target.value }))} className="border-2 border-industrial-border bg-transparent p-2 font-normal" /></label><button type="submit" disabled={loading} className="border-2 border-industrial-border bg-industrial-border text-industrial-bg font-bold py-3 uppercase disabled:opacity-50">{loading ? '[ CREATING ACCOUNT... ]' : '[ REGISTER BUSINESS ]'}</button></form><p className="font-mono text-sm mt-6">Already registered? <Link className="text-industrial-accent font-bold underline" to="/login">Return to login</Link></p></section></main>;
}
