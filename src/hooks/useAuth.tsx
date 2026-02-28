
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { useAuth as useFirebaseAuth } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALLOWED_EMAIL = "pepe.galan.chiner@gmail.com";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useFirebaseAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email === ALLOWED_EMAIL) {
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [auth]);

  const login = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    if (cleanEmail !== ALLOWED_EMAIL) {
      toast({
        variant: "destructive",
        title: "Acceso denegado",
        description: "Este usuario no tiene permiso para acceder a la aplicación."
      });
      return;
    }

    try {
      // Intentar iniciar sesión
      await signInWithEmailAndPassword(auth, cleanEmail, pass);
    } catch (error: any) {
      // Si el usuario no existe, lo creamos (solo para el email permitido)
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, pass);
          toast({
            title: "Bienvenido",
            description: "Tu cuenta ha sido configurada correctamente."
          });
        } catch (regError: any) {
          toast({
            variant: "destructive",
            title: "Error de acceso",
            description: "No se pudo verificar la cuenta. Comprueba los datos."
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error de acceso",
          description: "Credenciales incorrectas o problema de conexión."
        });
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
