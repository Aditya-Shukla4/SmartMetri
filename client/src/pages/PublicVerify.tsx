import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../services/api';
import { apiErrorMessage } from '../types';

type VerificationResult = { status: string; certificate?: Record<string, unknown> };

export default function PublicVerify() {
  const { certificateNumber } = useParams<{ certificateNumber: string }>();
  const [number, setNumber] = useState(certificateNumber || '');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const verify = async (event?: FormEvent, targetNumber?: string) => {
    if (event) event.preventDefault();
    const numToVerify = targetNumber || number;
    if (!numToVerify) return;
    setLoading(true); setError(''); setResult(null);
    try { setResult((await apiClient.get(`/public/verify/${encodeURIComponent(numToVerify.trim())}`)).data); }
    catch (err: unknown) { setError(apiErrorMessage(err, 'Verification service unavailable.')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (certificateNumber) {
      void verify(undefined, certificateNumber);
    }
  }, [certificateNumber]);
  return <div className="min-h-screen bg-industrial-bg text-industrial-border font-sans p-4 md:p-10 flex justify-center">
    <main className="w-full max-w-2xl">
      <p className="font-mono text-sm text-industrial-accent mb-2">SMARTMETRI / PUBLIC SERVICE</p>
      <h1 className="text-4xl font-bold uppercase border-b-2 border-industrial-border pb-4">Certificate Verification</h1>
      <form onSubmit={verify} className="mt-8 flex gap-3">
        <input required value={number} onChange={e => setNumber(e.target.value)} className="flex-1 border-2 border-industrial-border bg-industrial-surface p-3 font-mono" placeholder="Enter certificate number" />
        <button disabled={loading} className="border-2 border-industrial-border bg-industrial-border text-industrial-bg px-5 font-bold uppercase">{loading ? 'Checking' : 'Verify'}</button>
      </form>
      {error && <p className="mt-6 border-2 border-red-600 p-4 text-red-700 font-bold">{error}</p>}
      {result && <section className={`mt-8 border-2 p-6 ${result.status === 'VALID' ? 'border-green-700' : 'border-red-700'}`}>
        <p className="font-mono text-sm">VERIFICATION RESULT</p><h2 className="text-3xl font-bold mt-1">{result.status} CERTIFICATE</h2>
        {result.certificate && <dl className="mt-6 grid grid-cols-2 gap-3 font-mono text-sm">{Object.entries(result.certificate).map(([key, value]) => <div key={key}><dt className="opacity-60 uppercase">{key}</dt><dd className="font-bold">{String(value)}</dd></div>)}</dl>}
      </section>}
    </main>
  </div>;
}
