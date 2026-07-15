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

  const esLogin = pathname === "/login";

  useEffect(() => {
    revisarSesion();
  }, [pathname]);

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

  return (
    <html lang="es">
      <head>
        <title>Wishlist Taller</title>

        <meta
          name="description"
          content="Sistema de control de producción para taller"
        />
      </head>

      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
          }}
        >
          <aside
            style={{
              width: 260,
              minWidth: 260,
              background: "#111827",
              color: "white",
              padding: 20,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 5 }}>
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
                {usuario.alias || usuario.nombre || usuario.usuario}
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
                  >
                    🧠 Inicio
                  </Link>

                  <Link
                    style={estiloEnlace("/ordenes")}
                    href="/ordenes"
                  >
                    📦 Órdenes de producción
                  </Link>

                  <Link
                    style={estiloEnlace("/asignaciones")}
                    href="/asignaciones"
                  >
                    📋 Asignaciones
                  </Link>

                  <Link
                    style={estiloEnlace("/entrega")}
                    href="/entrega"
                  >
                    ✅ Entrega
                  </Link>

                  <Link
                    style={estiloEnlace("/reasignar")}
                    href="/reasignar"
                  >
                    🔄 Reasignar
                  </Link>

                  <Link
                    style={estiloEnlace("/buscar-bulto")}
                    href="/buscar-bulto"
                  >
                    🔎 Buscar bulto
                  </Link>

                  <Link
                    style={estiloEnlace("/registro")}
                    href="/registro"
                  >
                    📝 Registro
                  </Link>

                  <Link
                    style={estiloEnlace("/nomina")}
                    href="/nomina"
                  >
                    💵 Nómina
                  </Link>

                  <Link
                    style={estiloEnlace("/perfil-empleado")}
                    href="/perfil-empleado"
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
                  >
                    🏠 Inicio
                  </Link>

                  <Link
                    style={estiloEnlace("/ordenes")}
                    href="/ordenes"
                  >
                    📦 Órdenes de producción
                  </Link>

                  <Link
                    style={estiloEnlace("/asignaciones")}
                    href="/asignaciones"
                  >
                    📋 Asignaciones
                  </Link>

                  <Link
                    style={estiloEnlace("/entrega")}
                    href="/entrega"
                  >
                    ✅ Entrega
                  </Link>

                  <Link
                    style={estiloEnlace("/reasignar")}
                    href="/reasignar"
                  >
                    🔄 Reasignar
                  </Link>

                  <Link
                    style={estiloEnlace("/buscar-bulto")}
                    href="/buscar-bulto"
                  >
                    🔎 Buscar bulto
                  </Link>

                  <Link
                    style={estiloEnlace("/perfil-empleado")}
                    href="/perfil-empleado"
                  >
                    👤 Perfil empleado
                  </Link>
                </>
              )}

              {rol === "empleado" && (
                <Link
                  style={estiloEnlace("/perfil-empleado")}
                  href="/perfil-empleado"
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

          <main
            style={{
              flex: 1,
              minWidth: 0,
              background: "#f3f4f6",
              padding: 25,
              boxSizing: "border-box",
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}