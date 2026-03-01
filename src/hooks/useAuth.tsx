
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { useAuth as useFirebaseAuth } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isReadOnly: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = "pepe.galan.chiner@gmail.com";
const ADMIN_PASSWORD = "jogachi";
const VISITOR_EMAIL = "acceso@visitante.com";
const VISITOR_PASSWORD = "visitante";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useFirebaseAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const isReadOnly = user?.email === VISITOR_EMAIL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && (firebaseUser.email === ADMIN_EMAIL || firebaseUser.email === VISITOR_EMAIL)) {
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
    
    const isAllowedAdmin = cleanEmail === ADMIN_EMAIL && pass === ADMIN_PASSWORD;
    const isAllowedVisitor = cleanEmail === VISITOR_EMAIL && pass === VISITOR_PASSWORD;

    if (!isAllowedAdmin && !isAllowedVisitor) {
      toast({
        variant: "destructive",
        title: "Acceso denegado",
        description: "Credenciales incorrectas o usuario no autorizado."
      });
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, pass);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, pass);
          toast({
            title: isAllowedAdmin ? "Bienvenido Administrador" : "Acceso Visitante",
            description: isAllowedAdmin 
              ? "Tu cuenta ha sido configurada correctamente." 
              : "Has accedido en modo de solo lectura."
          });
        } catch (regError: any) {
          toast({
            variant: "destructive",
            title: "Error de configuración",
            description: "No se pudo crear el perfil en el sistema."
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error de acceso",
          description: "Hubo un problema al conectar con el servicio de seguridad."
        });
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isReadOnly, login, logout }}>
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
