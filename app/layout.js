"use client";

import "./globals.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const linkStyle = {
  color: "white",
  textDecoration: "none",
  padding: "12px 14px",
  borderRadius: 10,
  background: "#1f2937",
  fontWeight: "bold",
  display: "block",
};

const linkActivoStyle = {
  ...linkStyle,
  background: "#2563eb",
};

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const [usuario, setUsuario] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  const [esMovil, setEsMovil] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const esLogin = pathname === "/login";

  useEffect(() => {
    revisarSesion();
  }, [pathname]);

  useEffect(() => {
    function revisarPantalla() {
      const movil = window.innerWidth <= 850;

      setEsMovil(movil);

      if (!movil) {
        setMenuAbierto(false);
      }
    }

    revisarPantalla();

    window.addEventListener("resize", revisarPantalla);

    return () => {
      window.removeEventListener("resize", revisarPantalla);
    };
  }, []);

  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!esMovil || !menuAbierto) return;

    const overflowAnterior = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [esMovil, menuAbierto]);

  function revisarSesion() {
    try {
      const datosGuardados = localStorage.getItem("usuario");

      if (!datosGuardados) {
        setUsuario(null);
        setCargandoSesion(false);

        if (!esLogin) {
          router.replace("/login");
        }

        return;
      }

      const datosUsuario = JSON.parse(datosGuardados);

      setUsuario(datosUsuario);
      setCargandoSesion(false);

      const rol = normalizarRol(datosUsuario?.rol);

      if (!esLogin && !puedeEntrarRuta(rol, pathname)) {
        if (rol === "empleado") {
          router.replace("/perfil-empleado");
        } else if (rol === "encargado") {
          router.replace("/asignaciones");
        } else {
          router.replace("/inicio");
        }
      }
    } catch (error) {
      console.error("No se pudo leer la sesión:", error);

      localStorage.removeItem("usuario");
      setUsuario(null);
      setCargandoSesion(false);

      if (!esLogin) {
        router.replace("/login");
      }
    }
  }

  function cerrarSesion() {
    const confirmar = window.confirm(
      "¿Deseas cerrar la sesión?"
    );

    if (!confirmar) return;

    localStorage.removeItem("usuario");

    setUsuario(null);
    setMenuAbierto(false);

    router.replace("/login");
  }

  function normalizarRol(valor) {
    return String(valor || "")
      .trim()
      .toLowerCase()
      .replace("dueño", "dueno");
  }

  function puedeEntrarRuta(rol, ruta) {
    if (rol === "dueno") {
      return true;
    }

    if (rol === "encargado") {
      const rutasEncargado = [
        "/inicio",
        "/ordenes",
        "/asignaciones",
        "/entrega",
        "/reasignar",
        "/buscar-bulto",
        "/perfil-empleado",
      ];

      return rutasEncargado.some(
        (rutaPermitida) =>
          ruta === rutaPermitida ||
          ruta.startsWith(`${rutaPermitida}/`)
      );
    }

    if (rol === "empleado") {
      return (
        ruta === "/perfil-empleado" ||
        ruta.startsWith("/perfil-empleado/")
      );
    }

    return false;
  }

  function estiloEnlace(ruta) {
    const activo =
      pathname === ruta ||
      pathname.startsWith(`${ruta}/`);

    return activo ? linkActivoStyle : linkStyle;
  }

  function cerrarMenuMovil() {
    if (esMovil) {
      setMenuAbierto(false);
    }
  }

  const rol = normalizarRol(usuario?.rol);

  if (esLogin) {
    return (
      <html lang="es">
        <head>
          <title>Iniciar sesión | Wishlist Taller</title>

          <meta
            name="description"
            content="Sistema de control de producción para taller"
          />

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
        </head>

        <body
          style={{
            margin: 0,
            fontFamily: "Arial, sans-serif",
            background: "#f3f4f6",
          }}
        >
          {children}
        </body>
      </html>
    );
  }

  if (cargandoSesion || !usuario) {
    return (
      <html lang="es">
        <head>
          <title>Wishlist Taller</title>

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
        </head>

        <body
          style={{
            margin: 0,
            fontFamily: "Arial, sans-serif",
            background: "#f3f4f6",
          }}
        >
          <div
            style={{
              minHeight: "100vh",
              display: "grid",
              placeItems: "center",
            }}
          >
            <h2>Verificando sesión...</h2>
          </div>
        </body>
      </html>
    );
  }

  const menuLateral = (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        height: esMovil ? "100dvh" : "auto",
        minHeight: esMovil ? undefined : "100vh",
        background: "#111827",
        color: "white",
        padding: 20,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",

        position: esMovil ? "fixed" : "relative",
        top: esMovil ? 0 : undefined,
        left: esMovil ? 0 : undefined,
        bottom: esMovil ? 0 : undefined,

        zIndex: esMovil ? 1001 : 1,

        transform:
          esMovil && !menuAbierto
            ? "translateX(-100%)"
            : "translateX(0)",

        transition: "transform 0.25s ease",

        overflowY: "auto",
        boxShadow:
          esMovil && menuAbierto
            ? "4px 0 18px rgba(0,0,0,0.35)"
            : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <h2
            style={{
              marginTop: 0,
              marginBottom: 5,
            }}
          >
            Wishlist Taller
          </h2>

          <p
            style={{
              color: "#9ca3af",
              fontSize: 14,
              marginTop: 0,
            }}
          >
            Control de producción
          </p>
        </div>

        {esMovil && (
          <button
            type="button"
            onClick={() => setMenuAbierto(false)}
            aria-label="Cerrar menú"
            style={botonCerrarMenu}
          >
            ✕
          </button>
        )}
      </div>

      <div
        style={{
          marginTop: 5,
          marginBottom: 20,
          padding: 12,
          background: "#1f2937",
          borderRadius: 10,
        }}
      >
        <strong>
          {usuario.alias ||
            usuario.nombre ||
            usuario.usuario}
        </strong>

        {usuario.alias && usuario.nombre && (
          <small
            style={{
              display: "block",
              marginTop: 3,
              color: "#d1d5db",
            }}
          >
            {usuario.nombre}
          </small>
        )}

        <small
          style={{
            display: "block",
            marginTop: 5,
            color: "#93c5fd",
            textTransform: "capitalize",
          }}
        >
          {rol === "dueno"
            ? "Dueño"
            : rol === "encargado"
              ? "Encargado"
              : "Empleado"}
        </small>
      </div>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {rol === "dueno" && (
          <>
            <Link
              style={estiloEnlace("/inicio")}
              href="/inicio"
              onClick={cerrarMenuMovil}
            >
              🧠 Inicio
            </Link>

            <Link
              style={estiloEnlace("/ordenes")}
              href="/ordenes"
              onClick={cerrarMenuMovil}
            >
              📦 Órdenes de producción
            </Link>

            <Link
              style={estiloEnlace("/asignaciones")}
              href="/asignaciones"
              onClick={cerrarMenuMovil}
            >
              📋 Asignaciones
            </Link>

            <Link
              style={estiloEnlace("/entrega")}
              href="/entrega"
              onClick={cerrarMenuMovil}
            >
              ✅ Entrega
            </Link>

            <Link
              style={estiloEnlace("/reasignar")}
              href="/reasignar"
              onClick={cerrarMenuMovil}
            >
              🔄 Reasignar
            </Link>

            <Link
              style={estiloEnlace("/buscar-bulto")}
              href="/buscar-bulto"
              onClick={cerrarMenuMovil}
            >
              🔎 Buscar bulto
            </Link>

            <Link
              style={estiloEnlace("/registro")}
              href="/registro"
              onClick={cerrarMenuMovil}
            >
              📝 Registro
            </Link>

            <Link
              style={estiloEnlace("/nomina")}
              href="/nomina"
              onClick={cerrarMenuMovil}
            >
              💵 Nómina
            </Link>

            <Link
              style={estiloEnlace("/prestamos")}
              href="/prestamos"
              onClick={cerrarMenuMovil}
            >
              💰 Finanzas del trabajador
            </Link>

            <Link
              style={estiloEnlace("/perfil-empleado")}
              href="/perfil-empleado"
              onClick={cerrarMenuMovil}
            >
              👤 Perfil empleado
            </Link>
          </>
        )}

        {rol === "encargado" && (
          <>
            <Link
              style={estiloEnlace("/inicio")}
              href="/inicio"
              onClick={cerrarMenuMovil}
            >
              🏠 Inicio
            </Link>

            <Link
              style={estiloEnlace("/ordenes")}
              href="/ordenes"
              onClick={cerrarMenuMovil}
            >
              📦 Órdenes de producción
            </Link>

            <Link
              style={estiloEnlace("/asignaciones")}
              href="/asignaciones"
              onClick={cerrarMenuMovil}
            >
              📋 Asignaciones
            </Link>

            <Link
              style={estiloEnlace("/entrega")}
              href="/entrega"
              onClick={cerrarMenuMovil}
            >
              ✅ Entrega
            </Link>

            <Link
              style={estiloEnlace("/reasignar")}
              href="/reasignar"
              onClick={cerrarMenuMovil}
            >
              🔄 Reasignar
            </Link>

            <Link
              style={estiloEnlace("/buscar-bulto")}
              href="/buscar-bulto"
              onClick={cerrarMenuMovil}
            >
              🔎 Buscar bulto
            </Link>

            <Link
              style={estiloEnlace("/perfil-empleado")}
              href="/perfil-empleado"
              onClick={cerrarMenuMovil}
            >
              👤 Perfil empleado
            </Link>
          </>
        )}

        {rol === "empleado" && (
          <Link
            style={estiloEnlace("/perfil-empleado")}
            href="/perfil-empleado"
            onClick={cerrarMenuMovil}
          >
            👤 Mi perfil
          </Link>
        )}
      </nav>

      <div
        style={{
          marginTop: "auto",
          paddingTop: 20,
        }}
      >
        <button
          type="button"
          onClick={cerrarSesion}
          style={{
            width: "100%",
            padding: 12,
            border: "none",
            borderRadius: 10,
            background: "#dc2626",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          🚪 Cerrar sesión
        </button>
      </div>
    </aside>
  );

  return (
    <html lang="es">
      <head>
        <title>Wishlist Taller</title>

        <meta
          name="description"
          content="Sistema de control de producción para taller"
        />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </head>

      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
          overflowX: "hidden",
        }}
      >
        {esMovil && (
          <header style={barraMovil}>
            <button
              type="button"
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir menú"
              style={botonMenu}
            >
              ☰
            </button>

            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: "block",
                  fontSize: 17,
                }}
              >
                Wishlist Taller
              </strong>

              <small
                style={{
                  display: "block",
                  color: "#d1d5db",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {usuario.alias ||
                  usuario.nombre ||
                  usuario.usuario}
              </small>
            </div>
          </header>
        )}

        {esMovil && menuAbierto && (
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
            style={fondoOscuro}
          />
        )}

        <div
          style={{
            display: esMovil ? "block" : "flex",
            minHeight: "100vh",
          }}
        >
          {menuLateral}

          <main
            style={{
              flex: 1,
              minWidth: 0,
              background: "#f3f4f6",
              padding: esMovil ? "18px 12px" : 25,
              paddingTop: esMovil ? 88 : 25,
              boxSizing: "border-box",
              minHeight: "100vh",
              width: esMovil ? "100%" : "auto",
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

const barraMovil = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: 64,
  zIndex: 900,
  background: "#111827",
  color: "white",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0 14px",
  boxSizing: "border-box",
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
};

const botonMenu = {
  width: 42,
  height: 42,
  flexShrink: 0,
  border: "none",
  borderRadius: 9,
  background: "#1f2937",
  color: "white",
  fontSize: 24,
  cursor: "pointer",
};

const botonCerrarMenu = {
  width: 38,
  height: 38,
  flexShrink: 0,
  border: "none",
  borderRadius: 8,
  background: "#374151",
  color: "white",
  fontSize: 18,
  cursor: "pointer",
};

const fondoOscuro = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  border: "none",
  padding: 0,
  background: "rgba(0,0,0,0.55)",
  cursor: "pointer",
};