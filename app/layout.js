import "./globals.css";

export const metadata = {
  title: "Taller Costura",
  description: "Control de producción del taller",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <nav
          style={{
            display: "flex",
            gap: 15,
            padding: 15,
            borderBottom: "1px solid #ccc",
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <a href="/dashboard">Dashboard</a>
          <a href="/empleado">Empleado</a>
          <a href="/produccion">Producción</a>
          <a href="/estado-bultos">Estado bultos</a>
          <a href="/prestamos">Préstamos</a>
          <a href="/nomina">Nómina</a>
          <a href="/gastos">Gastos</a>
          <a href="/ingresos">Ingresos</a>
          <a href="/orden-utilidad">Utilidad por orden</a>
          <a href="/clientes">Clientes</a>
          <a href="/ordenes-estado">Órdenes</a>
          <a href="/inventario">Inventario</a>
          <a href="/cierre-nomina">Cierre nómina</a>
          <a href="/rendimiento">Rendimiento</a>
          <a href="/perfil-empleado">Perfil empleado</a>
          <a href="/login">Login</a>
          <a href="/rapido">Captura rápida</a>
          <a href="/rapido-v2">Rápido V2</a>
          <a href="/preparacion">Preparación</a>
        </nav>

        {children}
      </body>
    </html>
  );
}