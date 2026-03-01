
"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Dashboard } from "@/components/Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Lock } from "lucide-react";

function HomePage() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await login(email, password);
    setIsSubmitting(false);
  };

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
          <h1 className="text-5xl md:text-6xl font-headline font-bold tracking-tight text-foreground leading-tight">
            Calendario de Rotaciones <span className="text-primary underline decoration-primary/20">Simplificado.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Herramienta para la gestión del calendario de rotación, viajes y vacaciones. Información en la nube vía web app.
          </p>
          
          <div className="grid grid-cols-1 gap-4 pt-4">
            <div className="flex flex-col gap-1">
               <Globe className="w-5 h-5 text-primary" />
               <h4 className="font-bold text-sm">Multi-dispositivo</h4>
               <p className="text-xs text-muted-foreground">Sincronización instantánea en móvil y web.</p>
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-4 bg-gradient-to-tr from-primary to-accent opacity-20 blur-2xl rounded-3xl group-hover:opacity-30 transition-opacity"></div>
          <div className="relative bg-white dark:bg-zinc-900 border rounded-3xl overflow-hidden shadow-2xl p-8 transition-transform">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Acceso restringido</span>
                </div>
             </div>
             
             <form onSubmit={handleSubmit} className="space-y-6 text-left">
               <div className="space-y-2">
                 <Label htmlFor="email">Correo Electrónico</Label>
                 <Input 
                   id="email" 
                   type="email" 
                   placeholder="tu@email.com" 
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   required
                   className="h-12 rounded-xl"
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="password">Contraseña</Label>
                 <Input 
                   id="password" 
                   type="password" 
                   placeholder="••••••••" 
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   required
                   className="h-12 rounded-xl"
                 />
               </div>
               
               <Button 
                 type="submit" 
                 className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                 disabled={isSubmitting}
               >
                 {isSubmitting ? "Accediendo..." : "Entrar en Argelia Rotation Plan"}
               </Button>
             </form>

             <p className="text-[10px] text-muted-foreground mt-6 italic text-center leading-tight">
               * El acceso está configurado para la cuenta del administrador y visitantes autorizados.
             </p>
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
