"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NominaPage() {
  const [empleados, setEmpleados] = useState([]);

  useEffect(() => {
    cargarNomina();
  }, []);

  async function cargarNomina() {
    const { data: emp } = await supabase
      .from("empleados")
      .select("*");

    const { data: avances } = await supabase
      .from("avances_produccion")
      .select("*");

    const { data: prestamos } = await supabase
      .from("prestamos")
      .select("*");

    const resumen = (emp || []).map((e) => {
      const ganado = (avances || [])
        .filter((a) => a.empleado_id === e.id)
        .reduce(
          (suma, a) => suma + Number(a.total_pago || 0),
          0
        );

      const prestado = (prestamos || [])
        .filter((p) => p.empleado_id === e.id)
        .reduce(
          (suma, p) => suma + Number(p.monto || 0),
          0
        );

      return {
        ...e,
        ganado,
        prestado,
        neto: ganado - prestado,
      };
    });

    setEmpleados(resumen);
  }

  return (
    <main style={{ maxWidth: 1000, margin: "30px auto" }}>
      <h1>Nómina semanal</h1>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Ganado</th>
            <th>Préstamos</th>
            <th>Neto</th>
          </tr>
        </thead>

        <tbody>
          {empleados.map((e) => (
            <tr key={e.id}>
              <td>{e.nombre}</td>
              <td>${e.ganado}</td>
              <td>${e.prestado}</td>
              <td>${e.neto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}