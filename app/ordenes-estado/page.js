"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OrdenesEstadoPage() {
  const [ordenes, setOrdenes] = useState([]);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const { data: ord } = await supabase
      .from("ordenes_produccion")
      .select(`
        *,
        modelos(codigo,nombre)
      `);

    const { data: procesos } = await supabase
      .from("modelo_procesos")
      .select("*");

    const { data: bultos } = await supabase
      .from("orden_bultos")
      .select("*");

    const { data: avances } = await supabase
      .from("avance_bultos")
      .select("*");

    const resultado = (ord || []).map((o) => {
      const procesosModelo =
        procesos?.filter(
          (p) => p.modelo_id === o.modelo_id
        ) || [];

      const bultosOrden =
        bultos?.filter(
          (b) => b.orden_id === o.id
        ) || [];

      const totalEsperado =
        procesosModelo.length *
        bultosOrden.length;

      const realizados =
        avances?.filter(
          (a) => a.orden_id === o.id
        ).length || 0;

      const porcentaje =
        totalEsperado > 0
          ? Math.round(
              (realizados / totalEsperado) * 100
            )
          : 0;

      return {
        ...o,
        porcentaje,
        estado:
          porcentaje >= 100
            ? "Terminada"
            : "En proceso",
      };
    });

    setOrdenes(resultado);
  }

  return (
    <main style={{ maxWidth: 1000, margin: "30px auto" }}>
      <h1>Órdenes</h1>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Orden</th>
            <th>Modelo</th>
            <th>Estado</th>
            <th>Avance</th>
          </tr>
        </thead>

        <tbody>
          {ordenes.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>

              <td>
                {o.modelos?.codigo} - {o.modelos?.nombre}
              </td>

              <td>
                {o.estado === "Terminada"
                  ? "✅ Terminada"
                  : "🟡 En proceso"}
              </td>

              <td>
  <div style={{
    width: 120,
    border: "1px solid #ccc",
    height: 18
  }}>
    <div style={{
      width: `${o.porcentaje}%`,
      background: "#4caf50",
      height: "100%"
    }} />
  </div>
  {o.porcentaje}%
</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}