"use client";

export default function AdministracionPage() {
  const tarjetas = [
    {
      titulo: "👤 Empleados",
      descripcion: "Crear, editar y eliminar empleados.",
      ruta: "/empleado",
    },
    {
      titulo: "👕 Modelos",
      descripcion: "Administrar modelos y prendas.",
      ruta: "/preparacion",
    },
    {
      titulo: "⚙️ Procesos",
      descripcion: "Editar procesos y costos.",
      ruta: "/preparacion",
    },
    {
      titulo: "📦 Órdenes",
      descripcion: "Administrar órdenes de producción.",
      ruta: "/ordenes-estado",
    },
    {
      titulo: "💰 Gastos",
      descripcion: "Editar o eliminar gastos.",
      ruta: "/gastos",
    },
    {
      titulo: "🤝 Clientes",
      descripcion: "Administrar clientes.",
      ruta: "/clientes",
    },
  ];

  return (
    <div style={{ padding: 30 }}>
      <h1>⚙️ Administración</h1>

      <p style={{ color: "#666", marginBottom: 30 }}>
        Desde aquí podrás administrar toda la información del sistema.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          gap: 20,
        }}
      >
        {tarjetas.map((item) => (
          <div
            key={item.titulo}
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 20,
              background: "white",
              boxShadow: "0 3px 8px rgba(0,0,0,.08)",
            }}
          >
            <h2>{item.titulo}</h2>

            <p>{item.descripcion}</p>

            <button
              onClick={() => (window.location.href = item.ruta)}
              style={{
                marginTop: 15,
                padding: "10px 18px",
                cursor: "pointer",
              }}
            >
              Abrir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}