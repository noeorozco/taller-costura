"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OrdenUtilidadPage() {
  const [datos, setDatos] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: ordenes } = await supabase
      .from("ordenes_produccion")
      .select("*");

    const { data: ingresos } = await supabase
      .from("ingresos")
      .select("*");

    const { data: avances } = await supabase
      .from("avances_produccion")
      .select("*");

    const resultado = (ordenes || []).map((orden) => {
      const ingresoOrden = (ingresos || [])
        .filter((i) => i.orden_id === orden.id)
        .reduce((s, i) => s + Number(i.monto || 0), 0);

      const costoOrden = (avances || [])
        .filter((a) => a.orden_id === orden.id)
        .reduce((s, a) => s + Number(a.total_pago || 0), 0);


      return {
        orden: orden.id,
        cliente:
          ingresos?.find((i) => i.orden_id === orden.id)?.cliente || "-",
        ingreso: ingresoOrden,
        costo: costoOrden,
        utilidad: ingresoOrden - costoOrden,
      };
    });

    setDatos(resultado);
  }

  const totalIngresos = datos.reduce((s, d) => s + Number(d.ingreso || 0), 0);
const totalCostos = datos.reduce((s, d) => s + Number(d.costo || 0), 0);
const utilidadTotal = totalIngresos - totalCostos;

  return (
    <main style={{ maxWidth: 1000, margin: "30px auto" }}>
      <h1>Utilidad por orden</h1>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Orden</th>
            <th>Cliente</th>
            <th>Ingreso</th>
            <th>Costo producción</th>
            <th>Utilidad</th>
          </tr>
        </thead>

        <tbody>
          {datos.map((d) => (
            <tr key={d.orden}>
              <td>{d.orden}</td>
              <td>{d.cliente}</td>
              <td>${d.ingreso}</td>
              <td>${d.costo}</td>
              <td>${d.utilidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />

<h2>Resumen general</h2>
<p>Total ingresos: ${totalIngresos}</p>
<p>Total costo producción: ${totalCostos}</p>
<p>Utilidad total: ${utilidadTotal}</p>
    </main>
  );
}