"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [resumen, setResumen] = useState({
    avances: 0,
    piezas: 0,
    pago: 0,
    prestamos: 0,
    gastos: 0,
    ingresos: 0,
  });

  const [cumpleaneros, setCumpleaneros] = useState([]);

  useEffect(() => {
    cargarDashboard();
  }, []);

  async function cargarDashboard() {
    const { data: empleados } = await supabase.from("empleados").select("*");
    const { data: avances } = await supabase.from("avances_produccion").select("*");
    const { data: prestamos } = await supabase.from("prestamos").select("*");
    const { data: gastos } = await supabase.from("gastos").select("*");
    const { data: ingresos } = await supabase.from("ingresos").select("*");

    const piezas = (avances || []).reduce((suma, a) => suma + Number(a.cantidad_total || 0), 0);
    const pago = (avances || []).reduce((suma, a) => suma + Number(a.total_pago || 0), 0);
    const totalPrestamos = (prestamos || []).reduce((suma, p) => suma + Number(p.monto || 0), 0);
    const totalGastos = (gastos || []).reduce((suma, g) => suma + Number(g.monto || 0), 0);
    const totalIngresos = (ingresos || []).reduce((suma, i) => suma + Number(i.monto || 0), 0);

    const proximos = (empleados || [])
      .filter((e) => e.cumpleanos)
      .map((e) => {
        const fecha = new Date(e.cumpleanos);

        return {
          nombre: e.nombre,
          mes: fecha.getMonth() + 1,
          dia: fecha.getDate(),
        };
      })
      .sort((a, b) => {
        if (a.mes === b.mes) return a.dia - b.dia;
        return a.mes - b.mes;
      });

    setCumpleaneros(proximos);

    setResumen({
      avances: avances?.length || 0,
      piezas,
      pago,
      prestamos: totalPrestamos,
      gastos: totalGastos,
      ingresos: totalIngresos,
    });
  }

  return (
    <main style={{ maxWidth: 900, margin: "30px auto" }}>
      <h1>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
        <div style={{ border: "1px solid #ccc", padding: 20, borderRadius: 10 }}>
          <h3>Producción</h3>
          <p>Avances: {resumen.avances}</p>
          <p>Piezas: {resumen.piezas}</p>
        </div>

        <div style={{ border: "1px solid #ccc", padding: 20, borderRadius: 10 }}>
          <h3>Ingresos</h3>
          <p>Total ingresos: ${resumen.ingresos}</p>
        </div>

        <div style={{ border: "1px solid #ccc", padding: 20, borderRadius: 10 }}>
          <h3>Nómina</h3>
          <p>Total generado: ${resumen.pago}</p>
        </div>

        <div style={{ border: "1px solid #ccc", padding: 20, borderRadius: 10 }}>
          <h3>Gastos</h3>
          <p>Total gastos: ${resumen.gastos}</p>
        </div>

        <div style={{ border: "1px solid #ccc", padding: 20, borderRadius: 10 }}>
          <h3>Préstamos</h3>
          <p>Total préstamos: ${resumen.prestamos}</p>
        </div>

        <div style={{ border: "1px solid #ccc", padding: 20, borderRadius: 10 }}>
          <h3>Utilidad real</h3>
          <p>${resumen.ingresos - resumen.pago - resumen.gastos}</p>
        </div>
      </div>

      <hr />

      <h2>Proximos cumpleaños</h2>

      {cumpleaneros.map((c, i) => (
        <p key={i}>
          {c.nombre} - {c.dia}/{c.mes}
        </p>
      ))}
    </main>
  );
}