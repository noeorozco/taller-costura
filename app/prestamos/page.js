"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

const movimientoInicial = {
  empleado_id: "",
  tipo: "prestamo",
  concepto: "",
  monto: "",
  fecha: fechaHoy(),
  observaciones: "",
};

const abonoInicial = {
  monto: "",
  fecha: fechaHoy(),
  tipo: "abono",
  notas: "",
};

export default function PrestamosPage() {
  const [empleados, setEmpleados] = useState([]);
  const [adeudos, setAdeudos] = useState([]);
  const [abonos, setAbonos] = useState([]);

  const [form, setForm] = useState(movimientoInicial);
  const [formAbono, setFormAbono] = useState(abonoInicial);

  const [adeudoSeleccionado, setAdeudoSeleccionado] = useState(null);
  const [empleadoFiltro, setEmpleadoFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);

  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);

    await Promise.all([cargarEmpleados(), cargarAdeudos()]);

    setCargando(false);
  }

  async function cargarEmpleados() {
    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombre, alias, puesto, activo")
      .order("nombre");

    if (error) {
      alert(`Error al cargar trabajadores: ${error.message}`);
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
      alert(`Error al cargar movimientos: ${error.message}`);
      return;
    }

    setAdeudos(data || []);

    if (adeudoSeleccionado) {
      const actualizado = (data || []).find(
        (adeudo) => adeudo.id === adeudoSeleccionado.id
      );

      setAdeudoSeleccionado(actualizado || null);
    }
  }

  async function cargarAbonos(adeudoId) {
    const { data, error } = await supabase
      .from("empleado_adeudos_abonos")
      .select("*")
      .eq("adeudo_id", adeudoId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert(`Error al cargar abonos: ${error.message}`);
      return;
    }

    setAbonos(data || []);
  }

  function actualizarCampo(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function actualizarCampoAbono(campo, valor) {
    setFormAbono((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);

    setTimeout(() => {
      setMensaje("");
    }, 3000);
  }

  function limpiarMovimiento() {
    setForm((actual) => ({
      ...movimientoInicial,
      empleado_id: actual.empleado_id,
      fecha: fechaHoy(),
    }));
  }

  function limpiarAbono() {
    setFormAbono({
      ...abonoInicial,
      fecha: fechaHoy(),
    });
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

    const { error } = await supabase
      .from("empleado_adeudos")
      .insert([
        {
          empleado_id: Number(form.empleado_id),
          tipo: form.tipo,
          concepto: form.concepto.trim(),
          monto_original: monto,
          saldo: monto,
          fecha: form.fecha || fechaHoy(),
          estado: "pendiente",
          observaciones: form.observaciones.trim() || null,
        },
      ]);

    setGuardando(false);

    if (error) {
      alert(`No se pudo guardar: ${error.message}`);
      return;
    }

    limpiarMovimiento();
    mostrarMensaje("Movimiento registrado correctamente");
    await cargarAdeudos();
  }

  async function abrirAbonos(adeudo) {
    setAdeudoSeleccionado(adeudo);
    limpiarAbono();
    await cargarAbonos(adeudo.id);

    setTimeout(() => {
      document
        .getElementById("panel-abonos")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function guardarAbono() {
    if (guardando || !adeudoSeleccionado) return;

    const monto = Number(formAbono.monto);
    const saldoActual = Number(adeudoSeleccionado.saldo || 0);

    if (!monto || monto <= 0) {
      alert("Escribe una cantidad de abono mayor a cero");
      return;
    }

    if (monto > saldoActual) {
      alert(
        `El abono no puede ser mayor al saldo de $${saldoActual.toFixed(2)}`
      );
      return;
    }

    const confirmar = confirm(
      `¿Registrar un abono de $${monto.toFixed(2)}?`
    );

    if (!confirmar) return;

    setGuardando(true);

    const nuevoSaldo = Math.max(saldoActual - monto, 0);
    const nuevoEstado =
      nuevoSaldo === 0 ? "liquidado" : "pendiente";

    /*
      Primero guardamos el movimiento de abono.
      select().single() devuelve el registro recién creado.
    */
    const { data: abonoCreado, error: errorAbono } = await supabase
      .from("empleado_adeudos_abonos")
      .insert([
        {
          adeudo_id: adeudoSeleccionado.id,
          monto,
          fecha: formAbono.fecha || fechaHoy(),
          tipo: formAbono.tipo,
          notas: formAbono.notas.trim() || null,
        },
      ])
      .select()
      .single();

    if (errorAbono) {
      setGuardando(false);
      alert(`No se pudo guardar el abono: ${errorAbono.message}`);
      return;
    }

    const { error: errorSaldo } = await supabase
      .from("empleado_adeudos")
      .update({
        saldo: nuevoSaldo,
        estado: nuevoEstado,
        updated_at: new Date().toISOString(),
      })
      .eq("id", adeudoSeleccionado.id);

    if (errorSaldo) {
      /*
        Si falla la actualización del saldo,
        borramos el abono para no dejar datos incorrectos.
      */
      await supabase
        .from("empleado_adeudos_abonos")
        .delete()
        .eq("id", abonoCreado.id);

      setGuardando(false);
      alert(`No se pudo actualizar el saldo: ${errorSaldo.message}`);
      return;
    }

    setGuardando(false);
    limpiarAbono();

    mostrarMensaje(
      nuevoSaldo === 0
        ? "Abono registrado. El adeudo quedó liquidado"
        : "Abono registrado correctamente"
    );

    await cargarAdeudos();
    await cargarAbonos(adeudoSeleccionado.id);
  }

  async function cancelarMovimiento(adeudo) {
    const confirmar = confirm(
      `¿Deseas cancelar "${adeudo.concepto}"?\n\nEl historial no se eliminará.`
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

    if (adeudoSeleccionado?.id === adeudo.id) {
      setAdeudoSeleccionado(null);
      setAbonos([]);
    }

    mostrarMensaje("Movimiento cancelado");
    await cargarAdeudos();
  }

  async function reactivarMovimiento(adeudo) {
    const nuevoEstado =
      Number(adeudo.saldo || 0) > 0 ? "pendiente" : "liquidado";

    const { error } = await supabase
      .from("empleado_adeudos")
      .update({
        estado: nuevoEstado,
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
        (total, adeudo) => total + Number(adeudo.saldo || 0),
        0
      ),
    };
  }, [adeudos, empleadoFiltro]);

  const totalAbonado = adeudoSeleccionado
    ? Number(adeudoSeleccionado.monto_original || 0) -
      Number(adeudoSeleccionado.saldo || 0)
    : 0;

  return (
    <div>
      <h1>💰 Finanzas del trabajador</h1>

      <p style={textoIntroduccion}>
        Registra préstamos, adelantos, abonos y descuentos de nómina.
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
          <Resumen
            titulo="Adeudos pendientes"
            valor={resumen.cantidad}
          />

          <Resumen
            titulo="Monto original"
            valor={`$${resumen.montoOriginal.toFixed(2)}`}
          />

          <Resumen
            titulo="Saldo pendiente"
            valor={`$${resumen.saldoPendiente.toFixed(2)}`}
            rojo
          />
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
          onChange={(e) => actualizarCampo("tipo", e.target.value)}
          style={input}
        >
          <option value="prestamo">Préstamo</option>
          <option value="adelanto">Adelanto de sueldo</option>
          <option value="otro">Otro adeudo</option>
        </select>

        <label style={label}>Motivo o concepto</label>

        <input
          placeholder="Ejemplo: préstamo personal"
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
          onChange={(e) => actualizarCampo("monto", e.target.value)}
          style={input}
        />

        <label style={label}>Fecha</label>

        <input
          type="date"
          value={form.fecha}
          onChange={(e) => actualizarCampo("fecha", e.target.value)}
          style={input}
        />

        <label style={label}>Observaciones</label>

        <textarea
          placeholder="Información adicional..."
          value={form.observaciones}
          onChange={(e) =>
            actualizarCampo("observaciones", e.target.value)
          }
          style={{ ...input, minHeight: 80 }}
        />

        <button
          type="button"
          onClick={guardarMovimiento}
          disabled={guardando}
          style={botonPrincipal}
        >
          {guardando ? "Guardando..." : "Registrar movimiento"}
        </button>
      </section>

      <section style={card}>
        <h2>Movimientos registrados</h2>

        <input
          placeholder="Buscar trabajador o concepto..."
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
          Mostrar liquidados y cancelados
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
                  <th style={th}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {adeudosFiltrados.map((adeudo) => (
                  <tr key={adeudo.id}>
                    <td style={td}>{formatearFecha(adeudo.fecha)}</td>

                    <td style={td}>
                      <strong>
                        {adeudo.empleados?.nombre || "Trabajador"}
                      </strong>

                      {adeudo.empleados?.alias && (
                        <div style={textoSecundario}>
                          {adeudo.empleados.alias}
                        </div>
                      )}
                    </td>

                    <td style={td}>{nombreTipo(adeudo.tipo)}</td>

                    <td style={td}>
                      {adeudo.concepto}

                      {adeudo.observaciones && (
                        <div style={textoSecundario}>
                          {adeudo.observaciones}
                        </div>
                      )}
                    </td>

                    <td style={td}>
                      ${Number(adeudo.monto_original || 0).toFixed(2)}
                    </td>

                    <td style={td}>
                      <strong>
                        ${Number(adeudo.saldo || 0).toFixed(2)}
                      </strong>
                    </td>

                    <td style={td}>
                      <span style={estiloEstado(adeudo.estado)}>
                        {nombreEstado(adeudo.estado)}
                      </span>
                    </td>

                    <td style={td}>
                      <div style={acciones}>
                        <button
                          type="button"
                          onClick={() => abrirAbonos(adeudo)}
                          style={botonAbonar}
                        >
                          Ver / Abonar
                        </button>

                        {adeudo.estado === "cancelado" ? (
                          <button
                            type="button"
                            onClick={() => reactivarMovimiento(adeudo)}
                            style={botonReactivar}
                          >
                            Reactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => cancelarMovimiento(adeudo)}
                            style={botonCancelar}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
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

      {adeudoSeleccionado && (
        <section id="panel-abonos" style={card}>
          <div style={encabezadoPanel}>
            <div>
              <h2 style={{ margin: 0 }}>Abonos del adeudo</h2>

              <p style={textoSecundario}>
                {adeudoSeleccionado.empleados?.nombre} ·{" "}
                {adeudoSeleccionado.concepto}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setAdeudoSeleccionado(null);
                setAbonos([]);
              }}
              style={botonCerrar}
            >
              Cerrar
            </button>
          </div>

          <div style={resumenGrid}>
            <Resumen
              titulo="Monto original"
              valor={`$${Number(
                adeudoSeleccionado.monto_original || 0
              ).toFixed(2)}`}
            />

            <Resumen
              titulo="Total abonado"
              valor={`$${totalAbonado.toFixed(2)}`}
            />

            <Resumen
              titulo="Saldo pendiente"
              valor={`$${Number(
                adeudoSeleccionado.saldo || 0
              ).toFixed(2)}`}
              rojo
            />
          </div>

          {adeudoSeleccionado.estado === "pendiente" && (
            <div style={panelAbono}>
              <h3>Registrar abono</h3>

              <label style={label}>Tipo de abono</label>

              <select
                value={formAbono.tipo}
                onChange={(e) =>
                  actualizarCampoAbono("tipo", e.target.value)
                }
                style={input}
              >
                <option value="abono">Abono directo</option>
                <option value="descuento_nomina">
                  Descuento de nómina
                </option>
                <option value="ajuste">Ajuste</option>
              </select>

              <label style={label}>Cantidad</label>

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formAbono.monto}
                onChange={(e) =>
                  actualizarCampoAbono("monto", e.target.value)
                }
                style={input}
              />

              <label style={label}>Fecha</label>

              <input
                type="date"
                value={formAbono.fecha}
                onChange={(e) =>
                  actualizarCampoAbono("fecha", e.target.value)
                }
                style={input}
              />

              <label style={label}>Notas</label>

              <textarea
                placeholder="Ejemplo: descuento correspondiente a esta semana"
                value={formAbono.notas}
                onChange={(e) =>
                  actualizarCampoAbono("notas", e.target.value)
                }
                style={{ ...input, minHeight: 70 }}
              />

              <button
                type="button"
                onClick={guardarAbono}
                disabled={guardando}
                style={botonPrincipal}
              >
                {guardando ? "Guardando..." : "Registrar abono"}
              </button>
            </div>
          )}

          {adeudoSeleccionado.estado === "liquidado" && (
            <div style={mensajeLiquidado}>
              ✅ Este adeudo está completamente liquidado.
            </div>
          )}

          {adeudoSeleccionado.estado === "cancelado" && (
            <div style={mensajeCancelado}>
              Este adeudo está cancelado y no acepta abonos.
            </div>
          )}

          <h3>Historial de abonos</h3>

          <div style={{ overflowX: "auto" }}>
            <table style={tablaAbonos}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Cantidad</th>
                  <th style={th}>Notas</th>
                </tr>
              </thead>

              <tbody>
                {abonos.map((abono) => (
                  <tr key={abono.id}>
                    <td style={td}>{formatearFecha(abono.fecha)}</td>
                    <td style={td}>{nombreTipoAbono(abono.tipo)}</td>
                    <td style={td}>
                      <strong>
                        ${Number(abono.monto || 0).toFixed(2)}
                      </strong>
                    </td>
                    <td style={td}>{abono.notas || "—"}</td>
                  </tr>
                ))}

                {abonos.length === 0 && (
                  <tr>
                    <td colSpan="4" style={tablaVacia}>
                      Este adeudo todavía no tiene abonos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Resumen({ titulo, valor, rojo = false }) {
  return (
    <div style={resumenCaja}>
      <span style={resumenEtiqueta}>{titulo}</span>
      <strong style={rojo ? resumenNumeroRojo : resumenNumero}>
        {valor}
      </strong>
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

function nombreTipoAbono(tipo) {
  if (tipo === "descuento_nomina") return "Descuento de nómina";
  if (tipo === "ajuste") return "Ajuste";
  return "Abono directo";
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
  };

  if (estado === "liquidado") {
    return { ...base, background: "#dcfce7", color: "#166534" };
  }

  if (estado === "cancelado") {
    return { ...base, background: "#e5e7eb", color: "#4b5563" };
  }

  return { ...base, background: "#fef3c7", color: "#92400e" };
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
  cursor: "pointer",
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
};

const tabla = {
  width: "100%",
  minWidth: 900,
  borderCollapse: "collapse",
};

const tablaAbonos = {
  width: "100%",
  minWidth: 600,
  borderCollapse: "collapse",
};

const th = {
  borderBottom: "1px solid #d1d5db",
  padding: 10,
  textAlign: "left",
  background: "#f9fafb",
  whiteSpace: "nowrap",
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

const acciones = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const botonAbonar = {
  padding: "7px 10px",
  border: "none",
  borderRadius: 6,
  background: "#dbeafe",
  color: "#1d4ed8",
  cursor: "pointer",
  fontWeight: "bold",
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

const encabezadoPanel = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 15,
};

const botonCerrar = {
  padding: "8px 12px",
  border: "none",
  borderRadius: 7,
  background: "#e5e7eb",
  cursor: "pointer",
  fontWeight: "bold",
};

const panelAbono = {
  marginTop: 20,
  marginBottom: 25,
  padding: 16,
  borderRadius: 10,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const mensajeLiquidado = {
  padding: 14,
  marginTop: 20,
  marginBottom: 20,
  borderRadius: 8,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: "bold",
};

const mensajeCancelado = {
  padding: 14,
  marginTop: 20,
  marginBottom: 20,
  borderRadius: 8,
  background: "#e5e7eb",
  color: "#4b5563",
  fontWeight: "bold",
};