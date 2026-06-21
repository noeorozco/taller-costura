"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OrdenUtilidadPage() {
  const [ordenes, setOrdenes] = useState([]);

  useEffect(() => {
    cargarUtilidad();
  }, []);

  async function cargarUtilidad() {
    const { data: ordenesData } = await supabase
      .from("ordenes_produccion")
      .select("id, cantidad, notas, modelos(id, codigo, nombre)")
      .order("id", { ascending: false });

    const { data: ingresos } = await supabase
      .from("ingresos")
      .select("*");

    const { data: avances } = await supabase
      .from("avances_produccion")
      .select("*");

    const resumen = (ordenesData || []).map((orden) => {
      const ingresosOrden = (ingresos || []).filter(
        (i) => Number(i.orden_id) === Number(orden.id)
      );

      const avancesOrden = (avances || []).filter(
        (a) => Number(a.orden_id) === Number(orden.id)
      );

      const ingresoTotal = ingresosOrden.reduce(
        (suma, i) => suma + Number(i.monto || 0),
        0
      );

      const costoProduccion = avancesOrden.reduce(
        (suma, a) => suma + Number(a.total_pago || 0),
        0
      );

      const cliente = ingresosOrden[0]?.cliente || "Sin ingreso registrado";

      return {
        ...orden,
        cliente,
        ingresoTotal,
        costoProduccion,
        utilidad: ingresoTotal - costoProduccion,
      };
    });

    setOrdenes(resumen);
  }

  return (
    <main style={{ maxWidth: 1200, margin: "30px auto" }}>
      <h1>Utilidad por orden</h1>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Orden</th>
            <th>Modelo</th>
            <th>Cliente</th>
            <th>Ingreso</th>
            <th>Costo producción</th>
            <th>Utilidad</th>
          </tr>
        </thead>

        <tbody>
          {ordenes.map((o) => (
            <tr key={o.id}>
              <td>#{o.id}</td>
              <td>
                {o.modelos?.codigo} - {o.modelos?.nombre}
              </td>
              <td>{o.cliente}</td>
              <td>${o.ingresoTotal}</td>
              <td>${o.costoProduccion}</td>
              <td>${o.utilidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}