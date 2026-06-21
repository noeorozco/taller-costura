"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function EmpleadoPage() {
  const [empleados, setEmpleados] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [bultos, setBultos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [avancesOrden, setAvancesOrden] = useState([]);
  const [empleadoId, setEmpleadoId] = useState("");
  const [ordenId, setOrdenId] = useState("");
  const [procesoId, setProcesoId] = useState("");
  const [bultosSeleccionados, setBultosSeleccionados] = useState([]);
  const [notas, setNotas] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: emp } = await supabase.from("empleados").select("*");

    const { data: ord } = await supabase
      .from("ordenes_produccion")
      .select("id, modelo_id, cantidad, notas, modelos(id, codigo, nombre)");

      console.log("EMPLEADOS:", emp);
console.log("ORDENES:", ord);

    setEmpleados(emp || []);
    setOrdenes(ord || []);
  }

  async function cargarHistorial(idEmpleado) {
    if (!idEmpleado) return;

    const { data, error } = await supabase
      .from("avances_produccion")
      .select("*")
      .eq("empleado_id", Number(idEmpleado))
      .order("fecha_hora", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setHistorial(data || []);
  }

  async function cargarProcesosYBultos(idOrden) {
    setOrdenId(idOrden);
    setProcesoId("");
    setBultosSeleccionados([]);

    const orden = ordenes.find((o) => String(o.id) === String(idOrden));
    if (!orden) return;

    const modeloId = orden.modelo_id || orden.modelos?.id;

    const { data: proc } = await supabase
      .from("modelo_procesos")
      .select("*")
      .eq("modelo_id", Number(modeloId))
      .order("orden", { ascending: true });

    const { data: bul } = await supabase
      .from("orden_bultos")
      .select("*")
      .eq("orden_id", Number(idOrden))
      .order("id", { ascending: true });

      const { data: avances } = await supabase
  .from("avance_bultos")
  .select("orden_bulto_id, modelo_proceso_id")
  .eq("orden_id", Number(idOrden));

setAvancesOrden(avances || []);

    setProcesos(proc || []);
    setBultos(bul || []);
  }

  function cambiarBulto(bultoId) {
    setBultosSeleccionados((actual) =>
      actual.includes(bultoId)
        ? actual.filter((id) => id !== bultoId)
        : [...actual, bultoId]
    );
  }

  const proceso = procesos.find((p) => String(p.id) === String(procesoId));

  const bultosMarcados = bultos.filter((b) =>
    bultosSeleccionados.includes(b.id)
  );

  const cantidadTotal = bultosMarcados.reduce(
    (total, b) => total + Number(b.cantidad || 0),
    0
  );

  const precioPaso = Number(proceso?.costo || 0);
  const totalPago = cantidadTotal * precioPaso;

const bultosBloqueados = avancesOrden
  .filter((a) => String(a.modelo_proceso_id) === String(procesoId))
  .map((a) => Number(a.orden_bulto_id));

  async function guardarAvance() {
    if (!empleadoId || !ordenId || !procesoId || bultosSeleccionados.length === 0) {
      alert("Selecciona empleado, orden, proceso y al menos un bulto");
      return;
    }

    const { data: avanceCreado, error } = await supabase
  .from("avances_produccion")
  .insert([
      {
        empleado_id: Number(empleadoId),
        orden_id: Number(ordenId),
        modelo_proceso_id: Number(procesoId),
        proceso_nombre: proceso.nombre,
        precio_paso: precioPaso,
        bultos: bultosMarcados.map((b) => b.nombre_bulto).join(", "),
        cantidad_total: cantidadTotal,
        total_pago: totalPago,
        notas,
      },
    ])
.select()
.single();

    if (error) {
      alert(error.message);
      return;
    }

const registrosBultos = bultosMarcados.map((b) => ({
  avance_id: avanceCreado.id,
  orden_bulto_id: b.id,
  orden_id: Number(ordenId),
  modelo_proceso_id: Number(procesoId),
  empleado_id: Number(empleadoId),
}));

const { error: errorBultos } = await supabase
  .from("avance_bultos")
  .insert(registrosBultos);

if (errorBultos) {
  alert(errorBultos.message);
  return;
}

    alert("Avance guardado");
    setProcesoId("");
    setBultosSeleccionados([]);
    setNotas("");
    cargarHistorial(empleadoId);
  }

  return (
    <main style={{ maxWidth: 900, margin: "30px auto" }}>
      <h1>Perfil del empleado</h1>

      <select
        value={empleadoId}
        onChange={(e) => {
          setEmpleadoId(e.target.value);
          cargarHistorial(e.target.value);
        }}
      >
        <option value="">Seleccione empleado</option>
        {empleados.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>

      <br /><br />

      <select value={ordenId} onChange={(e) => cargarProcesosYBultos(e.target.value)}>
        <option value="">Seleccione orden / modelo</option>
        {ordenes.map((o) => (
          <option key={o.id} value={o.id}>
            Orden #{o.id} - {o.modelos?.codigo} - {o.modelos?.nombre}
          </option>
        ))}
      </select>

      <br /><br />

      <select value={procesoId} onChange={(e) => setProcesoId(e.target.value)}>
        <option value="">Seleccione proceso</option>
        {procesos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} - ${p.costo}
          </option>
        ))}
      </select>

      <h3>Bultos realizados</h3>

      {bultos.map((b) => (
        <label key={b.id} style={{ display: "block", marginBottom: 8 }}>
        <input
  type="checkbox"
 disabled={bultosBloqueados.includes(Number(b.id))}
  checked={bultosSeleccionados.includes(b.id)}
  onChange={() => cambiarBulto(b.id)}
/>
          {" "}
          {b.nombre_bulto} - {b.talla} - {b.cantidad} piezas
{bultosBloqueados.includes(Number(b.id)) ? " (ya registrado)" : ""}
        </label>
      ))}

      <h3>Resumen</h3>
      <p>Piezas realizadas: {cantidadTotal}</p>
      <p>Precio del paso: ${precioPaso}</p>
      <p>Total a pagar: ${totalPago}</p>

      <textarea
        placeholder="Notas"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        style={{ width: "100%", minHeight: 80 }}
      />

      <br /><br />

      <button onClick={guardarAvance}>Guardar avance</button>

      <h2>Historial del empleado</h2>

      {historial.map((h) => (
        <div
          key={h.id}
          style={{
            border: "1px solid #ccc",
            padding: 10,
            marginBottom: 10,
            borderRadius: 8,
          }}
        >
          <p><strong>Fecha:</strong> {new Date(h.fecha_hora).toLocaleString()}</p>
          <p><strong>Proceso:</strong> {h.proceso_nombre}</p>
          <p><strong>Bultos:</strong> {h.bultos}</p>
          <p><strong>Piezas:</strong> {h.cantidad_total}</p>
          <p><strong>Precio:</strong> ${h.precio_paso}</p>
          <p><strong>Total:</strong> ${h.total_pago}</p>
          <p><strong>Notas:</strong> {h.notas}</p>
        </div>
      ))}
    </main>
  );
}