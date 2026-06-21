"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PerfilEmpleadoPage() {
  const [empleados, setEmpleados] = useState([]);
  const [empleadoId, setEmpleadoId] = useState("");
  const [empleado, setEmpleado] = useState(null);
  const [produccion, setProduccion] = useState([]);
  const [prestamos, setPrestamos] = useState([]);

  useEffect(() => {
    cargarEmpleados();
  }, []);

  async function cargarEmpleados() {
    const { data } = await supabase.from("empleados").select("*").order("nombre");
    setEmpleados(data || []);
  }

  async function cargarPerfil(id) {
    setEmpleadoId(id);

    const { data: emp } = await supabase
      .from("empleados")
      .select("*")
      .eq("id", Number(id))
      .single();

    const { data: prod } = await supabase
      .from("avances_produccion")
      .select("*")
      .eq("empleado_id", Number(id))
      .order("fecha_hora", { ascending: false });

    const { data: pres } = await supabase
      .from("prestamos")
      .select("*")
      .eq("empleado_id", Number(id))
      .order("fecha", { ascending: false });

    setEmpleado(emp);
    setProduccion(prod || []);
    setPrestamos(pres || []);
  }

  const totalGanado = produccion.reduce(
    (s, p) => s + Number(p.total_pago || 0),
    0
  );

  const totalPiezas = produccion.reduce(
    (s, p) => s + Number(p.cantidad_total || 0),
    0
  );

  const totalPrestamos = prestamos.reduce(
    (s, p) => s + Number(p.monto || 0),
    0
  );

  const neto = totalGanado - totalPrestamos;

  return (
    <main style={{ maxWidth: 1100, margin: "30px auto" }}>
      <h1>Perfil completo del empleado</h1>

      <select value={empleadoId} onChange={(e) => cargarPerfil(e.target.value)}>
        <option value="">Seleccione empleado</option>
        {empleados.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>

      <br /><br />

      {empleado && (
        <>
          <div style={{ border: "1px solid #ccc", padding: 15, borderRadius: 8 }}>
            <h2>{empleado.nombre}</h2>
            <p><strong>Puesto:</strong> {empleado.puesto}</p>
            <p><strong>Teléfono:</strong> {empleado.telefono}</p>
            <p><strong>Cumpleaños:</strong> {empleado.cumpleanos}</p>
            <p><strong>Fecha ingreso:</strong> {empleado.fecha_ingreso}</p>
            <p><strong>Notas:</strong> {empleado.notas}</p>
          </div>

          <br />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15 }}>
            <div style={{ border: "1px solid #ccc", padding: 15 }}>
              <h3>Piezas</h3>
              <p>{totalPiezas}</p>
            </div>

            <div style={{ border: "1px solid #ccc", padding: 15 }}>
              <h3>Ganado</h3>
              <p>${totalGanado}</p>
            </div>

            <div style={{ border: "1px solid #ccc", padding: 15 }}>
              <h3>Préstamos</h3>
              <p>${totalPrestamos}</p>
            </div>

            <div style={{ border: "1px solid #ccc", padding: 15 }}>
              <h3>Neto</h3>
              <p>${neto}</p>
            </div>
          </div>

          <h2>Producción</h2>

          {produccion.map((p) => (
            <div key={p.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 8 }}>
              <p><strong>Fecha:</strong> {new Date(p.fecha_hora).toLocaleString()}</p>
              <p><strong>Proceso:</strong> {p.proceso_nombre}</p>
              <p><strong>Bultos:</strong> {p.bultos}</p>
              <p><strong>Piezas:</strong> {p.cantidad_total}</p>
              <p><strong>Total:</strong> ${p.total_pago}</p>
              <p><strong>Notas:</strong> {p.notas}</p>
            </div>
          ))}

          <h2>Préstamos</h2>

          {prestamos.map((p) => (
            <div key={p.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 8 }}>
              <p><strong>Fecha:</strong> {new Date(p.fecha).toLocaleString()}</p>
              <p><strong>Monto:</strong> ${p.monto}</p>
              <p><strong>Motivo:</strong> {p.motivo}</p>
            </div>
          ))}
        </>
      )}
    </main>
  );
}