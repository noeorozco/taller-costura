"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

function obtenerFechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

const formularioInicial = {
  empleado_id: "",
  tipo: "prestamo",
  concepto: "",
  monto: "",
  fecha: obtenerFechaHoy(),
  observaciones: "",
};

export default function PrestamosPage() {
  const [empleados, setEmpleados] = useState([]);
  const [adeudos, setAdeudos] = useState([]);
  const [form, setForm] = useState(formularioInicial);

  const [empleadoFiltro, setEmpleadoFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);

  useEffect(() => {
    cargarInformacion();
  }, []);

  async function cargarInformacion() {
    setCargando(true);

    await Promise.all([cargarEmpleados(), cargarAdeudos()]);

    setCargando(false);
  }

  async function cargarEmpleados() {
    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombre, alias, puesto, activo")
      .order("nombre", { ascending: true });

    if (error) {
      alert(`No se pudieron cargar los trabajadores: ${error.message}`);
      return;
    }

    setEmpleados(data || []);
  }

  async function cargarAdeudos() {
    const { data, error } = await supabase
      .from("empleado_adeudos")
      .select(`
        id,
        empleado_id,
        tipo,
        concepto,
        monto_original,
        saldo,
        fecha,
        estado,
        observaciones,
        created_at,
        empleados (
          id,
          nombre,
          alias,
          puesto
        )
      `)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert(`No se pudieron cargar los adeudos: ${error.message}`);
      return;
    }

    setAdeudos(data || []);
  }

  function actualizarCampo(campo, valor) {
    setForm((formularioActual) => ({
      ...formularioActual,
      [campo]: valor,
    }));
  }

  function limpiarFormulario() {
    setForm({
      ...formularioInicial,
      empleado_id: form.empleado_id,
      fecha: obtenerFechaHoy(),
    });
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);

    setTimeout(() => {
      setMensaje("");
    }, 3000);
  }

  async function guardarMovimiento() {
    if (guardando) return;

    if (!form.empleado_id) {
      alert("Selecciona un trabajador");
      return;
    }

    if (!form.concepto.trim()) {
      alert("Escribe el motivo o concepto");
      return;
    }

    const monto = Number(form.monto);

    if (!monto || monto <= 0) {
      alert("Escribe una cantidad mayor a cero");
      return;
    }

    setGuardando(true);

    const datos = {
      empleado_id: Number(form.empleado_id),
      tipo: form.tipo,
      concepto: form.concepto.trim(),
      monto_original: monto,
      saldo: monto,
      fecha: form.fecha || obtenerFechaHoy(),
      estado: "pendiente",
      observaciones: form.observaciones.trim() || null,
    };

    const { error } = await supabase
      .from("empleado_adeudos")
      .insert([datos]);

    setGuardando(false);

    if (error) {
      alert(`No se pudo guardar: ${error.message}`);
      return;
    }

    mostrarMensaje("Movimiento registrado correctamente");
    limpiarFormulario();
    await cargarAdeudos();
  }

  async function cancelarMovimiento(adeudo) {
    const confirmar = confirm(
      `¿Deseas cancelar el movimiento "${adeudo.concepto}"?\n\nNo se eliminará; quedará guardado como cancelado.`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("empleado_adeudos")
      .update({
        estado: "cancelado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", adeudo.id);

    if (error) {
      alert(error.message);
      return;
    }

    mostrarMensaje("Movimiento cancelado");
    await cargarAdeudos();
  }

  async function reactivarMovimiento(adeudo) {
    const estado =
      Number(adeudo.saldo || 0) > 0 ? "pendiente" : "liquidado";

    const { error } = await supabase
      .from("empleado_adeudos")
      .update({
        estado,
        updated_at: new Date().toISOString(),
      })
      .eq("id", adeudo.id);

    if (error) {
      alert(error.message);
      return;
    }

    mostrarMensaje("Movimiento reactivado");
    await cargarAdeudos();
  }

  const adeudosFiltrados = useMemo(() => {
    return adeudos.filter((adeudo) => {
      if (
        empleadoFiltro &&
        String(adeudo.empleado_id) !== String(empleadoFiltro)
      ) {
        return false;
      }

      if (!mostrarFinalizados && adeudo.estado !== "pendiente") {
        return false;
      }

      const texto = `
        ${adeudo.empleados?.nombre || ""}
        ${adeudo.empleados?.alias || ""}
        ${adeudo.tipo || ""}
        ${adeudo.concepto || ""}
        ${adeudo.observaciones || ""}
        ${adeudo.estado || ""}
      `.toLowerCase();

      return texto.includes(busqueda.toLowerCase());
    });
  }, [adeudos, empleadoFiltro, busqueda, mostrarFinalizados]);

  const resumen = useMemo(() => {
    const pendientes = adeudos.filter((adeudo) => {
      if (adeudo.estado !== "pendiente") return false;

      if (
        empleadoFiltro &&
        String(adeudo.empleado_id) !== String(empleadoFiltro)
      ) {
        return false;
      }

      return true;
    });

    return {
      cantidad: pendientes.length,

      montoOriginal: pendientes.reduce(
        (total, adeudo) =>
          total + Number(adeudo.monto_original || 0),
        0
      ),

      saldoPendiente: pendientes.reduce(
        (total, adeudo) =>
          total + Number(adeudo.saldo || 0),
        0
      ),
    };
  }, [adeudos, empleadoFiltro]);

  return (
    <div>
      <h1>💰 Finanzas del trabajador</h1>

      <p style={textoIntroduccion}>
        Registra préstamos, adelantos y otros adeudos de los trabajadores.
      </p>

      {mensaje && <div style={mensajeExito}>{mensaje}</div>}

      <section style={card}>
        <h2>Resumen de adeudos</h2>

        <label style={label}>Consultar trabajador</label>

        <select
          value={empleadoFiltro}
          onChange={(e) => setEmpleadoFiltro(e.target.value)}
          style={input}
        >
          <option value="">Todos los trabajadores</option>

          {empleados.map((empleado) => (
            <option key={empleado.id} value={empleado.id}>
              {empleado.nombre}
              {empleado.alias ? ` (${empleado.alias})` : ""}
            </option>
          ))}
        </select>

        <div style={resumenGrid}>
          <div style={resumenCaja}>
            <span style={resumenEtiqueta}>Adeudos pendientes</span>
            <strong style={resumenNumero}>
              {resumen.cantidad}
            </strong>
          </div>

          <div style={resumenCaja}>
            <span style={resumenEtiqueta}>Monto original</span>
            <strong style={resumenNumero}>
              ${resumen.montoOriginal.toFixed(2)}
            </strong>
          </div>

          <div style={resumenCaja}>
            <span style={resumenEtiqueta}>Saldo pendiente</span>
            <strong style={resumenNumeroRojo}>
              ${resumen.saldoPendiente.toFixed(2)}
            </strong>
          </div>
        </div>
      </section>

      <section style={card}>
        <h2>Registrar movimiento</h2>

        <label style={label}>Trabajador</label>

        <select
          value={form.empleado_id}
          onChange={(e) =>
            actualizarCampo("empleado_id", e.target.value)
          }
          style={input}
        >
          <option value="">Selecciona un trabajador</option>

          {empleados
            .filter((empleado) => empleado.activo)
            .map((empleado) => (
              <option key={empleado.id} value={empleado.id}>
                {empleado.nombre}
                {empleado.alias ? ` (${empleado.alias})` : ""}
              </option>
            ))}
        </select>

        <label style={label}>Tipo de movimiento</label>

        <select
          value={form.tipo}
          onChange={(e) =>
            actualizarCampo("tipo", e.target.value)
          }
          style={input}
        >
          <option value="prestamo">Préstamo</option>
          <option value="adelanto">Adelanto de sueldo</option>
          <option value="otro">Otro adeudo</option>
        </select>

        <label style={label}>Motivo o concepto</label>

        <input
          placeholder="Ejemplo: préstamo personal o adelanto semanal"
          value={form.concepto}
          onChange={(e) =>
            actualizarCampo("concepto", e.target.value)
          }
          style={input}
        />

        <label style={label}>Cantidad</label>

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={form.monto}
          onChange={(e) =>
            actualizarCampo("monto", e.target.value)
          }
          style={input}
        />

        <label style={label}>Fecha</label>

        <input
          type="date"
          value={form.fecha}
          onChange={(e) =>
            actualizarCampo("fecha", e.target.value)
          }
          style={input}
        />

        <label style={label}>Observaciones</label>

        <textarea
          placeholder="Información adicional..."
          value={form.observaciones}
          onChange={(e) =>
            actualizarCampo("observaciones", e.target.value)
          }
          style={{
            ...input,
            minHeight: 80,
            resize: "vertical",
          }}
        />

        <button
          type="button"
          onClick={guardarMovimiento}
          disabled={guardando}
          style={{
            ...botonPrincipal,
            opacity: guardando ? 0.65 : 1,
            cursor: guardando ? "not-allowed" : "pointer",
          }}
        >
          {guardando ? "Guardando..." : "Registrar movimiento"}
        </button>
      </section>

      <section style={card}>
        <h2>Movimientos registrados</h2>

        <input
          placeholder="Buscar trabajador, concepto o tipo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={input}
        />

        <label style={checkboxLabel}>
          <input
            type="checkbox"
            checked={mostrarFinalizados}
            onChange={(e) =>
              setMostrarFinalizados(e.target.checked)
            }
          />

          Mostrar también movimientos liquidados y cancelados
        </label>

        {cargando ? (
          <p>Cargando movimientos...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tabla}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Trabajador</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Concepto</th>
                  <th style={th}>Monto</th>
                  <th style={th}>Saldo</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Acción</th>
                </tr>
              </thead>

              <tbody>
                {adeudosFiltrados.map((adeudo) => (
                  <tr key={adeudo.id}>
                    <td style={td}>
                      {formatearFecha(adeudo.fecha)}
                    </td>

                    <td style={td}>
                      <strong>
                        {adeudo.empleados?.nombre ||
                          "Trabajador"}
                      </strong>

                      {adeudo.empleados?.alias && (
                        <div style={textoSecundario}>
                          {adeudo.empleados.alias}
                        </div>
                      )}
                    </td>

                    <td style={td}>
                      {nombreTipo(adeudo.tipo)}
                    </td>

                    <td style={td}>
                      {adeudo.concepto}

                      {adeudo.observaciones && (
                        <div style={textoSecundario}>
                          {adeudo.observaciones}
                        </div>
                      )}
                    </td>

                    <td style={td}>
                      $
                      {Number(
                        adeudo.monto_original || 0
                      ).toFixed(2)}
                    </td>

                    <td style={td}>
                      <strong>
                        $
                        {Number(
                          adeudo.saldo || 0
                        ).toFixed(2)}
                      </strong>
                    </td>

                    <td style={td}>
                      <span style={estiloEstado(adeudo.estado)}>
                        {nombreEstado(adeudo.estado)}
                      </span>
                    </td>

                    <td style={td}>
                      {adeudo.estado === "cancelado" ? (
                        <button
                          type="button"
                          onClick={() =>
                            reactivarMovimiento(adeudo)
                          }
                          style={botonReactivar}
                        >
                          Reactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            cancelarMovimiento(adeudo)
                          }
                          style={botonCancelar}
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {adeudosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="8" style={tablaVacia}>
                      No hay movimientos para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatearFecha(fecha) {
  if (!fecha) return "—";

  const [anio, mes, dia] = fecha.split("-");

  return `${dia}/${mes}/${anio}`;
}

function nombreTipo(tipo) {
  if (tipo === "adelanto") return "Adelanto";
  if (tipo === "otro") return "Otro adeudo";

  return "Préstamo";
}

function nombreEstado(estado) {
  if (estado === "liquidado") return "Liquidado";
  if (estado === "cancelado") return "Cancelado";

  return "Pendiente";
}

function estiloEstado(estado) {
  const base = {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: "bold",
    whiteSpace: "nowrap",
  };

  if (estado === "liquidado") {
    return {
      ...base,
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (estado === "cancelado") {
    return {
      ...base,
      background: "#e5e7eb",
      color: "#4b5563",
    };
  }

  return {
    ...base,
    background: "#fef3c7",
    color: "#92400e",
  };
}

const textoIntroduccion = {
  color: "#4b5563",
  marginTop: -5,
  marginBottom: 20,
};

const mensajeExito = {
  background: "#dcfce7",
  color: "#166534",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
  fontWeight: "bold",
};

const card = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  marginBottom: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const label = {
  display: "block",
  marginTop: 6,
  fontWeight: "bold",
  color: "#374151",
};

const input = {
  width: "100%",
  padding: 10,
  marginTop: 8,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
  fontSize: 16,
};

const botonPrincipal = {
  padding: "12px 18px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
};

const resumenGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const resumenCaja = {
  background: "#f9fafb",
  padding: 15,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};

const resumenEtiqueta = {
  display: "block",
  color: "#6b7280",
  fontSize: 14,
  marginBottom: 6,
};

const resumenNumero = {
  fontSize: 22,
  color: "#111827",
};

const resumenNumeroRojo = {
  fontSize: 22,
  color: "#b91c1c",
};

const checkboxLabel = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 15,
  color: "#374151",
};

const tabla = {
  width: "100%",
  minWidth: 850,
  borderCollapse: "collapse",
};

const th = {
  borderBottom: "1px solid #d1d5db",
  padding: 10,
  textAlign: "left",
  whiteSpace: "nowrap",
  background: "#f9fafb",
};

const td = {
  borderBottom: "1px solid #eee",
  padding: 10,
  verticalAlign: "top",
};

const tablaVacia = {
  padding: 25,
  textAlign: "center",
  color: "#6b7280",
};

const textoSecundario = {
  marginTop: 4,
  color: "#6b7280",
  fontSize: 13,
};

const botonCancelar = {
  padding: "7px 10px",
  border: "none",
  borderRadius: 6,
  background: "#fee2e2",
  color: "#b91c1c",
  cursor: "pointer",
  fontWeight: "bold",
};

const botonReactivar = {
  padding: "7px 10px",
  border: "none",
  borderRadius: 6,
  background: "#dcfce7",
  color: "#166534",
  cursor: "pointer",
  fontWeight: "bold",
};