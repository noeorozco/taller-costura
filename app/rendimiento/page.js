"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RendimientoPage() {
  const [datos, setDatos] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: empleados } = await supabase
      .from("empleados")
      .select("*");

    const { data: avances } = await supabase
      .from("avances_produccion")
      .select("*");

    const resultado = (empleados || []).map((e) => {
      const registros = (avances || []).filter(
        (a) => Number(a.empleado_id) === Number(e.id)
      );

      const piezas = registros.reduce(
        (s, r) => s + Number(r.cantidad_total || 0),
        0
      );

      const ganado = registros.reduce(
        (s, r) => s + Number(r.total_pago || 0),
        0
      );

      return {
        empleado: e.nombre,
        piezas,
        ganado,
      };
    });

    resultado.sort((a, b) => b.piezas - a.piezas);

    setDatos(resultado);
  }

  return (
    <main style={{ maxWidth: 1000, margin: "30px auto" }}>
      <h1>Rendimiento de empleados</h1>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Ranking</th>
            <th>Empleado</th>
            <th>Piezas</th>
            <th>Ganado</th>
          </tr>
        </thead>

        <tbody>
          {datos.map((d, i) => (
            <tr key={i}>
              <td>#{i + 1}</td>
              <td>{d.empleado}</td>
              <td>{d.piezas}</td>
              <td>${d.ganado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}