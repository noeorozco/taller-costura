import Link from "next/link";

export default function RegistroPage() {
  return (
    <div>
      <h1>📝 Registro</h1>
      <p>Desde aquí registraremos trabajadores y modelos.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          marginTop: 25,
        }}
      >
        <Card
          titulo="👷 Trabajadores"
          texto="Registrar, editar y administrar trabajadores."
          ruta="/registro/trabajadores"
        />

        <Card
          titulo="👕 Modelos"
          texto="Registrar modelos, pasos, precios, notas y pendientes."
          ruta="/registro/modelos"
        />
      </div>
    </div>
  );
}

function Card({ titulo, texto, ruta }) {
  return (
    <div
      style={{
        background: "white",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <h2>{titulo}</h2>
      <p>{texto}</p>
      <Link href={ruta}>Abrir</Link>
    </div>
  );
}