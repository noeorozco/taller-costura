"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RapidoPage() {
  const [empleados, setEmpleados] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [bultos, setBultos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [mensaje, setMensaje] = useState("");

  const [empleadoId, setEmpleadoId] = useState("");
  const [ordenId, setOrdenId] = useState("");
  const [procesoId, setProcesoId] = useState("");
  const [bultosSeleccionados, setBultosSeleccionados] = useState([]);
  const [notas, setNotas] = useState("");

  useEffect(() => {
    cargarInicial();
  }, []);

  async function cargarInicial() {
    const { data: emp } = await supabase
      .from("empleados")
      .select("*")
      .order("nombre");

    const { data: ord } = await supabase
      .from("ordenes_produccion")
      .select("id, modelo_id, modelos(id, codigo, nombre)")
      .order("id", { ascending: false });

    const { data: hist } = await supabase
      .from("avances_produccion")
      .select("*")
      .order("fecha_hora", { ascending: false })
      .limit(10);

    setEmpleados(emp || []);
    setOrdenes(ord || []);
    setHistorial(hist || []);
  }

  async function cargarOrden(idOrden) {
    setOrdenId(idOrden);
    setProcesoId("");
    setBultosSeleccionados([]);

    const orden = ordenes.find((o) => Number(o.id) === Number(idOrden));
    if (!orden) return;

    const { data: proc } = await supabase
      .from("modelo_procesos")
      .select("*")
      .eq("modelo_id", Number(orden.modelo_id || orden.modelos?.id))
      .order("orden", { ascending: true });

    const { data: bul } = await supabase
      .from("orden_bultos")
      .select("*")
      .eq("orden_id", Number(idOrden))
      .order("id", { ascending: true });

    setProcesos(proc || []);
    setBultos(bul || []);
  }

  function cambiarBulto(id) {
    setBultosSeleccionados((actual) =>
      actual.includes(id)
        ? actual.filter((x) => x !== id)
        : [...actual, id]
    );
  }

  const proceso = procesos.find((p) => Number(p.id) === Number(procesoId));

  const bultosMarcados = bultos.filter((b) =>
    bultosSeleccionados.includes(b.id)
  );

  const piezas = bultosMarcados.reduce(
    (s, b) => s + Number(b.cantidad || 0),
    0
  );

  const precio = Number(proceso?.costo || 0);
  const total = piezas * precio;

  const bultosChicos = bultos.filter((b) => b.talla === "CH");
  const bultosMedianos = bultos.filter((b) => b.talla === "M");
  const bultosGrandes = bultos.filter((b) => b.talla === "G");

  function renderBultos(lista) {
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {lista.map((b) => {
          const activo = bultosSeleccionados.includes(b.id);

          return (
            <button
              key={b.id}
              type="button"
              onClick={() => cambiarBulto(b.id)}
              style={{
                padding: "15px 22px",
                fontSize: 18,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: activo ? "#22c55e" : "#e5e7eb",
                color: activo ? "white" : "black",
                fontWeight: "bold",
                minWidth: 95,
              }}
            >
              {b.nombre_bulto}
              <br />
              {b.cantidad} pzs
            </button>
          );
        })}
      </div>
    );
  }

  async function guardar() {
    if (!empleadoId || !ordenId || !procesoId || bultosSeleccionados.length === 0) {
      alert("Completa empleado, orden, proceso y bultos");
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
          precio_paso: precio,
          bultos: bultosMarcados.map((b) => b.nombre_bulto).join(", "),
          cantidad_total: piezas,
          total_pago: total,
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
  setMensaje("Uno o más bultos ya estaban registrados en este proceso");
  setTimeout(() => {
    setMensaje("");
  }, 3000);
  return;
}

    setMensaje("Avance guardado correctamente");

    setTimeout(() => {
      setMensaje("");
    }, 2000);

    setBultosSeleccionados([]);
    setNotas("");
    await cargarInicial();
    await cargarOrden(ordenId);
  }

  return (
    <main style={{ maxWidth: 900, margin: "20px auto", padding: 10 }}>
      <h1>Captura rápida</h1>

      {mensaje && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: 15,
            borderRadius: 10,
            marginBottom: 15,
            fontWeight: "bold",
            border: "1px solid #86efac",
          }}
        >
          {mensaje}
        </div>
      )}

      <h3>Empleado</h3>
      <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
        <option value="">Seleccione empleado</option>
        {empleados.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>

      <h3>Orden / Modelo</h3>
      <select value={ordenId} onChange={(e) => cargarOrden(e.target.value)}>
        <option value="">Seleccione orden</option>
        {ordenes.map((o) => (
          <option key={o.id} value={o.id}>
            Orden #{o.id} - {o.modelos?.codigo} - {o.modelos?.nombre}
          </option>
        ))}
      </select>

      <h3>Proceso</h3>
      <select value={procesoId} onChange={(e) => setProcesoId(e.target.value)}>
        <option value="">Seleccione proceso</option>
        {procesos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} - ${p.costo}
          </option>
        ))}
      </select>

      <h3>Bultos</h3>

      <h4>Chicas</h4>
      {renderBultos(bultosChicos)}

      <h4>Medianas</h4>
      {renderBultos(bultosMedianos)}

      <h4>Grandes</h4>
      {renderBultos(bultosGrandes)}

      <div
        style={{
          border: "1px solid #ddd",
          padding: 20,
          borderRadius: 12,
          marginTop: 20,
          marginBottom: 20,
          background: "#fafafa",
        }}
      >
        <h2>Resumen</h2>
        <h3>Piezas: {piezas}</h3>
        <h3>Precio por pieza: ${precio}</h3>
        <h2>Total: ${total}</h2>
      </div>

      <textarea
        placeholder="Notas"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        style={{ width: "100%", minHeight: 70 }}
      />

      <br />
      <br />

      <button
        onClick={guardar}
        style={{
          width: "100%",
          padding: 18,
          fontSize: 22,
          borderRadius: 12,
          background: "#16a34a",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Guardar avance
      </button>

      <hr />

      <h2>Últimos registros</h2>

      {historial.map((h) => (
        <div
          key={h.id}
          style={{
            border: "1px solid #ccc",
            padding: 10,
            marginBottom: 8,
          }}
        >
          <strong>{h.proceso_nombre}</strong> — {h.bultos} —{" "}
          {h.cantidad_total} piezas — ${h.total_pago}
        </div>
      ))}
    </main>
  );
}