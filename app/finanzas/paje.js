import Link from "next/link";

export default function FinanzasPage() {
  const items = [
    ["🤝 Préstamos", "/finanzas/prestamos"],
    ["💵 Nómina", "/nomina"],
    ["💸 Gastos", "/finanzas/gastos"],
    ["📈 Ingresos", "/finanzas/ingresos"],
    ["📊 Utilidad", "/finanzas/utilidad"],
  ];

  return (
    <div>
      <h1>💰 Finanzas</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
        {items.map(([titulo, ruta]) => (
          <div key={ruta} style={{ background: "white", padding: 20, borderRadius: 12 }}>
            <h2>{titulo}</h2>
            <Link href={ruta}>Abrir</Link>
          </div>
        ))}
      </div>
    </div>
  );
}