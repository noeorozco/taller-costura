"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    cargarClientes();
  }, []);

  async function cargarClientes() {
    const { data: ingresos } = await supabase.from("ingresos").select("*");

    const agrupados = {};

    (ingresos || []).forEach((i) => {
      const nombre = i.cliente || "Sin cliente";

      if (!agrupados[nombre]) {
        agrupados[nombre] = {
          cliente: nombre,
          ordenes: 0,
          total: 0,
        };
      }

      agrupados[nombre].ordenes += 1;
      agrupados[nombre].total += Number(i.monto || 0);
    });

    setClientes(Object.values(agrupados));
  }

  return (
    <main style={{ maxWidth: 900, margin: "30px auto" }}>
      <h1>Clientes</h1>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Órdenes</th>
            <th>Total generado</th>
          </tr>
        </thead>

        <tbody>
          {clientes.map((c) => (
            <tr key={c.cliente}>
              <td>{c.cliente}</td>
              <td>{c.ordenes}</td>
              <td>${c.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}