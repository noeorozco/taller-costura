"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NominaPage() {
  const [semanaAbierta, setSemanaAbierta] = useState(null);
  const [asignaciones, setAsignaciones] = useState([]);
  const [trabajosTiempo, setTrabajosTiempo] = useState([]);
  const [adeudos, setAdeudos] = useState([]);
  const [historial, setHistorial] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [empleadoAbierto, setEmpleadoAbierto] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarTodo();
  }, []);

  function mostrarMensaje(texto) {
    setMensaje(texto);

    setTimeout(() => {
      setMensaje("");
    }, 4000);
  }

  async function cargarTodo() {
    setCargando(true);

    try {
      const semana = await obtenerOCrearSemanaAbierta();

      setSemanaAbierta(semana);

      await Promise.all([
        cargarAsignacionesPendientes(semana),
        cargarTrabajosTiempoPendientes(semana),
        cargarAdeudosPendientes(),
        cargarHistorial(),
      ]);
    } catch (error) {
      console.error("Error cargando nómina:", error);
      alert(error.message || "No se pudo cargar la nómina");
    } finally {
      setCargando(false);
    }
  }

  async function obtenerOCrearSemanaAbierta() {
    const lunes = obtenerLunesActual();
    const fechaInicio = formatearFechaBD(lunes);

    /*
      IMPORTANTE:
      Ya no buscamos simplemente "la última semana abierta".

      Ahora buscamos específicamente una semana abierta cuyo
      fecha_inicio sea el lunes de la semana ACTUAL.

      Esto evita que una semana antigua, por ejemplo la del
      3 de agosto, siga apareciendo en septiembre.
    */
    const { data: semanaActual, error: errorActual } =
      await supabase
        .from("semanas_nomina")
        .select("*")
        .eq("estado", "Abierta")
        .eq("fecha_inicio", fechaInicio)
        .limit(1)
        .maybeSingle();

    if (errorActual) {
      throw errorActual;
    }

    if (semanaActual) {
      return semanaActual;
    }

    /*
      Si existe alguna semana antigua que se quedó abierta,
      la cerramos administrativamente.

      No asignamos trabajos a esa semana aquí.
      Simplemente impedimos que siga apareciendo como actual.
    */
    const { error: errorSemanasViejas } = await supabase
      .from("semanas_nomina")
      .update({
        estado: "Cerrada",
        fecha_cierre: new Date().toISOString(),
      })
      .eq("estado", "Abierta")
      .neq("fecha_inicio", fechaInicio);

    if (errorSemanasViejas) {
      throw errorSemanasViejas;
    }

    /*
      Creamos la semana vigente.

      Guardamos YYYY-MM-DD en vez de convertir el lunes
      directamente a UTC. Esto evita desfases de fecha
      por la zona horaria de México.
    */
    const { data: nuevaSemana, error: errorCreacion } =
      await supabase
        .from("semanas_nomina")
        .insert([
          {
            fecha_inicio: fechaInicio,
            estado: "Abierta",
            total_nomina: 0,
          },
        ])
        .select()
        .single();

    if (errorCreacion) {
      throw errorCreacion;
    }

    return nuevaSemana;
  }

  async function cargarAsignacionesPendientes(semana = null) {
    const semanaUsar = semana || semanaAbierta;

    if (!semanaUsar?.fecha_inicio) {
      setAsignaciones([]);
      return;
    }

    const inicio = convertirFechaLocal(
      semanaUsar.fecha_inicio
    );

    inicio.setHours(0, 0, 0, 0);

    const fin = obtenerSabadoDesdeInicio(
      semanaUsar.fecha_inicio
    );

    const { data, error } = await supabase
      .from("asignaciones")
      .select(`
        id,
        empleado_id,
        orden_id,
        proceso_id,
        orden_bulto_id,
        estado,
        fecha_terminado,
        semana_nomina_id,
        empleados(
          id,
          nombre,
          alias,
          puesto
        ),
        modelo_procesos(
          id,
          nombre,
          costo
        ),
        orden_bultos_v2(
          id,
          nombre_bulto,
          talla,
          cantidad
        ),
        ordenes(
          id,
          folio,
          cliente,
          modelos(
            id,
            codigo,
            nombre
          )
        )
      `)
      .eq("estado", "Terminado")
      .is("semana_nomina_id", null)
      .gte("fecha_terminado", inicio.toISOString())
      .lte("fecha_terminado", fin.toISOString())
      .order("fecha_terminado", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    setAsignaciones(data || []);
  }

  async function cargarTrabajosTiempoPendientes(
    semana = null
  ) {
    const semanaUsar = semana || semanaAbierta;

    if (!semanaUsar?.fecha_inicio) {
      setTrabajosTiempo([]);
      return;
    }

    const inicio = convertirFechaLocal(
      semanaUsar.fecha_inicio
    );

    inicio.setHours(0, 0, 0, 0);

    const fin = obtenerSabadoDesdeInicio(
      semanaUsar.fecha_inicio
    );

    const { data, error } = await supabase
      .from("trabajos_tiempo")
      .select(`
        id,
        empleado_id,
        orden_id,
        proceso_id,
        descripcion,
        tarifa_hora,
        fecha_inicio,
        fecha_fin,
        minutos_trabajados,
        total_pago,
        estado,
        semana_id,
        empleados(
          id,
          nombre,
          alias,
          puesto
        ),
        ordenes(
          id,
          folio,
          cliente,
          modelos(
            id,
            codigo,
            nombre
          )
        ),
        modelo_procesos(
          id,
          nombre
        )
      `)
      .eq("estado", "Terminado")
      .is("semana_id", null)
      .gte("fecha_fin", inicio.toISOString())
      .lte("fecha_fin", fin.toISOString())
      .order("fecha_fin", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    setTrabajosTiempo(data || []);
  }

  async function cargarAdeudosPendientes() {
    const { data, error } = await supabase
      .from("prestamos")
      .select(`
        id,
        empleado_id,
        monto,
        fecha,
        descripcion,
        estado,
        empleados(
          id,
          nombre,
          alias,
          puesto
        )
      `)
      .eq("estado", "Pendiente")
      .order("fecha", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    setAdeudos(data || []);
  }

  async function cargarHistorial() {
    const { data, error } = await supabase
      .from("semanas_nomina")
      .select(`
        id,
        fecha_inicio,
        fecha_cierre,
        estado,
        total_nomina
      `)
      .eq("estado", "Cerrada")
      .order("id", {
        ascending: false,
      })
      .limit(20);

    if (error) {
      throw error;
    }

    setHistorial(data || []);
  }

  function obtenerLunesActual() {
    const fecha = new Date();
    const dia = fecha.getDay();

    const diferencia =
      dia === 0 ? -6 : 1 - dia;

    fecha.setDate(
      fecha.getDate() + diferencia
    );

    fecha.setHours(0, 0, 0, 0);

    return fecha;
  }

  function formatearFechaBD(fecha) {
    const anio = fecha.getFullYear();

    const mes = String(
      fecha.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
      fecha.getDate()
    ).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
  }

 function convertirFechaLocal(fecha) {
  if (!fecha) {
    return null;
  }

  // Si Supabase manda una fecha como:
  // 2026-09-21
  // o:
  // 2026-09-21T00:00:00+00:00
  //
  // tomamos únicamente la parte YYYY-MM-DD.
  // Así evitamos que JavaScript la convierta por zona horaria
  // y termine mostrando el día anterior en México.

  if (typeof fecha === "string") {
    const coincidencia = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (coincidencia) {
      const anio = Number(coincidencia[1]);
      const mes = Number(coincidencia[2]);
      const dia = Number(coincidencia[3]);

      return new Date(
        anio,
        mes - 1,
        dia,
        0,
        0,
        0,
        0
      );
    }
  }

  // Si ya recibimos un objeto Date,
  // conservamos año, mes y día en horario local.
  if (fecha instanceof Date) {
    return new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate(),
      0,
      0,
      0,
      0
    );
  }

    return new Date(fecha);
  }

  function obtenerSabadoDesdeInicio(fechaInicio) {
    const fecha =
      convertirFechaLocal(fechaInicio);

    fecha.setDate(
      fecha.getDate() + 5
    );

    /*
      Tu cierre habitual es:
      sábado a las 2:00 p. m.
    */
    fecha.setHours(14, 0, 0, 0);

    return fecha;
  }

  function calcularPagoPaso(asignacion) {
    const cantidad = Number(
      asignacion.orden_bultos_v2?.cantidad || 0
    );

    const costo = Number(
      asignacion.modelo_procesos?.costo || 0
    );

    return cantidad * costo;
  }

  function formatearDinero(valor) {
    return Number(valor || 0).toLocaleString(
      "es-MX",
      {
        style: "currency",
        currency: "MXN",
      }
    );
  }

  function formatearFecha(fecha) {
    if (!fecha) {
      return "—";
    }

    return new Date(fecha).toLocaleString(
      "es-MX",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  function formatearSoloFecha(fecha) {
    if (!fecha) {
      return "—";
    }

    const fechaLocal =
      convertirFechaLocal(fecha);

    return fechaLocal.toLocaleDateString(
      "es-MX",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  }

  function formatearDuracion(minutos) {
    const total = Number(
      minutos || 0
    );

    const horas = Math.floor(
      total / 60
    );

    const restantes =
      total % 60;

    if (horas === 0) {
      return `${restantes} min`;
    }

    return `${horas} h ${restantes} min`;
  }

  const detalleTrabajadores = useMemo(() => {
    const mapa = new Map();

    function obtenerEmpleado(
      empleadoId,
      datosEmpleado
    ) {
      const id = Number(empleadoId);

      if (!mapa.has(id)) {
        mapa.set(id, {
          empleadoId: id,

          nombre:
            datosEmpleado?.alias ||
            datosEmpleado?.nombre ||
            `Empleado ${id}`,

          nombreCompleto:
            datosEmpleado?.nombre ||
            "",

          puesto:
            datosEmpleado?.puesto ||
            "",

          pagoPasos: 0,
          pagoHoras: 0,
          bruto: 0,
          adeudo: 0,
          netoEstimado: 0,

          asignaciones: [],
          trabajosTiempo: [],
          adeudos: [],

          totalBultos: 0,
          totalTrabajosHora: 0,
          minutosTrabajados: 0,
        });
      }

      return mapa.get(id);
    }

    asignaciones.forEach(
      (registro) => {
        const trabajador =
          obtenerEmpleado(
            registro.empleado_id,
            registro.empleados
          );

        const pago =
          calcularPagoPaso(registro);

        trabajador.pagoPasos += pago;
        trabajador.bruto += pago;
        trabajador.totalBultos += 1;

        trabajador.asignaciones.push({
          ...registro,
          pagoCalculado: pago,
        });
      }
    );

    trabajosTiempo.forEach(
      (registro) => {
        const trabajador =
          obtenerEmpleado(
            registro.empleado_id,
            registro.empleados
          );

        const pago = Number(
          registro.total_pago || 0
        );

        trabajador.pagoHoras += pago;
        trabajador.bruto += pago;
        trabajador.totalTrabajosHora += 1;

        trabajador.minutosTrabajados +=
          Number(
            registro.minutos_trabajados || 0
          );

        trabajador.trabajosTiempo.push(
          registro
        );
      }
    );

    adeudos.forEach(
      (registro) => {
        const trabajador =
          obtenerEmpleado(
            registro.empleado_id,
            registro.empleados
          );

        const monto = Number(
          registro.monto || 0
        );

        trabajador.adeudo += monto;

        trabajador.adeudos.push(
          registro
        );
      }
    );

    const resultado =
      [...mapa.values()]
        .map((trabajador) => ({
          ...trabajador,

          netoEstimado:
            trabajador.bruto -
            trabajador.adeudo,
        }))
        .filter(
          (trabajador) =>
            trabajador.bruto > 0 ||
            trabajador.adeudo > 0
        )
        .sort(
          (a, b) =>
            b.bruto - a.bruto
        );

    return resultado;
  }, [
    asignaciones,
    trabajosTiempo,
    adeudos,
  ]);

  const totales = useMemo(() => {
    const pagoPasos =
      detalleTrabajadores.reduce(
        (total, trabajador) =>
          total +
          Number(
            trabajador.pagoPasos || 0
          ),
        0
      );

    const pagoHoras =
      detalleTrabajadores.reduce(
        (total, trabajador) =>
          total +
          Number(
            trabajador.pagoHoras || 0
          ),
        0
      );

    const bruto =
      pagoPasos + pagoHoras;

    const adeudo =
      detalleTrabajadores.reduce(
        (total, trabajador) =>
          total +
          Number(
            trabajador.adeudo || 0
          ),
        0
      );

    return {
      pagoPasos,
      pagoHoras,
      bruto,
      adeudo,
      netoEstimado:
        bruto - adeudo,

      trabajadoresConPago:
        detalleTrabajadores.filter(
          (trabajador) =>
            trabajador.bruto > 0
        ).length,
    };
  }, [detalleTrabajadores]);
    async function cerrarSemana() {
    if (!semanaAbierta) {
      alert("No hay una semana abierta.");
      return;
    }

    if (cerrando) {
      return;
    }

    const trabajadoresConPago =
      detalleTrabajadores.filter(
        (trabajador) =>
          trabajador.bruto > 0
      );

    if (
      trabajadoresConPago.length === 0
    ) {
      alert(
        "No hay trabajos terminados para cerrar esta semana."
      );
      return;
    }

    const confirmar = window.confirm(
      `¿Cerrar la semana con una nómina bruta de ${formatearDinero(
        totales.bruto
      )}?\n\n` +
        "Solo se incluirán los bultos entregados y los trabajos por hora terminados de esta semana."
    );

    if (!confirmar) {
      return;
    }

    setCerrando(true);

    try {
      /*
        1. Creamos el detalle de nómina
        para cada trabajador que tenga pago.
      */
      const detallesNomina =
        trabajadoresConPago.map(
          (trabajador) => ({
            semana_id:
              semanaAbierta.id,

            empleado_id:
              trabajador.empleadoId,

            pago_pieza:
              Number(
                trabajador.pagoPasos || 0
              ),

            pago_hora:
              Number(
                trabajador.pagoHoras || 0
              ),

            total_pago:
              Number(
                trabajador.bruto || 0
              ),
          })
        );

      const {
        error: errorDetalle,
      } = await supabase
        .from("nomina_semanal_detalle")
        .insert(detallesNomina);

      if (errorDetalle) {
        throw errorDetalle;
      }

      /*
        2. Marcamos las asignaciones
        pagadas con la semana que estamos
        cerrando.
      */
      const idsAsignaciones =
        asignaciones.map(
          (registro) => registro.id
        );

      if (
        idsAsignaciones.length > 0
      ) {
        const {
          error:
            errorAsignaciones,
        } = await supabase
          .from("asignaciones")
          .update({
            semana_nomina_id:
              semanaAbierta.id,
          })
          .in(
            "id",
            idsAsignaciones
          );

        if (errorAsignaciones) {
          throw errorAsignaciones;
        }
      }

      /*
        3. Marcamos los trabajos por tiempo
        pagados con la semana cerrada.
      */
      const idsTrabajosTiempo =
        trabajosTiempo.map(
          (registro) => registro.id
        );

      if (
        idsTrabajosTiempo.length > 0
      ) {
        const {
          error:
            errorTrabajosTiempo,
        } = await supabase
          .from("trabajos_tiempo")
          .update({
            semana_id:
              semanaAbierta.id,
          })
          .in(
            "id",
            idsTrabajosTiempo
          );

        if (errorTrabajosTiempo) {
          throw errorTrabajosTiempo;
        }
      }

      /*
        4. Cerramos la semana actual.
      */
      const {
        error: errorCerrarSemana,
      } = await supabase
        .from("semanas_nomina")
        .update({
          estado: "Cerrada",
          fecha_cierre:
            new Date().toISOString(),
          total_nomina:
            Number(
              totales.bruto || 0
            ),
        })
        .eq(
          "id",
          semanaAbierta.id
        );

      if (errorCerrarSemana) {
        throw errorCerrarSemana;
      }

      /*
        IMPORTANTE:

        Ya NO creamos la siguiente semana
        sumándole 7 días a la anterior.

        Volvemos a resolver cuál es la
        semana que corresponde a la fecha
        actual.

        Esto evita que una semana antigua
        vaya arrastrando fechas incorrectas.
      */
      const nuevaSemana =
        await obtenerOCrearSemanaAbierta();

      setSemanaAbierta(
        nuevaSemana
      );

      setEmpleadoAbierto(null);

      mostrarMensaje(
        `Semana cerrada. Nómina total: ${formatearDinero(
          totales.bruto
        )}`
      );

      await Promise.all([
        cargarAsignacionesPendientes(
          nuevaSemana
        ),

        cargarTrabajosTiempoPendientes(
          nuevaSemana
        ),

        cargarAdeudosPendientes(),

        cargarHistorial(),
      ]);
    } catch (error) {
      console.error(
        "Error cerrando semana:",
        error
      );

      alert(
        error.message ||
          "No se pudo cerrar la semana"
      );
    } finally {
      setCerrando(false);
    }
  }

  const fechaCierreSemana =
    semanaAbierta?.fecha_inicio
      ? obtenerSabadoDesdeInicio(
          semanaAbierta.fecha_inicio
        )
      : null;

  if (cargando) {
    return (
      <div>
        <h2>
          Cargando nómina...
        </h2>
      </div>
    );
  }

  return (
    <div>
      <div style={encabezadoPagina}>
        <div>
          <h1
            style={{
              marginBottom: 4,
            }}
          >
            💵 Nómina semanal
          </h1>

          <p
            style={{
              marginTop: 0,
              color: "#6b7280",
            }}
          >
            Control de pagos por
            producción y trabajos por
            tiempo
          </p>
        </div>

        <button
          type="button"
          onClick={cargarTodo}
          style={botonActualizar}
        >
          🔄 Actualizar
        </button>
      </div>

      {mensaje && (
        <div style={mensajeExito}>
          {mensaje}
        </div>
      )}

      {semanaAbierta && (
        <section style={card}>
          <div
            style={
              encabezadoSemana
            }
          >
            <div>
              <small>
                Semana actual
              </small>

              <h3
                style={{
                  margin:
                    "4px 0",
                }}
              >
                Del{" "}
                {formatearSoloFecha(
                  semanaAbierta.fecha_inicio
                )}{" "}
                al{" "}
                {formatearSoloFecha(
                  fechaCierreSemana
                )}
              </h3>

              <small>
                Cierre habitual:
                sábado a las
                2:00 p. m.
              </small>
            </div>

            <div
              style={
                etiquetaAbierta
              }
            >
              🟢 ABIERTA
            </div>
          </div>
        </section>
      )}

      <section style={resumenGrid}>
        <div style={tarjetaResumen}>
          <small>
            Pago por pasos
          </small>

          <strong>
            {formatearDinero(
              totales.pagoPasos
            )}
          </strong>
        </div>

        <div style={tarjetaResumen}>
          <small>
            Pago por hora
          </small>

          <strong>
            {formatearDinero(
              totales.pagoHoras
            )}
          </strong>
        </div>

        <div style={tarjetaResumen}>
          <small>
            Trabajadores con pago
          </small>

          <strong>
            {
              totales.trabajadoresConPago
            }
          </strong>
        </div>

        <div style={tarjetaResumen}>
          <small>
            Nómina bruta
          </small>

          <strong>
            {formatearDinero(
              totales.bruto
            )}
          </strong>
        </div>

        <div style={tarjetaAdeudo}>
          <small>
            Descuento informativo
          </small>

          <strong>
            -
            {formatearDinero(
              totales.adeudo
            )}
          </strong>
        </div>

        <div style={tarjetaNeto}>
          <small>
            Neto estimado
          </small>

          <strong>
            {formatearDinero(
              totales.netoEstimado
            )}
          </strong>
        </div>
      </section>

      <div style={avisoAzul}>
        <strong>
          ℹ️ Vista informativa:
        </strong>{" "}
        los adeudos todavía no se
        descuentan automáticamente.
        La nómina se cerrará usando
        el pago bruto.
      </div>

      <section style={card}>
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Detalle por trabajador
        </h2>

        {detalleTrabajadores.length ===
          0 && (
          <div style={estadoVacio}>
            <strong>
              La nómina actual está
              en cero.
            </strong>

            <span>
              Se agregarán únicamente
              los bultos entregados y
              los trabajos por hora
              finalizados.
            </span>
          </div>
        )}

        {detalleTrabajadores.map(
          (trabajador) => {
            const abierto =
              empleadoAbierto ===
              trabajador.empleadoId;

            return (
              <div
                key={
                  trabajador.empleadoId
                }
                style={
                  trabajadorCard
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setEmpleadoAbierto(
                      abierto
                        ? null
                        : trabajador.empleadoId
                    )
                  }
                  style={
                    trabajadorResumen
                  }
                >
                  <div
                    style={{
                      textAlign:
                        "left",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 17,
                      }}
                    >
                      {
                        trabajador.nombre
                      }
                    </strong>

                    <small
                      style={{
                        display:
                          "block",
                      }}
                    >
                      {trabajador.puesto ||
                        "Sin puesto"}
                    </small>
                  </div>

                  <div
                    style={
                      totalesTrabajador
                    }
                  >
                    <span>
                      Pasos:{" "}
                      <strong>
                        {formatearDinero(
                          trabajador.pagoPasos
                        )}
                      </strong>
                    </span>

                    <span>
                      Horas:{" "}
                      <strong>
                        {formatearDinero(
                          trabajador.pagoHoras
                        )}
                      </strong>
                    </span>

                    <span
                      style={
                        etiquetaBruto
                      }
                    >
                      Bruto:{" "}
                      {formatearDinero(
                        trabajador.bruto
                      )}
                    </span>

                    <span
                      style={
                        etiquetaAdeudo
                      }
                    >
                      Adeudo:{" "}
                      {formatearDinero(
                        trabajador.adeudo
                      )}
                    </span>

                    <span
                      style={
                        etiquetaNeto
                      }
                    >
                      Neto estimado:{" "}
                      {formatearDinero(
                        trabajador.netoEstimado
                      )}
                    </span>

                    <strong>
                      {abierto
                        ? "▲"
                        : "▼"}
                    </strong>
                  </div>
                </button>

                {abierto && (
                  <div
                    style={
                      detalleTrabajador
                    }
                  >
                    <div
                      style={
                        miniResumenGrid
                      }
                    >
                      <div
                        style={
                          miniTarjeta
                        }
                      >
                        <small>
                          Bultos
                          terminados
                        </small>

                        <strong>
                          {
                            trabajador.totalBultos
                          }
                        </strong>
                      </div>

                      <div
                        style={
                          miniTarjeta
                        }
                      >
                        <small>
                          Trabajos por
                          hora
                        </small>

                        <strong>
                          {
                            trabajador.totalTrabajosHora
                          }
                        </strong>
                      </div>

                      <div
                        style={
                          miniTarjeta
                        }
                      >
                        <small>
                          Tiempo
                          trabajado
                        </small>

                        <strong>
                          {formatearDuracion(
                            trabajador.minutosTrabajados
                          )}
                        </strong>
                      </div>
                    </div>

                    {trabajador
                      .asignaciones
                      .length > 0 && (
                      <>
                        <h3>
                          🧵 Pago por
                          pasos
                        </h3>

                        {trabajador.asignaciones.map(
                          (
                            registro
                          ) => (
                            <div
                              key={`asignacion-${registro.id}`}
                              style={
                                detalleFila
                              }
                            >
                              <div>
                                <strong>
                                  {registro
                                    .modelo_procesos
                                    ?.nombre ||
                                    "Sin proceso"}
                                </strong>

                                <small
                                  style={{
                                    display:
                                      "block",
                                  }}
                                >
                                  {registro
                                    .orden_bultos_v2
                                    ?.nombre_bulto ||
                                    "Sin bulto"}{" "}
                                  ·{" "}
                                  {registro
                                    .orden_bultos_v2
                                    ?.cantidad ||
                                    0}{" "}
                                  unidades
                                </small>

                                <small
                                  style={{
                                    display:
                                      "block",
                                  }}
                                >
                                  Orden:{" "}
                                  {registro
                                    .ordenes
                                    ?.folio ||
                                    "Sin orden"}{" "}
                                  · Modelo:{" "}
                                  {registro
                                    .ordenes
                                    ?.modelos
                                    ?.codigo ||
                                    "Sin modelo"}
                                </small>

                                <small
                                  style={{
                                    display:
                                      "block",
                                  }}
                                >
                                  Entregado:{" "}
                                  {formatearFecha(
                                    registro.fecha_terminado
                                  )}
                                </small>
                              </div>

                              <strong>
                                {formatearDinero(
                                  registro.pagoCalculado
                                )}
                              </strong>
                            </div>
                          )
                        )}
                      </>
                    )}

                    {trabajador
                      .trabajosTiempo
                      .length > 0 && (
                      <>
                        <h3>
                          ⏱ Pago por
                          hora
                        </h3>

                        {trabajador.trabajosTiempo.map(
                          (
                            registro
                          ) => (
                            <div
                              key={`tiempo-${registro.id}`}
                              style={
                                detalleFila
                              }
                            >
                              <div>
                                <strong>
                                  {registro.descripcion ||
                                    "Trabajo por tiempo"}
                                </strong>

                                <small
                                  style={{
                                    display:
                                      "block",
                                  }}
                                >
                                  {formatearDuracion(
                                    registro.minutos_trabajados
                                  )}{" "}
                                  ·{" "}
                                  {formatearDinero(
                                    registro.tarifa_hora
                                  )}{" "}
                                  por hora
                                </small>

                                <small
                                  style={{
                                    display:
                                      "block",
                                  }}
                                >
                                  Inicio:{" "}
                                  {formatearFecha(
                                    registro.fecha_inicio
                                  )}
                                </small>

                                <small
                                  style={{
                                    display:
                                      "block",
                                  }}
                                >
                                  Fin:{" "}
                                  {formatearFecha(
                                    registro.fecha_fin
                                  )}
                                </small>
                              </div>

                              <strong>
                                {formatearDinero(
                                  registro.total_pago
                                )}
                              </strong>
                            </div>
                          )
                        )}
                      </>
                    )}

                    {trabajador
                      .adeudos.length >
                      0 && (
                      <>
                        <h3>
                          💳 Adeudos
                          pendientes
                        </h3>

                        <div
                          style={
                            avisoAdeudo
                          }
                        >
                          Estos adeudos
                          aparecen solo
                          como
                          información.
                          Todavía no se
                          descuentan al
                          cerrar la
                          nómina.
                        </div>

                        {trabajador.adeudos.map(
                          (
                            registro
                          ) => (
                            <div
                              key={`adeudo-${registro.id}`}
                              style={
                                detalleFila
                              }
                            >
                              <div>
                                <strong>
                                  {registro.descripcion ||
                                    "Adeudo"}
                                </strong>

                                <small
                                  style={{
                                    display:
                                      "block",
                                  }}
                                >
                                  {formatearFecha(
                                    registro.fecha
                                  )}
                                </small>
                              </div>

                              <strong
                                style={{
                                  color:
                                    "#dc2626",
                                }}
                              >
                                -
                                {formatearDinero(
                                  registro.monto
                                )}
                              </strong>
                            </div>
                          )
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          }
        )}
      </section>
            <section style={card}>
        <h2 style={{ marginTop: 0 }}>
          🔐 Cierre semanal
        </h2>

        <p style={{ marginBottom: 6 }}>
          Solo se pagarán los bultos entregados y los trabajos por hora
          finalizados.
        </p>

        <div style={avisoAmarillo}>
          Los bultos que no se hayan entregado conservarán su asignación
          y se pagarán cuando sean terminados.
        </div>

        <div style={avisoAzul}>
          Los adeudos aparecen como información, pero en esta etapa
          todavía no serán descontados al cerrar la semana.
        </div>

        <div style={cierreResumen}>
          <div>
            <small>Nómina bruta a cerrar</small>
            <strong style={{ fontSize: 24 }}>
              {formatearDinero(totales.bruto)}
            </strong>
          </div>

          <div>
            <small>Trabajadores con pago</small>
            <strong style={{ fontSize: 24 }}>
              {totales.trabajadoresConPago}
            </strong>
          </div>
        </div>

        <button
          type="button"
          onClick={cerrarSemana}
          disabled={cerrando || totales.bruto <= 0}
          style={{
            ...botonCerrarSemana,
            opacity:
              cerrando || totales.bruto <= 0
                ? 0.55
                : 1,
            cursor:
              cerrando || totales.bruto <= 0
                ? "not-allowed"
                : "pointer",
          }}
        >
          {cerrando
            ? "Cerrando semana..."
            : "🔐 Cerrar semana y guardar nómina"}
        </button>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>
          📚 Historial de nóminas
        </h2>

        {historial.length === 0 && (
          <p>Todavía no hay semanas cerradas.</p>
        )}

        {historial.map((semana) => (
          <div key={semana.id} style={historialCard}>
            <div>
              <strong>
                Semana del{" "}
                {formatearSoloFecha(semana.fecha_inicio)}
              </strong>

              <small style={{ display: "block" }}>
                al{" "}
                {formatearSoloFecha(
                  obtenerSabadoDesdeInicio(
                    semana.fecha_inicio
                  )
                )}
              </small>

              <small style={{ display: "block" }}>
                Cerrada:{" "}
                {formatearFecha(semana.fecha_cierre)}
              </small>
            </div>

            <div style={{ textAlign: "right" }}>
              <small style={{ display: "block" }}>
                Estado: {semana.estado}
              </small>

              <strong>
                {formatearDinero(semana.total_nomina)}
              </strong>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const encabezadoPagina = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  flexWrap: "wrap",
  marginBottom: 20,
};

const botonActualizar = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 8,
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const card = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  marginBottom: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const encabezadoSemana = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  flexWrap: "wrap",
};

const etiquetaAbierta = {
  background: "#dcfce7",
  color: "#166534",
  padding: "10px 16px",
  borderRadius: 999,
  fontWeight: "bold",
};

const resumenGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 15,
  marginBottom: 20,
};

const tarjetaResumen = {
  background: "white",
  padding: 18,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  display: "grid",
  gap: 8,
};

const tarjetaAdeudo = {
  ...tarjetaResumen,
  background: "#fef3c7",
  color: "#92400e",
};

const tarjetaNeto = {
  ...tarjetaResumen,
  background: "#166534",
  color: "white",
};

const avisoAzul = {
  background: "#dbeafe",
  color: "#1e40af",
  padding: 14,
  borderRadius: 10,
  marginBottom: 20,
};

const avisoAmarillo = {
  background: "#fef3c7",
  color: "#92400e",
  padding: 14,
  borderRadius: 10,
  marginBottom: 14,
};

const avisoAdeudo = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
};

const estadoVacio = {
  display: "grid",
  gap: 7,
  textAlign: "center",
  background: "#f3f4f6",
  padding: 24,
  borderRadius: 10,
};

const trabajadorCard = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  marginBottom: 12,
  overflow: "hidden",
};

const trabajadorResumen = {
  width: "100%",
  border: "none",
  background: "#f9fafb",
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  cursor: "pointer",
  color: "#111827",
};

const totalesTrabajador = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const etiquetaBruto = {
  background: "#e5e7eb",
  padding: "8px 10px",
  borderRadius: 8,
  fontWeight: "bold",
};

const etiquetaAdeudo = {
  background: "#fee2e2",
  color: "#dc2626",
  padding: "8px 10px",
  borderRadius: 8,
  fontWeight: "bold",
};

const etiquetaNeto = {
  background: "#dcfce7",
  color: "#166534",
  padding: "8px 10px",
  borderRadius: 8,
  fontWeight: "bold",
};

const detalleTrabajador = {
  padding: 16,
  background: "white",
};

const miniResumenGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const miniTarjeta = {
  display: "grid",
  gap: 6,
  padding: 14,
  borderRadius: 10,
  background: "#f3f4f6",
};

const detalleFila = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: "13px 0",
  borderBottom: "1px solid #eee",
};

const cierreResumen = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 15,
  marginTop: 20,
  marginBottom: 20,
};

const botonCerrarSemana = {
  width: "100%",
  padding: 15,
  border: "none",
  borderRadius: 10,
  background: "#166534",
  color: "white",
  fontWeight: "bold",
  fontSize: 16,
};

const historialCard = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: 14,
  marginBottom: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
};

const mensajeExito = {
  background: "#dcfce7",
  color: "#166534",
  padding: 14,
  borderRadius: 10,
  marginBottom: 20,
  fontWeight: "bold",
};