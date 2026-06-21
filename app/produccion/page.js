"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProduccionPage() {
  const [avances, setAvances] = useState([]);

  useEffect(() => {
    cargarAvances();
  }, []);

  async function cargarAvances() {
    const { data } = await supabase
      .from("avances_produccion")
      .select("*")
      .order("fecha_hora", { ascending: false });

    setAvances(data || []);
  }

  return (
    <main style={{ maxWidth: 1200, margin: "30px auto" }}>
      <h1>Producción</h1>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Proceso</th>
            <th>Bultos</th>
            <th>Piezas</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          {avances.map((a) => (
            <tr key={a.id}>
              <td>
                {new Date(a.fecha_hora).toLocaleString()}
              </td>
              <td>{a.proceso_nombre}</td>
              <td>{a.bultos}</td>
              <td>{a.cantidad_total}</td>
              <td>${a.total_pago}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}