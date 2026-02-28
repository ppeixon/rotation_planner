"use client";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Dashboard } from "@/components/Dashboard";
import { Button } from "@/components/ui/button";
import { Calendar, ShieldCheck, Globe, Zap } from "lucide-react";

function HomePage() {
  const { user, loading, login } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center font-body">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-12 items-center">
        <div className="text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold text-xs uppercase tracking-wider">
            <Zap className="w-3 h-3" /> Exclusivo para Argelia
          </div>
          <h1 className="text-5xl md:text-6xl font-headline font-bold tracking-tight text-foreground leading-tight">
            Tus Rotaciones <span className="text-primary underline decoration-primary/20">Simplificadas.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Gestiona tus bloques de 28 días, vuelos y vacaciones en tiempo real. Accede desde cualquier lugar y sincroniza tus planes con la nube.
          </p>
          
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="flex flex-col gap-1">
               <ShieldCheck className="w-5 h-5 text-primary" />
               <h4 className="font-bold text-sm">Privacidad Total</h4>
               <p className="text-xs text-muted-foreground">Solo tú puedes acceder a tus datos.</p>
            </div>
            <div className="flex flex-col gap-1">
               <Globe className="w-5 h-5 text-primary" />
               <h4 className="font-bold text-sm">Multi-dispositivo</h4>
               <p className="text-xs text-muted-foreground">Sincronización instantánea en móvil y web.</p>
            </div>
          </div>

          <div className="pt-6">
            <Button size="lg" className="px-10 h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform" onClick={() => login()}>
              Iniciar con Google
            </Button>
            <p className="text-xs text-muted-foreground mt-4 italic">
              * El acceso está restringido únicamente a usuarios autorizados.
            </p>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-4 bg-gradient-to-tr from-primary to-accent opacity-20 blur-2xl rounded-3xl group-hover:opacity-30 transition-opacity"></div>
          <div className="relative bg-white dark:bg-zinc-900 border rounded-3xl overflow-hidden shadow-2xl p-6 transform rotate-1 group-hover:rotate-0 transition-transform">
             <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="text-xs font-bold text-muted-foreground uppercase">Vista Mensual - Marzo 2026</div>
             </div>
             <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold ${
                      i >= 7 && i <= 21 ? 'bg-[#FF8C00] text-white' : 
                      i === 22 || i === 23 ? 'bg-[#3CB371] text-white' :
                      'bg-slate-100 dark:bg-zinc-800'
                    }`}
                  >
                    {i % 31 + 1}
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HomePage />
    </AuthProvider>
  );
}