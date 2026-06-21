"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RapidoV2Page() {
  const [empleados, setEmpleados] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [bultos, setBultos] = useState([]);
  const [avancesBultos, setAvancesBultos] = useState([]);
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
      .limit(8);

    setEmpleados(emp || []);
    setOrdenes(ord || []);
    setHistorial(hist || []);
  }

  async function cargarOrden(idOrden) {
    setOrdenId(idOrden);
    setProcesoId("");
    setBultosSeleccionados([]);
    setBultos([]);
    setAvancesBultos([]);

    const orden = ordenes.find((o) => Number(o.id) === Number(idOrden));
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

    const { data: av } = await supabase
      .from("avance_bultos")
      .select("orden_bulto_id, modelo_proceso_id")
      .eq("orden_id", Number(idOrden));

    setProcesos(proc || []);
    setBultos(bul || []);
    setAvancesBultos(av || []);
  }

  async function cargarAvancesOrden(idOrden) {
    const { data: av } = await supabase
      .from("avance_bultos")
      .select("orden_bulto_id, modelo_proceso_id")
      .eq("orden_id", Number(idOrden));

    setAvancesBultos(av || []);
  }

  function cambiarBulto(id, bloqueado) {
    if (bloqueado) return;

    setBultosSeleccionados((actual) =>
      actual.includes(id)
        ? actual.filter((x) => x !== id)
        : [...actual, id]
    );
  }

  function estaBloqueado(bultoId) {
    if (!procesoId) return false;

    return avancesBultos.some(
      (a) =>
        Number(a.orden_bulto_id) === Number(bultoId) &&
        Number(a.modelo_proceso_id) === Number(procesoId)
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

  function renderGrupo(titulo, lista) {
    if (lista.length === 0) return null;

    return (
      <section style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 10 }}>{titulo}</h3>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {lista.map((b) => {
            const bloqueado = estaBloqueado(b.id);
            const activo = bultosSeleccionados.includes(b.id);

            return (
              <button
                key={b.id}
                type="button"
                disabled={bloqueado}
                onClick={() => cambiarBulto(b.id, bloqueado)}
                style={{
                  minWidth: 100,
                  padding: "16px 18px",
                  borderRadius: 14,
                  border: "1px solid #d1d5db",
                  fontSize: 18,
                  fontWeight: "bold",
                  cursor: bloqueado ? "not-allowed" : "pointer",
                  background: bloqueado
                    ? "#d1d5db"
                    : activo
                    ? "#16a34a"
                    : "#f3f4f6",
                  color: bloqueado ? "#6b7280" : activo ? "white" : "#111827",
                  opacity: bloqueado ? 0.7 : 1,
                }}
              >
                {b.nombre_bulto}
                <br />
                <span style={{ fontSize: 14 }}>{b.cantidad} pzs</span>
                {bloqueado && (
                  <>
                    <br />
                    <span style={{ fontSize: 14 }}>Registrado</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>
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
      setTimeout(() => setMensaje(""), 3000);
      return;
    }

    setMensaje("Avance guardado correctamente");
    setTimeout(() => setMensaje(""), 2000);

    setBultosSeleccionados([]);
    setNotas("");

    await cargarInicial();
    await cargarAvancesOrden(ordenId);
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "20px auto",
        padding: 16,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 10 }}>Captura rápida V2</h1>

      {mensaje && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: 15,
            borderRadius: 12,
            marginBottom: 15,
            fontWeight: "bold",
            border: "1px solid #86efac",
          }}
        >
          {mensaje}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div>
          <label style={{ fontWeight: "bold" }}>Empleado</label>
          <select
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
            style={{ width: "100%", padding: 12, marginTop: 6 }}
          >
            <option value="">Seleccione empleado</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontWeight: "bold" }}>Orden / Modelo</label>
          <select
            value={ordenId}
            onChange={(e) => cargarOrden(e.target.value)}
            style={{ width: "100%", padding: 12, marginTop: 6 }}
          >
            <option value="">Seleccione orden</option>
            {ordenes.map((o) => (
              <option key={o.id} value={o.id}>
                Orden #{o.id} - {o.modelos?.codigo} - {o.modelos?.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontWeight: "bold" }}>Proceso</label>
          <select
            value={procesoId}
            onChange={(e) => {
              setProcesoId(e.target.value);
              setBultosSeleccionados([]);
            }}
            style={{ width: "100%", padding: 12, marginTop: 6 }}
          >
            <option value="">Seleccione proceso</option>
            {procesos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} - ${p.costo}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 18,
          marginBottom: 18,
          background: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Bultos</h2>

        {renderGrupo("Chicas", bultosChicos)}
        {renderGrupo("Medianas", bultosMedianos)}
        {renderGrupo("Grandes", bultosGrandes)}

        {bultos.length === 0 && (
          <p>Selecciona una orden para ver los bultos.</p>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div style={{ border: "1px solid #ddd", padding: 18, borderRadius: 14 }}>
          <strong>Piezas</strong>
          <h2>{piezas}</h2>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 18, borderRadius: 14 }}>
          <strong>Precio por pieza</strong>
          <h2>${precio}</h2>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 18, borderRadius: 14 }}>
          <strong>Total</strong>
          <h2>${total}</h2>
        </div>
      </section>

      <textarea
        placeholder="Notas"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        style={{
          width: "100%",
          minHeight: 70,
          padding: 12,
          marginBottom: 14,
        }}
      />

      <button
        onClick={guardar}
        style={{
          width: "100%",
          padding: 20,
          fontSize: 24,
          borderRadius: 16,
          background: "#16a34a",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontWeight: "bold",
          marginBottom: 20,
        }}
      >
        Guardar avance
      </button>

      <h2>Últimos registros</h2>

      {historial.map((h) => (
        <div
          key={h.id}
          style={{
            border: "1px solid #ccc",
            padding: 12,
            marginBottom: 8,
            borderRadius: 10,
          }}
        >
          <strong>{h.proceso_nombre}</strong> — {h.bultos} —{" "}
          {h.cantidad_total} piezas — ${h.total_pago}
        </div>
      ))}
    </main>
  );
}