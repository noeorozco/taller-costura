"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [iniciando, setIniciando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const sesionGuardada = localStorage.getItem("usuario");

    if (!sesionGuardada) return;

    try {
      const sesion = JSON.parse(sesionGuardada);
      redirigirSegunRol(sesion.rol);
    } catch {
      localStorage.removeItem("usuario");
    }
  }, []);

  function normalizarRol(valor) {
    return String(valor || "")
      .trim()
      .toLowerCase()
      .replace("dueño", "dueno");
  }

  function redirigirSegunRol(valorRol) {
    const rol = normalizarRol(valorRol);

    if (rol === "dueno") {
      window.location.replace("/inicio");
      return;
    }

    if (rol === "encargado") {
      window.location.replace("/asignaciones");
      return;
    }

    window.location.replace("/perfil-empleado");
  }

  async function iniciarSesion() {
    const usuarioLimpio = usuario.trim().toLowerCase();
    const passwordLimpio = password.trim();

    setMensaje("");

    if (!usuarioLimpio || !passwordLimpio) {
      setMensaje("Escribe usuario y contraseña.");
      return;
    }

    setIniciando(true);

    try {
      const { data, error } = await supabase
        .from("empleados")
        .select(
          `
          id,
          nombre,
          alias,
          puesto,
          usuario,
          password,
          rol,
          activo
        `
        )
        .ilike("usuario", usuarioLimpio)
        .eq("password", passwordLimpio)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setMensaje("Usuario o contraseña incorrectos.");
        return;
      }

      if (!data.activo) {
        setMensaje("Este usuario está inactivo.");
        return;
      }

      const sesion = {
        id: data.id,
        empleado_id: data.id,
        nombre: data.nombre,
        alias: data.alias,
        puesto: data.puesto,
        usuario: data.usuario,
        rol: normalizarRol(data.rol),
      };

      localStorage.setItem("usuario", JSON.stringify(sesion));

      redirigirSegunRol(sesion.rol);
    } catch (error) {
      console.error(error);
      setMensaje(error.message || "No se pudo iniciar sesión.");
    } finally {
      setIniciando(false);
    }
  }

  function manejarEnter(evento) {
    if (evento.key === "Enter") {
      iniciarSesion();
    }
  }

  return (
    <main style={pagina}>
      <section style={tarjeta}>
        <div style={logo}>🧵</div>

        <h1 style={{ marginBottom: 5 }}>Wishlist Taller</h1>

        <p style={subtitulo}>
          Sistema de control de producción
        </p>

        {mensaje && <div style={alerta}>{mensaje}</div>}

        <label style={etiqueta}>Usuario</label>

        <input
          placeholder="Escribe tu usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          onKeyDown={manejarEnter}
          autoComplete="username"
          autoFocus
          style={input}
        />

        <label style={etiqueta}>Contraseña</label>

        <input
          type="password"
          placeholder="Escribe tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={manejarEnter}
          autoComplete="current-password"
          style={input}
        />

        <button
          type="button"
          onClick={iniciarSesion}
          disabled={iniciando}
          style={{
            ...boton,
            opacity: iniciando ? 0.65 : 1,
          }}
        >
          {iniciando ? "Ingresando..." : "Entrar"}
        </button>
      </section>
    </main>
  );
}

const pagina = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 20,
  boxSizing: "border-box",
  background:
    "linear-gradient(135deg, #111827 0%, #1f2937 55%, #166534 100%)",
};

const tarjeta = {
  width: "100%",
  maxWidth: 420,
  padding: 30,
  borderRadius: 16,
  background: "white",
  boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
  boxSizing: "border-box",
};

const logo = {
  width: 58,
  height: 58,
  display: "grid",
  placeItems: "center",
  borderRadius: 14,
  background: "#dcfce7",
  fontSize: 30,
  marginBottom: 15,
};

const subtitulo = {
  marginTop: 0,
  marginBottom: 25,
  color: "#6b7280",
};

const etiqueta = {
  display: "block",
  fontWeight: "bold",
  marginBottom: 6,
};

const input = {
  width: "100%",
  padding: 12,
  marginBottom: 18,
  border: "1px solid #d1d5db",
  borderRadius: 9,
  boxSizing: "border-box",
  fontSize: 16,
};

const boton = {
  width: "100%",
  padding: 13,
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 9,
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 16,
};

const alerta = {
  padding: 12,
  marginBottom: 18,
  borderRadius: 9,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: "bold",
};