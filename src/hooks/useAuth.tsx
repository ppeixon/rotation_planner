
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDocs, setDoc, collection, query, where, limit } from "firebase/firestore";
import { useAuth as useFirebaseAuth, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isReadOnly: boolean;
  targetUid: string | null;
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
  const db = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [targetUid, setTargetUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const isReadOnly = user?.email === VISITOR_EMAIL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser && (firebaseUser.email === ADMIN_EMAIL || firebaseUser.email === VISITOR_EMAIL)) {
        setUser(firebaseUser);
        
        if (firebaseUser.email === ADMIN_EMAIL) {
          setTargetUid(firebaseUser.uid);
          // Registrar datos del admin para que el visitante pueda encontrarlo vía query
          const userRef = doc(db, "users", firebaseUser.uid);
          await setDoc(userRef, { 
            id: firebaseUser.uid, 
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || "Admin",
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } else if (firebaseUser.email === VISITOR_EMAIL) {
          // Buscar el UID del administrador por su email
          try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", ADMIN_EMAIL), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const adminDoc = querySnapshot.docs[0];
              setTargetUid(adminDoc.id);
            } else {
              console.warn("No se encontró el perfil del administrador.");
              setTargetUid(null);
            }
          } catch (e) {
            console.error("Error buscando al administrador:", e);
            setTargetUid(null);
          }
        }
      } else {
        setUser(null);
        setTargetUid(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [auth, db]);

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
    <AuthContext.Provider value={{ user, loading, isReadOnly, targetUid, login, logout }}>
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
