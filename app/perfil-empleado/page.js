"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PerfilEmpleadoPage() {
  const [empleados, setEmpleados] = useState([]);
  const [empleadoId, setEmpleadoId] = useState("");
  const [empleado, setEmpleado] = useState(null);

  const [asignacionesTerminadas, setAsignacionesTerminadas] = useState([]);
  const [asignacionesPendientes, setAsignacionesPendientes] = useState([]);
  const [trabajosTiempo, setTrabajosTiempo] = useState([]);
  const [trabajosTiempoActivos, setTrabajosTiempoActivos] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [historialSemanas, setHistorialSemanas] = useState([]);
    // AJUSTES MANUALES DE NÓMINA
  const [ajustesNomina, setAjustesNomina] = useState([]);
  const [mostrarFormularioAjuste, setMostrarFormularioAjuste] =
    useState(false);
  const [tipoAjuste, setTipoAjuste] = useState("Suma");
  const [montoAjuste, setMontoAjuste] = useState("");
  const [conceptoAjuste, setConceptoAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [procesandoExclusion, setProcesandoExclusion] =
    useState(null);

  const [semanaAbierta, setSemanaAbierta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [detalleAbierto, setDetalleAbierto] = useState("hoy");

  // NUEVO: formulario para registrar trabajo por tiempo manualmente
  const [mostrarFormularioTiempo, setMostrarFormularioTiempo] =
    useState(false);

  const [fechaManual, setFechaManual] = useState(
    obtenerFechaLocalActual()
  );

  const [horaInicioManual, setHoraInicioManual] = useState("");
  const [horaFinManual, setHoraFinManual] = useState("");
  const [descripcionManual, setDescripcionManual] = useState("");
  const [tarifaManual, setTarifaManual] = useState("");
  const [guardandoTiempo, setGuardandoTiempo] = useState(false);

  useEffect(() => {
    cargarEmpleados();
    cargarSemanaAbierta();
  }, []);

  async function cargarEmpleados() {
    const { data, error } = await supabase
      .from("empleados")
      .select("*")
      .eq("activo", true)
      .order("nombre");

    if (error) {
      alert(error.message);
      return;
    }

    setEmpleados(data || []);
  }

  async function cargarSemanaAbierta() {
    const { data, error } = await supabase
      .from("semanas_nomina")
      .select("*")
      .eq("estado", "Abierta")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    setSemanaAbierta(data || null);
  }

  async function cargarPerfil(id) {
    setEmpleadoId(id);
    setEmpleado(null);
    setAsignacionesTerminadas([]);
    setAsignacionesPendientes([]);
    setTrabajosTiempo([]);
    setTrabajosTiempoActivos([]);
    setPrestamos([]);
    setHistorialSemanas([]);
        setAjustesNomina([]);
    setMostrarFormularioAjuste(false);
    setTipoAjuste("Suma");
    setMontoAjuste("");
    setConceptoAjuste("");
    setMotivoAjuste("");

    setMostrarFormularioTiempo(false);
    limpiarFormularioTiempo();

    if (!id) return;

    setCargando(true);

    try {
      const empleadoNumerico = Number(id);

           const [
        respuestaEmpleado,
        respuestaAsignacionesTerminadas,
        respuestaAsignacionesPendientes,
        respuestaTiempoTerminado,
        respuestaTiempoActivo,
        respuestaPrestamos,
        respuestaHistorial,
        respuestaAjustes,
      ] = await Promise.all([
        supabase
          .from("empleados")
          .select("*")
          .eq("id", empleadoNumerico)
          .single(),

        supabase
          .from("asignaciones")
          .select(`
            id,
            fecha_terminado,
            empleado_id,
                      semana_nomina_id,
            estado,
            excluir_nomina,
            motivo_exclusion_nomina,
            fecha_exclusion_nomina,
            modelo_procesos(id,nombre,costo),
            orden_bultos_v2(id,nombre_bulto,talla,cantidad),
            ordenes(
              id,
              folio,
              cliente,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("empleado_id", empleadoNumerico)
          .eq("estado", "Terminado")
          .is("semana_nomina_id", null)
          .order("fecha_terminado", { ascending: false }),

        supabase
          .from("asignaciones")
          .select(`
            id,
            empleado_id,
            estado,
            modelo_procesos(id,nombre,costo),
            orden_bultos_v2(id,nombre_bulto,talla,cantidad),
            ordenes(
              id,
              folio,
              cliente,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("empleado_id", empleadoNumerico)
          .eq("estado", "Asignado")
          .order("id", { ascending: false }),

        supabase
          .from("trabajos_tiempo")
          .select(`
            id,
            descripcion,
            fecha_inicio,
            fecha_fin,
            minutos_trabajados,
            tarifa_hora,
            total_pago,
            semana_id,
            estado,
            modelo_procesos(id,nombre),
            ordenes(
              id,
              folio,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("empleado_id", empleadoNumerico)
          .eq("estado", "Terminado")
          .is("semana_id", null)
          .order("fecha_fin", { ascending: false }),

        supabase
          .from("trabajos_tiempo")
          .select(`
            id,
            descripcion,
            fecha_inicio,
            tarifa_hora,
            estado,
            modelo_procesos(id,nombre),
            ordenes(
              id,
              folio,
              modelos(id,codigo,nombre)
            )
          `)
          .eq("empleado_id", empleadoNumerico)
          .eq("estado", "Trabajando")
          .order("fecha_inicio", { ascending: false }),

        supabase
          .from("prestamos")
          .select("*")
          .eq("empleado_id", empleadoNumerico)
          .order("fecha", { ascending: false }),

        supabase
          .from("nomina_semanal_detalle")
          .select(`
            id,
            pago_pieza,
            pago_hora,
            total_pago,
            semanas_nomina(
              id,
              fecha_inicio,
              fecha_cierre,
              estado
            )
          `)
          .eq("empleado_id", empleadoNumerico)
          .order("id", { ascending: false })
          .limit(12),
                  supabase
          .from("ajustes_nomina")
          .select("*")
          .eq("empleado_id", empleadoNumerico)
          .order("fecha", { ascending: false }),
      ]);

            const respuestas = [
        respuestaEmpleado,
        respuestaAsignacionesTerminadas,
        respuestaAsignacionesPendientes,
        respuestaTiempoTerminado,
        respuestaTiempoActivo,
        respuestaPrestamos,
        respuestaHistorial,
        respuestaAjustes,
      ];

      const respuestaConError = respuestas.find(
        (respuesta) => respuesta.error
      );

      if (respuestaConError?.error) {
        throw respuestaConError.error;
      }

      setEmpleado(respuestaEmpleado.data);

      setAsignacionesTerminadas(
        respuestaAsignacionesTerminadas.data || []
      );

      setAsignacionesPendientes(
        respuestaAsignacionesPendientes.data || []
      );

      setTrabajosTiempo(
        respuestaTiempoTerminado.data || []
      );

      setTrabajosTiempoActivos(
        respuestaTiempoActivo.data || []
      );

      setPrestamos(respuestaPrestamos.data || []);
      setHistorialSemanas(respuestaHistorial.data || []);
            setAjustesNomina(respuestaAjustes.data || []);
    } catch (error) {
      alert(error.message || "No se pudo cargar el perfil");
    } finally {
      setCargando(false);
    }
  }

  function limpiarFormularioTiempo() {
    setFechaManual(obtenerFechaLocalActual());
    setHoraInicioManual("");
    setHoraFinManual("");
    setDescripcionManual("");
    setTarifaManual("");
  }

    async function guardarAjusteNomina(e) {
    e.preventDefault();

    if (!empleadoId || !semanaAbierta) {
      alert("No hay trabajador o semana abierta.");
      return;
    }

    const monto = Number(montoAjuste);

    if (!Number.isFinite(monto) || monto <= 0) {
      alert("Escribe un monto válido mayor a cero.");
      return;
    }

    if (!conceptoAjuste.trim()) {
      alert("Escribe el concepto del ajuste.");
      return;
    }

    if (!motivoAjuste.trim()) {
      alert("Escribe el motivo del ajuste.");
      return;
    }

    const signo = tipoAjuste === "Suma" ? "+" : "-";

    const confirmar = window.confirm(
      `Se aplicará un ajuste de ${signo}${formatearDinero(
        monto
      )} a ${empleado.alias || empleado.nombre}.\n\nConcepto: ${
        conceptoAjuste
      }\nMotivo: ${motivoAjuste}\n\n¿Continuar?`
    );

    if (!confirmar) return;

    setGuardandoAjuste(true);

    try {
      const { error } = await supabase
        .from("ajustes_nomina")
        .insert({
          empleado_id: Number(empleadoId),
          semana_id: semanaAbierta.id,
          tipo: tipoAjuste,
          monto,
          concepto: conceptoAjuste.trim(),
          motivo: motivoAjuste.trim(),
        });

      if (error) throw error;

      setTipoAjuste("Suma");
      setMontoAjuste("");
      setConceptoAjuste("");
      setMotivoAjuste("");
      setMostrarFormularioAjuste(false);

      await cargarPerfil(empleadoId);

      alert("Ajuste registrado correctamente.");
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
          "No se pudo registrar el ajuste de nómina."
      );
    } finally {
      setGuardandoAjuste(false);
    }
  }

  async function excluirPasoNomina(registro) {
    const pago = calcularPagoPaso(registro);

    const motivo = window.prompt(
      `Este paso dejará de contar en la nómina de ${
        empleado.alias || empleado.nombre
      }.\n\nPaso: ${
        registro.modelo_procesos?.nombre || "Sin nombre"
      }\nMonto: ${formatearDinero(
        pago
      )}\n\nEscribe el motivo de la corrección:`
    );

    if (motivo === null) return;

    if (!motivo.trim()) {
      alert("Debes escribir el motivo de la corrección.");
      return;
    }

    const confirmar = window.confirm(
      `¿Seguro que quieres quitar este paso de la nómina?\n\n${
        registro.modelo_procesos?.nombre || "Paso"
      }\n${formatearDinero(
        pago
      )}\n\nEl trabajo NO se borrará de producción.`
    );

    if (!confirmar) return;

    setProcesandoExclusion(registro.id);

    try {
      const { error } = await supabase
        .from("asignaciones")
        .update({
          excluir_nomina: true,
          motivo_exclusion_nomina: motivo.trim(),
          fecha_exclusion_nomina: new Date().toISOString(),
        })
        .eq("id", registro.id);

      if (error) throw error;

      await cargarPerfil(empleadoId);

      alert(
        "Paso quitado de la nómina correctamente. El registro de producción se conservó."
      );
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
          "No se pudo quitar el paso de la nómina."
      );
    } finally {
      setProcesandoExclusion(null);
    }
  }

  async function eliminarAjusteNomina(ajuste) {
    const signo = ajuste.tipo === "Suma" ? "+" : "-";

    const confirmar = window.confirm(
      `¿Eliminar este ajuste?\n\n${ajuste.concepto}\n${signo}${formatearDinero(
        ajuste.monto
      )}\n\nEl total de la semana se recalculará.`
    );

    if (!confirmar) return;

    try {
      const { error } = await supabase
        .from("ajustes_nomina")
        .delete()
        .eq("id", ajuste.id);

      if (error) throw error;

      await cargarPerfil(empleadoId);
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
          "No se pudo eliminar el ajuste."
      );
    }
  }

  function calcularPagoPaso(asignacion) {
    const cantidad = Number(
      asignacion.orden_bultos_v2?.cantidad || 0
    );

    const precioPaso = Number(
      asignacion.modelo_procesos?.costo || 0
    );

    return cantidad * precioPaso;
  }

  function esHoy(fecha) {
    if (!fecha) return false;

    const registro = new Date(fecha);
    const hoy = new Date();

    return (
      registro.getFullYear() === hoy.getFullYear() &&
      registro.getMonth() === hoy.getMonth() &&
      registro.getDate() === hoy.getDate()
    );
  }

  function estaEnSemanaActual(fecha) {
    if (!fecha || !semanaAbierta?.fecha_inicio) return false;

    const registro = new Date(fecha);
    const inicio = new Date(semanaAbierta.fecha_inicio);
    const fin = new Date(inicio);

    fin.setDate(fin.getDate() + 5);
    fin.setHours(14, 0, 0, 0);

    return registro >= inicio && registro <= fin;
  }

  const calculoTiempoManual = useMemo(() => {
    if (
      !fechaManual ||
      !horaInicioManual ||
      !horaFinManual
    ) {
      return {
        valido: false,
        minutos: 0,
        total: 0,
        inicio: null,
        fin: null,
      };
    }

    const inicio = crearFechaLocal(
      fechaManual,
      horaInicioManual
    );

    const fin = crearFechaLocal(
      fechaManual,
      horaFinManual
    );

    if (
      Number.isNaN(inicio.getTime()) ||
      Number.isNaN(fin.getTime()) ||
      fin <= inicio
    ) {
      return {
        valido: false,
        minutos: 0,
        total: 0,
        inicio,
        fin,
      };
    }

    const minutos = Math.round(
      (fin.getTime() - inicio.getTime()) / 60000
    );

    const tarifa = Number(tarifaManual || 0);

    const total =
      tarifa > 0
        ? Number(((minutos / 60) * tarifa).toFixed(2))
        : 0;

    return {
      valido: true,
      minutos,
      total,
      inicio,
      fin,
    };
  }, [
    fechaManual,
    horaInicioManual,
    horaFinManual,
    tarifaManual,
  ]);

  async function registrarTrabajoTiempoManual(e) {
    e.preventDefault();

    if (!empleadoId) {
      alert("Selecciona un trabajador.");
      return;
    }

    if (!fechaManual) {
      alert("Selecciona la fecha.");
      return;
    }

    if (!horaInicioManual || !horaFinManual) {
      alert("Escribe la hora de inicio y la hora de término.");
      return;
    }

    if (!descripcionManual.trim()) {
      alert("Escribe una descripción del trabajo realizado.");
      return;
    }

    const tarifa = Number(tarifaManual);

    if (!Number.isFinite(tarifa) || tarifa <= 0) {
      alert("Escribe una tarifa por hora válida.");
      return;
    }

    if (!calculoTiempoManual.valido) {
      alert(
        "La hora de término debe ser posterior a la hora de inicio."
      );
      return;
    }

    if (calculoTiempoManual.fin > new Date()) {
      alert(
        "La hora de término no puede estar en el futuro."
      );
      return;
    }

    const confirmar = window.confirm(
      `Se registrará ${formatearDuracion(
        calculoTiempoManual.minutos
      )} de trabajo por ${formatearDinero(
        calculoTiempoManual.total
      )} para ${empleado.alias || empleado.nombre}. ¿Continuar?`
    );

    if (!confirmar) return;

    setGuardandoTiempo(true);

    try {
      const { error } = await supabase
        .from("trabajos_tiempo")
        .insert({
          empleado_id: Number(empleadoId),
          orden_id: null,
          proceso_id: null,
          descripcion: descripcionManual.trim(),
          tarifa_hora: tarifa,
          fecha_inicio:
            calculoTiempoManual.inicio.toISOString(),
          fecha_fin:
            calculoTiempoManual.fin.toISOString(),
          minutos_trabajados:
            calculoTiempoManual.minutos,
          total_pago:
            calculoTiempoManual.total,
          estado: "Terminado",
          semana_id: null,
        });

      if (error) {
        throw error;
      }

      alert(
        `Trabajo registrado correctamente.\n\nTiempo: ${formatearDuracion(
          calculoTiempoManual.minutos
        )}\nPago: ${formatearDinero(
          calculoTiempoManual.total
        )}`
      );

      limpiarFormularioTiempo();
      setMostrarFormularioTiempo(false);

      await cargarPerfil(empleadoId);
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "No se pudo registrar el trabajo por tiempo."
      );
    } finally {
      setGuardandoTiempo(false);
    }
  }

  const resumen = useMemo(() => {
          const pasosSemana = asignacionesTerminadas.filter(
        (registro) =>
          estaEnSemanaActual(registro.fecha_terminado) &&
          registro.excluir_nomina !== true
      );
    const horasSemana = trabajosTiempo.filter(
      (registro) =>
        estaEnSemanaActual(registro.fecha_fin)
    );

    const pasosHoy = pasosSemana.filter((registro) =>
      esHoy(registro.fecha_terminado)
    );

    const horasHoy = horasSemana.filter((registro) =>
      esHoy(registro.fecha_fin)
    );

    const pagoPasosSemana = pasosSemana.reduce(
      (total, registro) =>
        total + calcularPagoPaso(registro),
      0
    );

    const pagoHorasSemana = horasSemana.reduce(
      (total, registro) =>
        total + Number(registro.total_pago || 0),
      0
    );

    const pagoPasosHoy = pasosHoy.reduce(
      (total, registro) =>
        total + calcularPagoPaso(registro),
      0
    );

    const pagoHorasHoy = horasHoy.reduce(
      (total, registro) =>
        total + Number(registro.total_pago || 0),
      0
    );

    const prestamosSemana = prestamos.filter(
      (prestamo) =>
        estaEnSemanaActual(prestamo.fecha)
    );

    const totalPrestamosSemana = prestamosSemana.reduce(
      (total, prestamo) =>
        total + Number(prestamo.monto || 0),
      0
    );

        const ajustesSemana = ajustesNomina.filter(
      (ajuste) =>
        Number(ajuste.semana_id) === Number(semanaAbierta?.id)
    );

    const totalAjustesSemana = ajustesSemana.reduce(
      (total, ajuste) => {
        const monto = Number(ajuste.monto || 0);

        return ajuste.tipo === "Resta"
          ? total - monto
          : total + monto;
      },
      0
    );

    return {
      pasosSemana,
      horasSemana,
      pasosHoy,
      horasHoy,
      pagoPasosSemana,
      pagoHorasSemana,
      pagoPasosHoy,
      pagoHorasHoy,
      totalHoy: pagoPasosHoy + pagoHorasHoy,
            ajustesSemana,
      totalAjustesSemana,

      totalBrutoAntesAjustes:
        pagoPasosSemana + pagoHorasSemana,

      totalBrutoSemana:
        pagoPasosSemana +
        pagoHorasSemana +
        totalAjustesSemana,
      totalPrestamosSemana,
            netoEstimado:
        pagoPasosSemana +
        pagoHorasSemana +
        totalAjustesSemana -
        totalPrestamosSemana,
      bultosTerminadosSemana: pasosSemana.length,
      minutosSemana: horasSemana.reduce(
        (total, registro) =>
          total +
          Number(registro.minutos_trabajados || 0),
        0
      ),
    };
    }, [
    asignacionesTerminadas,
    trabajosTiempo,
    prestamos,
    ajustesNomina,
    semanaAbierta,
  ]);

  const resumenPorDia = useMemo(() => {
    const dias = {};

    function agregar(fecha, pago, tipo) {
      if (!fecha) return;

      const fechaObj = new Date(fecha);

      const clave = [
        fechaObj.getFullYear(),
        String(fechaObj.getMonth() + 1).padStart(2, "0"),
        String(fechaObj.getDate()).padStart(2, "0"),
      ].join("-");

      if (!dias[clave]) {
        dias[clave] = {
          fecha,
          pasos: 0,
          horas: 0,
          total: 0,
        };
      }

      dias[clave][tipo] += pago;
      dias[clave].total += pago;
    }

    resumen.pasosSemana.forEach((registro) => {
      agregar(
        registro.fecha_terminado,
        calcularPagoPaso(registro),
        "pasos"
      );
    });

    resumen.horasSemana.forEach((registro) => {
      agregar(
        registro.fecha_fin,
        Number(registro.total_pago || 0),
        "horas"
      );
    });

    return Object.values(dias).sort(
      (a, b) =>
        new Date(b.fecha) - new Date(a.fecha)
    );
  }, [resumen]);

  function formatearDinero(valor) {
    return Number(valor || 0).toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });
  }

  function formatearFecha(fecha) {
    if (!fecha) return "—";

    return new Date(fecha).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatearSoloFecha(fecha) {
    if (!fecha) return "—";

    return new Date(fecha).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  function formatearDuracion(minutos) {
    const total = Number(minutos || 0);
    const horas = Math.floor(total / 60);
    const restantes = total % 60;

    if (horas === 0) {
      return `${restantes} min`;
    }

    return `${horas} h ${restantes} min`;
  }

  return (
    <div>
      <h1>👤 Perfil del empleado</h1>

      <section style={card}>
        <label style={etiqueta}>
          Seleccionar empleado
        </label>

        <select
          value={empleadoId}
          onChange={(e) =>
            cargarPerfil(e.target.value)
          }
          style={input}
        >
          <option value="">
            Selecciona empleado
          </option>

          {empleados.map((registro) => (
            <option
              key={registro.id}
              value={registro.id}
            >
              {registro.alias || registro.nombre}
            </option>
          ))}
        </select>
      </section>

      {cargando && <h2>Cargando perfil...</h2>}

      {!cargando && empleado && (
        <>
          <section style={card}>
            <div style={encabezadoPerfil}>
              <div>
                <h2 style={{ margin: 0 }}>
                  {empleado.alias ||
                    empleado.nombre}
                </h2>

                {empleado.alias && (
                  <small>{empleado.nombre}</small>
                )}
              </div>

              <div style={estadoActivo}>
                {empleado.activo
                  ? "🟢 Activo"
                  : "🔴 Inactivo"}
              </div>
            </div>

            <div style={datosEmpleado}>
              <p>
                <strong>Puesto:</strong>{" "}
                {empleado.puesto ||
                  "Sin registrar"}
              </p>

              <p>
                <strong>Teléfono:</strong>{" "}
                {empleado.telefono ||
                  "Sin registrar"}
              </p>

              <p>
                <strong>Fecha de ingreso:</strong>{" "}
                {empleado.fecha_ingreso ||
                  "Sin registrar"}
              </p>

              <p>
                <strong>Cumpleaños:</strong>{" "}
                {empleado.cumpleanos ||
                  "Sin registrar"}
              </p>
            </div>
          </section>

          {/* NUEVO: REGISTRO MANUAL POR TIEMPO */}
          <section style={card}>
            <div style={encabezadoAccion}>
              <div>
                <h2 style={{ margin: 0 }}>
                  ⏱ Pago por tiempo
                </h2>

                <p
                  style={{
                    marginBottom: 0,
                    color: "#6b7280",
                  }}
                >
                  Registra horas trabajadas aunque no hayas
                  iniciado el cronómetro en ese momento.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMostrarFormularioTiempo(
                    !mostrarFormularioTiempo
                  )
                }
                style={botonAgregarTiempo}
              >
                {mostrarFormularioTiempo
                  ? "✕ Cancelar"
                  : "➕ Registrar trabajo por tiempo"}
              </button>
            </div>

            {mostrarFormularioTiempo && (
              <form
                onSubmit={
                  registrarTrabajoTiempoManual
                }
                style={formularioTiempo}
              >
                <div style={campoFormulario}>
                  <label style={etiqueta}>
                    Fecha
                  </label>

                  <input
                    type="date"
                    value={fechaManual}
                    max={obtenerFechaLocalActual()}
                    onChange={(e) =>
                      setFechaManual(e.target.value)
                    }
                    style={input}
                    required
                  />
                </div>

                <div style={campoFormulario}>
                  <label style={etiqueta}>
                    Hora de inicio
                  </label>

                  <input
                    type="time"
                    value={horaInicioManual}
                    onChange={(e) =>
                      setHoraInicioManual(
                        e.target.value
                      )
                    }
                    style={input}
                    required
                  />
                </div>

                <div style={campoFormulario}>
                  <label style={etiqueta}>
                    Hora de término
                  </label>

                  <input
                    type="time"
                    value={horaFinManual}
                    onChange={(e) =>
                      setHoraFinManual(
                        e.target.value
                      )
                    }
                    style={input}
                    required
                  />
                </div>

                <div style={campoFormulario}>
                  <label style={etiqueta}>
                    Tarifa por hora
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Ej. 40"
                    value={tarifaManual}
                    onChange={(e) =>
                      setTarifaManual(
                        e.target.value
                      )
                    }
                    style={input}
                    required
                  />
                </div>

                <div style={campoDescripcion}>
                  <label style={etiqueta}>
                    Descripción del trabajo
                  </label>

                  <input
                    type="text"
                    placeholder="Ej. Arreglar prendas, revisar piezas, apoyar en terminado..."
                    value={descripcionManual}
                    onChange={(e) =>
                      setDescripcionManual(
                        e.target.value
                      )
                    }
                    style={input}
                    required
                  />
                </div>

                <div style={vistaPreviaTiempo}>
                  <div>
                    <small>
                      Tiempo trabajado
                    </small>

                    <strong>
                      {calculoTiempoManual.valido
                        ? formatearDuracion(
                            calculoTiempoManual.minutos
                          )
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <small>
                      Tarifa
                    </small>

                    <strong>
                      {tarifaManual
                        ? `${formatearDinero(
                            tarifaManual
                          )}/h`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <small>
                      Pago calculado
                    </small>

                    <strong
                      style={{
                        color: "#166534",
                        fontSize: 22,
                      }}
                    >
                      {calculoTiempoManual.valido
                        ? formatearDinero(
                            calculoTiempoManual.total
                          )
                        : "$0.00"}
                    </strong>
                  </div>
                </div>

                {horaInicioManual &&
                  horaFinManual &&
                  !calculoTiempoManual.valido && (
                    <div style={mensajeError}>
                      La hora de término debe ser
                      posterior a la hora de inicio.
                    </div>
                  )}

                <button
                  type="submit"
                  disabled={
                    guardandoTiempo ||
                    !calculoTiempoManual.valido
                  }
                  style={{
                    ...botonGuardarTiempo,
                    opacity:
                      guardandoTiempo ||
                      !calculoTiempoManual.valido
                        ? 0.6
                        : 1,
                    cursor:
                      guardandoTiempo ||
                      !calculoTiempoManual.valido
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {guardandoTiempo
                    ? "Guardando..."
                    : "💾 Guardar trabajo por tiempo"}
                </button>
              </form>
            )}
          </section>

                      <section style={card}>
              <div style={encabezadoAccion}>
                <div>
                  <h2 style={{ margin: 0 }}>
                    ⚙️ Ajustes de nómina
                  </h2>

                  <p
                    style={{
                      marginBottom: 0,
                      color: "#6b7280",
                    }}
                  >
                    Agrega pagos faltantes, bonos o correcciones
                    manuales sin modificar la producción.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setMostrarFormularioAjuste(
                      !mostrarFormularioAjuste
                    )
                  }
                  style={botonAgregarTiempo}
                >
                  {mostrarFormularioAjuste
                    ? "✕ Cancelar"
                    : "➕ Agregar ajuste"}
                </button>
              </div>

              {mostrarFormularioAjuste && (
                <form
                  onSubmit={guardarAjusteNomina}
                  style={formularioTiempo}
                >
                  <div style={campoFormulario}>
                    <label style={etiqueta}>
                      Tipo de ajuste
                    </label>

                    <select
                      value={tipoAjuste}
                      onChange={(e) =>
                        setTipoAjuste(e.target.value)
                      }
                      style={input}
                    >
                      <option value="Suma">
                        ➕ Sumar dinero
                      </option>
                      <option value="Resta">
                        ➖ Restar dinero
                      </option>
                    </select>
                  </div>

                  <div style={campoFormulario}>
                    <label style={etiqueta}>
                      Monto
                    </label>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Ej. 250"
                      value={montoAjuste}
                      onChange={(e) =>
                        setMontoAjuste(e.target.value)
                      }
                      style={input}
                      required
                    />
                  </div>

                  <div style={campoDescripcion}>
                    <label style={etiqueta}>
                      Concepto
                    </label>

                    <input
                      type="text"
                      placeholder="Ej. Paso faltante, bono, corrección..."
                      value={conceptoAjuste}
                      onChange={(e) =>
                        setConceptoAjuste(e.target.value)
                      }
                      style={input}
                      required
                    />
                  </div>

                  <div style={campoDescripcion}>
                    <label style={etiqueta}>
                      Motivo
                    </label>

                    <input
                      type="text"
                      placeholder="Ej. No se registró el paso al entregar el bulto"
                      value={motivoAjuste}
                      onChange={(e) =>
                        setMotivoAjuste(e.target.value)
                      }
                      style={input}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={guardandoAjuste}
                    style={{
                      ...botonGuardarTiempo,
                      opacity: guardandoAjuste ? 0.6 : 1,
                    }}
                  >
                    {guardandoAjuste
                      ? "Guardando..."
                      : tipoAjuste === "Suma"
                      ? "💾 Agregar a nómina"
                      : "💾 Restar de nómina"}
                  </button>
                </form>
              )}

              {resumen.ajustesSemana.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h3>Ajustes de esta semana</h3>

                  {resumen.ajustesSemana.map((ajuste) => (
                    <div
                      key={ajuste.id}
                      style={detalleCard}
                    >
                      <div>
                        <strong>
                          {ajuste.tipo === "Suma"
                            ? "➕ "
                            : "➖ "}
                          {ajuste.concepto}
                        </strong>

                        <small
                          style={{
                            display: "block",
                            marginTop: 4,
                          }}
                        >
                          {ajuste.motivo}
                        </small>

                        <small
                          style={{ display: "block" }}
                        >
                          {formatearFecha(ajuste.fecha)}
                        </small>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 7,
                          justifyItems: "end",
                        }}
                      >
                        <strong
                          style={{
                            color:
                              ajuste.tipo === "Suma"
                                ? "#166534"
                                : "#991b1b",
                          }}
                        >
                          {ajuste.tipo === "Suma"
                            ? "+"
                            : "-"}
                          {formatearDinero(
                            ajuste.monto
                          )}
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            eliminarAjusteNomina(
                              ajuste
                            )
                          }
                          style={{
                            border: "none",
                            borderRadius: 7,
                            padding: "6px 9px",
                            background: "#fee2e2",
                            color: "#991b1b",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          🗑 Eliminar ajuste
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          <h2>Resumen en tiempo real</h2>

          <section style={resumenGrid}>
            <div style={tarjetaResumen}>
              <small>Generado hoy</small>

              <strong>
                {formatearDinero(
                  resumen.totalHoy
                )}
              </strong>

              <span>
                Pasos:{" "}
                {formatearDinero(
                  resumen.pagoPasosHoy
                )}
              </span>

              <span>
                Horas:{" "}
                {formatearDinero(
                  resumen.pagoHorasHoy
                )}
              </span>
            </div>

            <div style={tarjetaResumen}>
              <small>
                Pago por pasos esta semana
              </small>

              <strong>
                {formatearDinero(
                  resumen.pagoPasosSemana
                )}
              </strong>

              <span>
                Bultos terminados:{" "}
                {resumen.bultosTerminadosSemana}
              </span>
            </div>

            <div style={tarjetaResumen}>
              <small>
                Pago por hora esta semana
              </small>

              <strong>
                {formatearDinero(
                  resumen.pagoHorasSemana
                )}
              </strong>

              <span>
                Tiempo:{" "}
                {formatearDuracion(
                  resumen.minutosSemana
                )}
              </span>
            </div>

                        <div style={tarjetaResumen}>
              <small>
                Ajustes de nómina esta semana
              </small>

              <strong
                style={{
                  color:
                    resumen.totalAjustesSemana >= 0
                      ? "#166534"
                      : "#991b1b",
                }}
              >
                {resumen.totalAjustesSemana > 0
                  ? "+"
                  : ""}
                {formatearDinero(
                  resumen.totalAjustesSemana
                )}
              </strong>

              <span>
                {resumen.ajustesSemana.length} ajuste(s)
              </span>
            </div>

            <div style={tarjetaTotal}>
              <small>
                Acumulado bruto semanal
              </small>

              <strong>
                {formatearDinero(
                  resumen.totalBrutoSemana
                )}
              </strong>
            </div>

            <div style={tarjetaPrestamo}>
              <small>
                Préstamos registrados esta semana
              </small>

              <strong>
                -
                {formatearDinero(
                  resumen.totalPrestamosSemana
                )}
              </strong>
            </div>

            <div style={tarjetaNeto}>
              <small>
                Neto estimado para el cierre
              </small>

              <strong>
                {formatearDinero(
                  resumen.netoEstimado
                )}
              </strong>
            </div>
          </section>

          <section style={card}>
            <h2>📅 Ganancia por día</h2>

            {resumenPorDia.length === 0 && (
              <p>
                Todavía no hay trabajos terminados
                esta semana.
              </p>
            )}

            {resumenPorDia.map((dia) => (
              <div
                key={dia.fecha}
                style={filaDia}
              >
                <div>
                  <strong>
                    {formatearSoloFecha(
                      dia.fecha
                    )}
                  </strong>
                </div>

                <div style={totalesDia}>
                  <span>
                    Pasos:{" "}
                    {formatearDinero(
                      dia.pasos
                    )}
                  </span>

                  <span>
                    Horas:{" "}
                    {formatearDinero(
                      dia.horas
                    )}
                  </span>

                  <strong>
                    Total:{" "}
                    {formatearDinero(
                      dia.total
                    )}
                  </strong>
                </div>
              </div>
            ))}
          </section>

          <section style={card}>
            <h2>
              Trabajo actual y pendiente
            </h2>

            <div style={resumenGrid}>
              <div style={tarjetaResumen}>
                <small>
                  Bultos pendientes
                </small>

                <strong>
                  {
                    asignacionesPendientes.length
                  }
                </strong>
              </div>

              <div style={tarjetaResumen}>
                <small>
                  Trabajos por hora activos
                </small>

                <strong>
                  {
                    trabajosTiempoActivos.length
                  }
                </strong>
              </div>
            </div>

            {asignacionesPendientes.map(
              (registro) => (
                <div
                  key={registro.id}
                  style={pendienteCard}
                >
                  <strong>
                    {
                      registro
                        .orden_bultos_v2
                        ?.nombre_bulto
                    }
                  </strong>

                  <span>
                    {
                      registro
                        .modelo_procesos
                        ?.nombre
                    }
                  </span>

                  <small>
                    Orden:{" "}
                    {registro.ordenes
                      ?.folio ||
                      "Sin orden"}{" "}
                    · Modelo:{" "}
                    {registro.ordenes
                      ?.modelos?.codigo ||
                      "Sin modelo"}
                  </small>

                  <small
                    style={{
                      color: "#92400e",
                    }}
                  >
                    Pendiente: todavía no se
                    suma a la nómina
                  </small>
                </div>
              )
            )}

            {trabajosTiempoActivos.map(
              (registro) => (
                <div
                  key={registro.id}
                  style={activoCard}
                >
                  <strong>
                    ⏱ {registro.descripcion}
                  </strong>

                  <small>
                    Inició:{" "}
                    {formatearFecha(
                      registro.fecha_inicio
                    )}
                  </small>

                  <small>
                    Tarifa:{" "}
                    {formatearDinero(
                      registro.tarifa_hora
                    )}{" "}
                    por hora
                  </small>

                  <small
                    style={{
                      color: "#166534",
                    }}
                  >
                    Trabajando actualmente
                  </small>
                </div>
              )
            )}
          </section>

          <section style={card}>
            <div style={pestanas}>
              <button
                onClick={() =>
                  setDetalleAbierto("hoy")
                }
                style={{
                  ...botonPestana,
                  ...(detalleAbierto === "hoy"
                    ? botonPestanaActivo
                    : {}),
                }}
              >
                Hoy
              </button>

              <button
                onClick={() =>
                  setDetalleAbierto("semana")
                }
                style={{
                  ...botonPestana,
                  ...(detalleAbierto ===
                  "semana"
                    ? botonPestanaActivo
                    : {}),
                }}
              >
                Semana
              </button>

              <button
                onClick={() =>
                  setDetalleAbierto(
                    "historial"
                  )
                }
                style={{
                  ...botonPestana,
                  ...(detalleAbierto ===
                  "historial"
                    ? botonPestanaActivo
                    : {}),
                }}
              >
                Historial
              </button>
            </div>

            {detalleAbierto === "hoy" && (
              <>
                <h2>
                  Trabajos terminados hoy
                </h2>

                {resumen.pasosHoy.map(
  (registro) => (
    <DetallePaso
      key={`paso-${registro.id}`}
      registro={registro}
      calcularPagoPaso={
        calcularPagoPaso
      }
      formatearDinero={
        formatearDinero
      }
      formatearFecha={
        formatearFecha
      }
      excluirPasoNomina={
        excluirPasoNomina
      }
      procesandoExclusion={
        procesandoExclusion
      }
    />
  )
)}
                {resumen.horasHoy.map(
                  (registro) => (
                    <DetalleHora
                      key={`hora-${registro.id}`}
                      registro={registro}
                      formatearDinero={
                        formatearDinero
                      }
                      formatearFecha={
                        formatearFecha
                      }
                      formatearDuracion={
                        formatearDuracion
                      }
                    />
                  )
                )}

                {resumen.pasosHoy.length ===
                  0 &&
                  resumen.horasHoy.length ===
                    0 && (
                    <p>
                      No hay trabajos terminados
                      hoy.
                    </p>
                  )}
              </>
            )}

            {detalleAbierto ===
              "semana" && (
              <>
                <h2>
                  Trabajos terminados esta
                  semana
                </h2>

                {resumen.pasosSemana.map(
                  (registro) => (
  <DetallePaso
    key={`paso-${registro.id}`}
    registro={registro}
    calcularPagoPaso={
      calcularPagoPaso
    }
    formatearDinero={
      formatearDinero
    }
    formatearFecha={
      formatearFecha
    }
    excluirPasoNomina={
      excluirPasoNomina
    }
    procesandoExclusion={
      procesandoExclusion
    }
  />
)
)}

                {resumen.horasSemana.map(
                  (registro) => (
                    <DetalleHora
                      key={`hora-${registro.id}`}
                      registro={registro}
                      formatearDinero={
                        formatearDinero
                      }
                      formatearFecha={
                        formatearFecha
                      }
                      formatearDuracion={
                        formatearDuracion
                      }
                    />
                  )
                )}

                {resumen.pasosSemana.length ===
                  0 &&
                  resumen.horasSemana.length ===
                    0 && (
                    <p>
                      No hay trabajos terminados
                      esta semana.
                    </p>
                  )}
              </>
            )}

            {detalleAbierto ===
              "historial" && (
              <>
                <h2>
                  Historial de nóminas cerradas
                </h2>

                {historialSemanas.length ===
                  0 && (
                  <p>
                    Todavía no hay semanas
                    cerradas.
                  </p>
                )}

                {historialSemanas.map(
                  (registro) => (
                    <div
                      key={registro.id}
                      style={historialCard}
                    >
                      <div>
                        <strong>
                          Semana del{" "}
                          {formatearSoloFecha(
                            registro
                              .semanas_nomina
                              ?.fecha_inicio
                          )}
                        </strong>

                        <small
                          style={{
                            display:
                              "block",
                          }}
                        >
                          Cerrada:{" "}
                          {formatearFecha(
                            registro
                              .semanas_nomina
                              ?.fecha_cierre
                          )}
                        </small>
                      </div>

                      <div
                        style={{
                          textAlign:
                            "right",
                        }}
                      >
                        <small>
                          Pasos:{" "}
                          {formatearDinero(
                            registro.pago_pieza
                          )}
                        </small>

                        <small
                          style={{
                            display:
                              "block",
                          }}
                        >
                          Horas:{" "}
                          {formatearDinero(
                            registro.pago_hora
                          )}
                        </small>

                        <strong>
                          Total:{" "}
                          {formatearDinero(
                            registro.total_pago
                          )}
                        </strong>
                      </div>
                    </div>
                  )
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DetallePaso({
  registro,
  calcularPagoPaso,
  formatearDinero,
  formatearFecha,
  excluirPasoNomina,
  procesandoExclusion,
}) {
  return (
    <div style={detalleCard}>
      <div>
        <strong>
          {registro.modelo_procesos?.nombre}
        </strong>

        <small style={{ display: "block" }}>
          {
            registro.orden_bultos_v2
              ?.nombre_bulto
          }{" "}
          ·{" "}
          {
            registro.orden_bultos_v2
              ?.cantidad
          }{" "}
          unidades procesadas
        </small>

        <small style={{ display: "block" }}>
          Orden:{" "}
          {registro.ordenes?.folio ||
            "Sin orden"}{" "}
          · Modelo:{" "}
          {registro.ordenes?.modelos
            ?.codigo || "Sin modelo"}
        </small>

        <small style={{ display: "block" }}>
          {formatearFecha(
            registro.fecha_terminado
          )}
        </small>
      </div>

            <div
        style={{
          display: "grid",
          gap: 8,
          justifyItems: "end",
        }}
      >
        <strong>
          {formatearDinero(
            calcularPagoPaso(registro)
          )}
        </strong>

        <button
          type="button"
          onClick={() => excluirPasoNomina(registro)}
          disabled={procesandoExclusion === registro.id}
          style={{
            border: "none",
            borderRadius: 7,
            padding: "7px 10px",
            background: "#fee2e2",
            color: "#991b1b",
            fontWeight: "bold",
            cursor:
              procesandoExclusion === registro.id
                ? "not-allowed"
                : "pointer",
          }}
        >
          {procesandoExclusion === registro.id
            ? "Quitando..."
            : "🗑 Quitar de nómina"}
        </button>
      </div>
    </div>
  );
}

function DetalleHora({
  registro,
  formatearDinero,
  formatearFecha,
  formatearDuracion,
}) {
  return (
    <div style={detalleCard}>
      <div>
        <strong>
          ⏱ {registro.descripcion}
        </strong>

        <small style={{ display: "block" }}>
          {registro.modelo_procesos?.nombre ||
            "Sin proceso específico"}
        </small>

        <small style={{ display: "block" }}>
          {formatearDuracion(
            registro.minutos_trabajados
          )}{" "}
          ·{" "}
          {formatearDinero(
            registro.tarifa_hora
          )}{" "}
          por hora
        </small>

        <small style={{ display: "block" }}>
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
  );
}

function obtenerFechaLocalActual() {
  const ahora = new Date();

  const anio = ahora.getFullYear();
  const mes = String(
    ahora.getMonth() + 1
  ).padStart(2, "0");
  const dia = String(
    ahora.getDate()
  ).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function crearFechaLocal(fecha, hora) {
  const [anio, mes, dia] = fecha
    .split("-")
    .map(Number);

  const [horas, minutos] = hora
    .split(":")
    .map(Number);

  return new Date(
    anio,
    mes - 1,
    dia,
    horas,
    minutos,
    0,
    0
  );
}

const card = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  marginBottom: 20,
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.08)",
};

const input = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const etiqueta = {
  display: "block",
  fontWeight: "bold",
  marginBottom: 8,
};

const encabezadoPerfil = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
};

const estadoActivo = {
  background: "#dcfce7",
  color: "#166534",
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: "bold",
};

const datosEmpleado = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 10,
  marginTop: 15,
};

const resumenGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 15,
  marginBottom: 20,
};

const tarjetaResumen = {
  background: "white",
  padding: 18,
  borderRadius: 12,
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.08)",
  display: "grid",
  gap: 7,
};

const tarjetaTotal = {
  ...tarjetaResumen,
  background: "#dbeafe",
  color: "#1e3a8a",
};

const tarjetaPrestamo = {
  ...tarjetaResumen,
  background: "#fef3c7",
  color: "#92400e",
};

const tarjetaNeto = {
  ...tarjetaResumen,
  background: "#166534",
  color: "white",
};

const filaDia = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: 14,
  borderBottom: "1px solid #eee",
};

const totalesDia = {
  display: "flex",
  gap: 15,
  flexWrap: "wrap",
  alignItems: "center",
};

const pendienteCard = {
  display: "grid",
  gap: 5,
  padding: 13,
  marginBottom: 10,
  borderRadius: 10,
  border: "1px solid #fde68a",
  background: "#fffbeb",
};

const activoCard = {
  display: "grid",
  gap: 5,
  padding: 13,
  marginBottom: 10,
  borderRadius: 10,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
};

const pestanas = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 20,
};

const botonPestana = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 8,
  background: "#e5e7eb",
  cursor: "pointer",
  fontWeight: "bold",
};

const botonPestanaActivo = {
  background: "#2563eb",
  color: "white",
};

const detalleCard = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: 14,
  borderBottom: "1px solid #eee",
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

// NUEVOS ESTILOS DEL FORMULARIO

const encabezadoAccion = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  flexWrap: "wrap",
};

const botonAgregarTiempo = {
  padding: "11px 15px",
  border: "none",
  borderRadius: 8,
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const formularioTiempo = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 15,
  marginTop: 20,
  paddingTop: 20,
  borderTop: "1px solid #e5e7eb",
};

const campoFormulario = {
  minWidth: 0,
};

const campoDescripcion = {
  gridColumn: "1 / -1",
};

const vistaPreviaTiempo = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  padding: 16,
  borderRadius: 10,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
};

const mensajeError = {
  gridColumn: "1 / -1",
  padding: 12,
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 8,
  fontWeight: "bold",
};

const botonGuardarTiempo = {
  gridColumn: "1 / -1",
  padding: 13,
  border: "none",
  borderRadius: 9,
  background: "#166534",
  color: "white",
  fontWeight: "bold",
  fontSize: 15,
};