"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");

  async function iniciarSesion() {
    if (!usuario || !password) {
      alert("Escribe usuario y contraseña");
      return;
    }

    const { data, error } = await supabase
      .from("empleados")
      .select("*")
      .eq("usuario", usuario)
      .eq("password", password)
      .single();

    if (error || !data) {
      alert("Usuario o contraseña incorrectos");
      return;
    }

    localStorage.setItem("usuario", JSON.stringify(data));

    if (data.rol === "dueno") {
      window.location.href = "/dashboard";
    } else if (data.rol === "encargado") {
      window.location.href = "/produccion";
    } else {
      window.location.href = "/perfil-empleado";
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: "80px auto" }}>
      <h1>Iniciar sesión</h1>

      <input
        placeholder="Usuario"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        style={{ width: "100%", padding: 10 }}
      />

      <br /><br />

      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 10 }}
      />

      <br /><br />

      <button onClick={iniciarSesion}>
        Entrar
      </button>
    </main>
  );
}