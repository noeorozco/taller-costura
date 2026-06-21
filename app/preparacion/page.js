"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const crearFilas = (prefijo) => [
  { nombre: `${prefijo}1`, cantidad: "" },
];

export default function PreparacionPage() {
  const [empleados, setEmpleados] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [mensaje, setMensaje] = useState("");

  const [nombreEmpleado, setNombreEmpleado] = useState("");
  const [puestoEmpleado, setPuestoEmpleado] = useState("");

  const [codigoModelo, setCodigoModelo] = useState("");
  const [nombreModelo, setNombreModelo] = useState("");
  const [descripcionModelo, setDescripcionModelo] = useState("");

  const [modeloSeleccionado, setModeloSeleccionado] = useState("");
  const [nombreProceso, setNombreProceso] = useState("");
  const [precioProceso, setPrecioProceso] = useState("");
  const [procesosModelo, setProcesosModelo] = useState([]);

  const [clienteOrden, setClienteOrden] = useState("");
  const [modeloOrdenId, setModeloOrdenId] = useState("");
  const [totalCH, setTotalCH] = useState("");
  const [totalM, setTotalM] = useState("");
  const [totalG, setTotalG] = useState("");
  const [notasOrden, setNotasOrden] = useState("");
  const [ordenCreadaId, setOrdenCreadaId] = useState("");

  const [tabActiva, setTabActiva] = useState("CH");
  const [filasCH, setFilasCH] = useState(crearFilas("CH"));
  const [filasM, setFilasM] = useState(crearFilas("M"));
  const [filasG, setFilasG] = useState(crearFilas("G"));

  const totalGeneral =
    Number(totalCH || 0) + Number(totalM || 0) + Number(totalG || 0);

  const totalCapturadoCH = filasCH.reduce((s, f) => s + Number(f.cantidad || 0), 0);
  const totalCapturadoM = filasM.reduce((s, f) => s + Number(f.cantidad || 0), 0);
  const totalCapturadoG = filasG.reduce((s, f) => s + Number(f.cantidad || 0), 0);
  const totalCapturado = totalCapturadoCH + totalCapturadoM + totalCapturadoG;

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: emp } = await supabase.from("empleados").select("*").order("nombre");
    const { data: mod } = await supabase.from("modelos").select("*").order("id", { ascending: false });

    setEmpleados(emp || []);
    setModelos(mod || []);
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), 2500);
  }

  async function guardarEmpleado() {
    if (!nombreEmpleado) return alert("Escribe el nombre del trabajador");

    const { error } = await supabase.from("empleados").insert([
      { nombre: nombreEmpleado, puesto: puestoEmpleado, activo: true },
    ]);

    if (error) return alert(error.message);

    setNombreEmpleado("");
    setPuestoEmpleado("");
    mostrarMensaje("Trabajador guardado");
    cargarDatos();
  }

  async function guardarModelo() {
    if (!codigoModelo || !nombreModelo) return alert("Escribe código y nombre del modelo");

    const { error } = await supabase.from("modelos").insert([
      { codigo: codigoModelo, nombre: nombreModelo, descripcion: descripcionModelo },
    ]);

    if (error) return alert(error.message);

    setCodigoModelo("");
    setNombreModelo("");
    setDescripcionModelo("");
    mostrarMensaje("Modelo guardado");
    cargarDatos();
  }

  async function cargarProcesos(idModelo) {
    setModeloSeleccionado(idModelo);

    const { data } = await supabase
      .from("modelo_procesos")
      .select("*")
      .eq("modelo_id", Number(idModelo))
      .order("orden");

    setProcesosModelo(data || []);
  }
    async function guardarProceso() {
    if (!modeloSeleccionado) return alert("Selecciona un modelo");
    if (!nombreProceso) return alert("Escribe el proceso");

    const { error } = await supabase.from("modelo_procesos").insert([
      {
        modelo_id: Number(modeloSeleccionado),
        nombre: nombreProceso,
        costo: Number(precioProceso || 0),
        orden: procesosModelo.length + 1,
      },
    ]);

    if (error) return alert(error.message);

    setNombreProceso("");
    setPrecioProceso("");
    mostrarMensaje("Proceso agregado");
    cargarProcesos(modeloSeleccionado);
  }

  async function crearOrden() {
    if (!modeloOrdenId) return alert("Selecciona modelo");
    if (totalGeneral <= 0) return alert("Captura las cantidades por talla");

    const { data, error } = await supabase
      .from("ordenes_produccion")
      .insert([
        {
          modelo_id: Number(modeloOrdenId),
          cantidad: totalGeneral,
          total_ch: Number(totalCH || 0),
          total_m: Number(totalM || 0),
          total_g: Number(totalG || 0),
          cliente: clienteOrden,
          notas: notasOrden,
        },
      ])
      .select()
      .single();

    if (error) return alert(error.message);

    setOrdenCreadaId(data.id);
    mostrarMensaje("Orden creada");
  }

  function actualizarFila(tipo, index, valor) {
    const actualizar = (filas, setFilas) => {
      const copia = [...filas];
      copia[index].cantidad = valor;
      setFilas(copia);
    };

    if (tipo === "CH") actualizar(filasCH, setFilasCH);
    if (tipo === "M") actualizar(filasM, setFilasM);
    if (tipo === "G") actualizar(filasG, setFilasG);
  }

  function agregarFila(tipo) {
    if (tipo === "CH") {
      setFilasCH((actual) => [
        ...actual,
        { nombre: `CH${actual.length + 1}`, cantidad: "" },
      ]);
    }

    if (tipo === "M") {
      setFilasM((actual) => [
        ...actual,
        { nombre: `M${actual.length + 1}`, cantidad: "" },
      ]);
    }

    if (tipo === "G") {
      setFilasG((actual) => [
        ...actual,
        { nombre: `G${actual.length + 1}`, cantidad: "" },
      ]);
    }
  }

  function teclaCantidad(e, tipo, index, totalFilas) {
    if (e.key !== "Enter" && e.key !== "Tab") return;

    if (e.key === "Enter") e.preventDefault();

    if (index === totalFilas - 1) {
      agregarFila(tipo);

      setTimeout(() => {
        const siguiente = document.getElementById(`${tipo}-${index + 1}`);
        if (siguiente) siguiente.focus();
      }, 50);
    }
  }

  function datosTalla(tipo) {
    if (tipo === "CH") {
      return {
        filas: filasCH,
        esperado: totalCH,
        capturado: totalCapturadoCH,
        titulo: "Chicas",
      };
    }

    if (tipo === "M") {
      return {
        filas: filasM,
        esperado: totalM,
        capturado: totalCapturadoM,
        titulo: "Medianas",
      };
    }

    return {
      filas: filasG,
      esperado: totalG,
      capturado: totalCapturadoG,
      titulo: "Grandes",
    };
  }

  function renderCapturaBultos() {
    const { filas, esperado, capturado, titulo } = datosTalla(tabActiva);
    const diferencia = Number(esperado || 0) - Number(capturado || 0);

    return (
      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 12,
        }}
      >
        <h2>{titulo}</h2>

        <h3>
          Esperadas: {Number(esperado || 0)} | Capturadas: {capturado}
        </h3>

        {diferencia === 0 ? (
          <h3 style={{ color: "green" }}>Correcto</h3>
        ) : diferencia > 0 ? (
          <h3 style={{ color: "orange" }}>Faltan {diferencia}</h3>
        ) : (
          <h3 style={{ color: "red" }}>Sobran {Math.abs(diferencia)}</h3>
        )}

        <table border="1" cellPadding="8" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Bulto</th>
              <th>Cantidad</th>
            </tr>
          </thead>

          <tbody>
            {filas.map((fila, index) => (
              <tr key={fila.nombre}>
                <td style={{ fontWeight: "bold", width: 120 }}>
                  {fila.nombre}
                </td>

                <td>
                  <input
                    id={`${tabActiva}-${index}`}
                    type="number"
                    inputMode="numeric"
                    value={fila.cantidad}
                    onChange={(e) =>
                      actualizarFila(tabActiva, index, e.target.value)
                    }
                    onKeyDown={(e) =>
                      teclaCantidad(e, tabActiva, index, filas.length)
                    }
                    style={{
                      width: "100%",
                      padding: 12,
                      fontSize: 18,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={() => agregarFila(tabActiva)}
          style={{ marginTop: 12, padding: 10 }}
        >
          Agregar otro bulto
        </button>
      </section>
    );
  }

  async function guardarBultos() {
    if (!ordenCreadaId) return alert("Primero crea una orden");

    if (totalCapturadoCH !== Number(totalCH || 0)) {
      return alert("Las piezas CH no coinciden");
    }

    if (totalCapturadoM !== Number(totalM || 0)) {
      return alert("Las piezas M no coinciden");
    }

    if (totalCapturadoG !== Number(totalG || 0)) {
      return alert("Las piezas G no coinciden");
    }

    const registros = [
      ...filasCH
        .filter((f) => Number(f.cantidad || 0) > 0)
        .map((f) => ({
          orden_id: Number(ordenCreadaId),
          nombre_bulto: f.nombre,
          talla: "CH",
          cantidad: Number(f.cantidad),
        })),

      ...filasM
        .filter((f) => Number(f.cantidad || 0) > 0)
        .map((f) => ({
          orden_id: Number(ordenCreadaId),
          nombre_bulto: f.nombre,
          talla: "M",
          cantidad: Number(f.cantidad),
        })),

      ...filasG
        .filter((f) => Number(f.cantidad || 0) > 0)
        .map((f) => ({
          orden_id: Number(ordenCreadaId),
          nombre_bulto: f.nombre,
          talla: "G",
          cantidad: Number(f.cantidad),
        })),
    ];

    if (registros.length === 0) return alert("No hay bultos para guardar");

    const { error } = await supabase.from("orden_bultos").insert(registros);

    if (error) return alert(error.message);

   mostrarMensaje("Bultos guardados correctamente. La orden ya está lista para producción.");

setTimeout(() => {
  window.location.href = "/rapido-v2";
}, 1500);
  }
    return (
    <main style={{ maxWidth: 1100, margin: "20px auto", padding: 16 }}>
      <h1>Preparación para producción</h1>

      {mensaje && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: 14,
            borderRadius: 10,
            marginBottom: 15,
            fontWeight: "bold",
          }}
        >
          {mensaje}
        </div>
      )}

      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <h2>1. Registrar trabajador</h2>

        <input
          placeholder="Nombre del trabajador"
          value={nombreEmpleado}
          onChange={(e) => setNombreEmpleado(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          placeholder="Puesto"
          value={puestoEmpleado}
          onChange={(e) => setPuestoEmpleado(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <button onClick={guardarEmpleado}>Guardar trabajador</button>

        <h3>Trabajadores registrados</h3>

        {empleados.map((e) => (
          <p key={e.id}>
            {e.nombre} — {e.puesto}
          </p>
        ))}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <h2>2. Registrar modelo</h2>

        <input
          placeholder="Código, ejemplo V-1130"
          value={codigoModelo}
          onChange={(e) => setCodigoModelo(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          placeholder="Nombre del modelo"
          value={nombreModelo}
          onChange={(e) => setNombreModelo(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <textarea
          placeholder="Descripción"
          value={descripcionModelo}
          onChange={(e) => setDescripcionModelo(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <button onClick={guardarModelo}>Guardar modelo</button>

        <h3>Modelos registrados</h3>

        {modelos.map((m) => (
          <p key={m.id}>
            {m.codigo} — {m.nombre}
          </p>
        ))}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <h2>3. Procesos del modelo</h2>

        <select
          value={modeloSeleccionado}
          onChange={(e) => cargarProcesos(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        >
          <option value="">Seleccione modelo</option>

          {modelos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.codigo} - {m.nombre}
            </option>
          ))}
        </select>

        <input
          placeholder="Proceso"
          value={nombreProceso}
          onChange={(e) => setNombreProceso(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          placeholder="Precio"
          type="number"
          step="0.01"
          value={precioProceso}
          onChange={(e) => setPrecioProceso(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <button onClick={guardarProceso}>Agregar proceso</button>

        <h3>Procesos registrados</h3>

        {procesosModelo.map((p) => (
          <p key={p.id}>
            {p.orden}. {p.nombre} — ${p.costo}
          </p>
        ))}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 12,
        }}
      >
        <h2>4. Crear orden de producción</h2>

        <input
          placeholder="Cliente"
          value={clienteOrden}
          onChange={(e) => setClienteOrden(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <select
          value={modeloOrdenId}
          onChange={(e) => setModeloOrdenId(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        >
          <option value="">Seleccione modelo</option>

          {modelos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.codigo} - {m.nombre}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Total CHICAS"
          value={totalCH}
          onChange={(e) => setTotalCH(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          type="number"
          placeholder="Total MEDIANAS"
          value={totalM}
          onChange={(e) => setTotalM(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          type="number"
          placeholder="Total GRANDES"
          value={totalG}
          onChange={(e) => setTotalG(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <h2>Total: {totalGeneral} piezas</h2>

        <textarea
          placeholder="Notas"
          value={notasOrden}
          onChange={(e) => setNotasOrden(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <button onClick={crearOrden}>Crear orden</button>

        {ordenCreadaId && (
          <>
            <hr style={{ margin: "25px 0" }} />

            <h2>5. Capturar bultos</h2>

            <p>
              Orden creada: <strong>#{ordenCreadaId}</strong>
            </p>

            <h2>
              Total capturado: {totalCapturado} / {totalGeneral}
            </h2>

            <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
              <button
                onClick={() => setTabActiva("CH")}
                style={{
                  padding: 12,
                  fontWeight: "bold",
                  background: tabActiva === "CH" ? "#16a34a" : "#eee",
                  color: tabActiva === "CH" ? "white" : "black",
                }}
              >
                Chicas
              </button>

              <button
                onClick={() => setTabActiva("M")}
                style={{
                  padding: 12,
                  fontWeight: "bold",
                  background: tabActiva === "M" ? "#16a34a" : "#eee",
                  color: tabActiva === "M" ? "white" : "black",
                }}
              >
                Medianas
              </button>

              <button
                onClick={() => setTabActiva("G")}
                style={{
                  padding: 12,
                  fontWeight: "bold",
                  background: tabActiva === "G" ? "#16a34a" : "#eee",
                  color: tabActiva === "G" ? "white" : "black",
                }}
              >
                Grandes
              </button>
            </div>

            {renderCapturaBultos()}

            <button
              onClick={guardarBultos}
              style={{
                width: "100%",
                padding: 18,
                fontSize: 20,
                fontWeight: "bold",
                marginTop: 20,
              }}
            >
              Guardar bultos
            </button>
          </>
        )}
      </section>
    </main>
  );
}