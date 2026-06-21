"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CierreNominaPage() {
  const [empleados, setEmpleados] = useState([]);
  const [cierres, setCierres] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: emp } = await supabase.from("empleados").select("*");
    const { data: cierresData } = await supabase
      .from("cierres_nomina")
      .select("*")
      .order("fecha_cierre", { ascending: false });

    setEmpleados(emp || []);
    setCierres(cierresData || []);
  }

  function obtenerSemanaActual() {
    const hoy = new Date();
    const dia = hoy.getDay();

    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1));
    lunes.setHours(0, 0, 0, 0);

    const sabado = new Date(lunes);
    sabado.setDate(lunes.getDate() + 5);
    sabado.setHours(23, 59, 59, 999);

    return { lunes, sabado };
  }

  async function generarCierre() {
    const { lunes, sabado } = obtenerSemanaActual();

    const { data: avances } = await supabase
      .from("avances_produccion")
      .select("*")
      .gte("fecha_hora", lunes.toISOString())
      .lte("fecha_hora", sabado.toISOString());

    const { data: prestamos } = await supabase
      .from("prestamos")
      .select("*")
      .gte("fecha", lunes.toISOString())
      .lte("fecha", sabado.toISOString());

    const detalle = empleados.map((e) => {
      const ganado = (avances || [])
        .filter((a) => Number(a.empleado_id) === Number(e.id))
        .reduce((s, a) => s + Number(a.total_pago || 0), 0);

      const prestado = (prestamos || [])
        .filter((p) => Number(p.empleado_id) === Number(e.id))
        .reduce((s, p) => s + Number(p.monto || 0), 0);

      return {
        empleado_id: e.id,
        empleado: e.nombre,
        ganado,
        prestamos: prestado,
        neto: ganado - prestado,
      };
    });

    const totalGanado = detalle.reduce((s, d) => s + d.ganado, 0);
    const totalPrestamos = detalle.reduce((s, d) => s + d.prestamos, 0);
    const totalNeto = detalle.reduce((s, d) => s + d.neto, 0);

    const { error } = await supabase.from("cierres_nomina").insert([
      {
        semana_inicio: lunes.toISOString().slice(0, 10),
        semana_fin: sabado.toISOString().slice(0, 10),
        total_ganado: totalGanado,
        total_prestamos: totalPrestamos,
        total_neto: totalNeto,
        detalle,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Cierre semanal guardado");
    cargarDatos();
  }

  return (
    <main style={{ maxWidth: 1000, margin: "30px auto" }}>
      <h1>Cierre semanal de nómina</h1>

      <button onClick={generarCierre}>
        Generar cierre de esta semana
      </button>

      <hr />

      <h2>Historial de cierres</h2>

      {cierres.map((c) => (
        <div
          key={c.id}
          style={{
            border: "1px solid #ccc",
            padding: 15,
            marginBottom: 15,
            borderRadius: 8,
          }}
        >
          <h3>
            Semana {c.semana_inicio} a {c.semana_fin}
          </h3>

          <p>Total ganado: ${c.total_ganado}</p>
          <p>Total préstamos: ${c.total_prestamos}</p>
          <p>Total neto: ${c.total_neto}</p>

          <h4>Detalle</h4>

          {(c.detalle || []).map((d, index) => (
            <p key={index}>
              {d.empleado}: Ganado ${d.ganado} - Préstamos ${d.prestamos} =
              Neto ${d.neto}
            </p>
          ))}
        </div>
      ))}
    </main>
  );
}