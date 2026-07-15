"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const tallasIniciales = [
  { talla: "CH", cantidad: "" },
  { talla: "M", cantidad: "" },
  { talla: "G", cantidad: "" },
];

export default function OrdenesPage() {
  const [modelos, setModelos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [procesandoOrden, setProcesandoOrden] = useState(null);

  const [paso, setPaso] = useState(1);

  const [form, setForm] = useState({
    cliente: "",
    modeloId: "",
    cantidadTotal: "",
    prioridad: "Normal",
    estado: "Pendiente",
    fechaEntrega: "",
    notas: "",
  });

  const [tallas, setTallas] = useState(tallasIniciales);
  const [tallaIndex, setTallaIndex] = useState(0);

  const [bultosPorTalla, setBultosPorTalla] = useState({
    CH: [{ cantidad: "" }],
    M: [{ cantidad: "" }],
    G: [{ cantidad: "" }],
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: mod, error: errorModelos } = await supabase
      .from("modelos")
      .select("*")
      .eq("activo", true)
      .order("codigo");

    if (errorModelos) {
      alert(errorModelos.message);
      return;
    }

    const { data: ord, error: errorOrdenes } = await supabase
      .from("ordenes")
      .select("*, modelos(id,codigo,nombre)")
      .order("id", { ascending: false });

    if (errorOrdenes) {
      alert(errorOrdenes.message);
      return;
    }

    const ordenesBase = ord || [];
    const idsOrdenes = ordenesBase.map((orden) => orden.id);

    if (idsOrdenes.length === 0) {
      setModelos(mod || []);
      setOrdenes([]);
      return;
    }

    const modeloIds = [
      ...new Set(
        ordenesBase
          .map((orden) => orden.modelo_id)
          .filter(Boolean)
      ),
    ];

    const [
      respuestaBultos,
      respuestaAsignaciones,
      respuestaProcesos,
    ] = await Promise.all([
      supabase
        .from("orden_bultos_v2")
        .select("id,orden_id")
        .in("orden_id", idsOrdenes),

      supabase
        .from("asignaciones")
        .select("id,orden_id,estado")
        .in("orden_id", idsOrdenes),

      modeloIds.length > 0
        ? supabase
            .from("modelo_procesos")
            .select("id,modelo_id")
            .in("modelo_id", modeloIds)
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ]);

    const error =
      respuestaBultos.error ||
      respuestaAsignaciones.error ||
      respuestaProcesos.error;

    if (error) {
      alert(error.message);
      return;
    }

    const bultos = respuestaBultos.data || [];
    const asignaciones = respuestaAsignaciones.data || [];
    const procesos = respuestaProcesos.data || [];

    const ordenesConAvance = ordenesBase.map((orden) => {
      const totalBultos = bultos.filter(
        (bulto) =>
          Number(bulto.orden_id) === Number(orden.id)
      ).length;

      const totalProcesos = procesos.filter(
        (proceso) =>
          Number(proceso.modelo_id) ===
          Number(orden.modelo_id)
      ).length;

      const totalPasosEsperados =
        totalBultos * totalProcesos;

      const pasosTerminados = asignaciones.filter(
        (asignacion) =>
          Number(asignacion.orden_id) ===
            Number(orden.id) &&
          asignacion.estado === "Terminado"
      ).length;

      const porcentajeAvance =
        totalPasosEsperados > 0
          ? Math.min(
              100,
              Math.round(
                (pasosTerminados /
                  totalPasosEsperados) *
                  100
              )
            )
          : 0;

      return {
        ...orden,
        totalBultos,
        totalProcesos,
        totalPasosEsperados,
        pasosTerminados,
        porcentajeAvance,
      };
    });

    setModelos(mod || []);
    setOrdenes(ordenesConAvance);
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);

    setTimeout(() => {
      setMensaje("");
    }, 3000);
  }

  const totalTallas = useMemo(
    () =>
      tallas.reduce(
        (suma, talla) =>
          suma + Number(talla.cantidad || 0),
        0
      ),
    [tallas]
  );

  const tallasValidas = tallas.filter(
    (talla) =>
      talla.talla.trim() &&
      Number(talla.cantidad || 0) > 0
  );

  const tallaActual =
    tallasValidas[tallaIndex]?.talla || "";

  const cantidadActual = Number(
    tallasValidas[tallaIndex]?.cantidad || 0
  );

  const bultosActuales =
    bultosPorTalla[tallaActual] || [
      { cantidad: "" },
    ];

  const totalBultosActual = bultosActuales.reduce(
    (suma, bulto) =>
      suma + Number(bulto.cantidad || 0),
    0
  );

  const todosBultos = Object.entries(
    bultosPorTalla
  ).flatMap(([talla, lista]) =>
    (lista || [])
      .filter(
        (bulto) =>
          Number(bulto.cantidad || 0) > 0
      )
      .map((bulto, index) => ({
        talla,
        nombre_bulto: `${talla}${index + 1}`,
        cantidad: Number(bulto.cantidad),
      }))
  );

  function actualizarForm(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function actualizarTalla(index, campo, valor) {
    const copia = tallas.map((talla) => ({
      ...talla,
    }));

    copia[index][campo] =
      campo === "talla"
        ? valor.toUpperCase()
        : valor;

    setTallas(copia);

    if (campo === "talla") {
      const nuevaTalla = valor.toUpperCase();

      if (
        nuevaTalla &&
        !bultosPorTalla[nuevaTalla]
      ) {
        setBultosPorTalla((actual) => ({
          ...actual,
          [nuevaTalla]: [{ cantidad: "" }],
        }));
      }
    }
  }

  function agregarTalla() {
    setTallas((actual) => [
      ...actual,
      {
        talla: "",
        cantidad: "",
      },
    ]);
  }

  function validarPaso1() {
    if (!form.modeloId) {
      alert("Selecciona un modelo");
      return;
    }

    if (
      !form.cantidadTotal ||
      Number(form.cantidadTotal) <= 0
    ) {
      alert(
        "Escribe una cantidad total oficial válida"
      );
      return;
    }

    setPaso(2);
  }

  function validarPaso2() {
    if (tallasValidas.length === 0) {
      alert("Agrega al menos una talla");
      return;
    }

    if (
      totalTallas !==
      Number(form.cantidadTotal)
    ) {
      alert(
        `Las tallas no cuadran.\n\n` +
          `Total tallas: ${totalTallas}\n` +
          `Total oficial: ${form.cantidadTotal}`
      );

      return;
    }

    const nuevosBultos = {
      ...bultosPorTalla,
    };

    tallasValidas.forEach((talla) => {
      if (!nuevosBultos[talla.talla]) {
        nuevosBultos[talla.talla] = [
          { cantidad: "" },
        ];
      }
    });

    setBultosPorTalla(nuevosBultos);
    setTallaIndex(0);
    setPaso(3);

    setTimeout(() => {
      document
        .getElementById("cantidad-bulto-0")
        ?.focus();
    }, 100);
  }

  function actualizarBulto(index, valor) {
    const copia = bultosActuales.map(
      (bulto) => ({
        ...bulto,
      })
    );

    copia[index].cantidad = valor;

    setBultosPorTalla((actual) => ({
      ...actual,
      [tallaActual]: copia,
    }));
  }

  function agregarBulto() {
    const copia = [
      ...bultosActuales,
      { cantidad: "" },
    ];

    setBultosPorTalla((actual) => ({
      ...actual,
      [tallaActual]: copia,
    }));

    setTimeout(() => {
      document
        .getElementById(
          `cantidad-bulto-${copia.length - 1}`
        )
        ?.focus();
    }, 50);
  }

  function enterEnBulto(e, index) {
    if (
      e.key !== "Enter" &&
      e.key !== "Tab"
    ) {
      return;
    }

    e.preventDefault();

    const total = bultosActuales.reduce(
      (suma, bulto) =>
        suma + Number(bulto.cantidad || 0),
      0
    );

    if (total > cantidadActual) {
      alert(
        `La talla ${tallaActual} supera la cantidad esperada.\n\n` +
          `Esperado: ${cantidadActual}\n` +
          `Capturado: ${total}`
      );

      return;
    }

    if (total === cantidadActual) {
      if (
        tallaIndex <
        tallasValidas.length - 1
      ) {
        const confirmar = confirm(
          `La talla ${tallaActual} llegó a ${total} unidades.\n\n` +
            `¿Continuar con la siguiente talla?`
        );

        if (confirmar) {
          setTallaIndex(
            (actual) => actual + 1
          );

          setTimeout(() => {
            document
              .getElementById(
                "cantidad-bulto-0"
              )
              ?.focus();
          }, 100);
        }
      } else {
        const confirmar = confirm(
          "Ya terminaste la última talla.\n\n¿Ir al resumen?"
        );

        if (confirmar) {
          setPaso(4);
        }
      }

      return;
    }

    if (
      index ===
      bultosActuales.length - 1
    ) {
      agregarBulto();
    } else {
      document
        .getElementById(
          `cantidad-bulto-${index + 1}`
        )
        ?.focus();
    }
  }

  function irSiguienteTalla() {
    if (
      totalBultosActual !==
      cantidadActual
    ) {
      alert(
        `La talla ${tallaActual} no cuadra.\n\n` +
          `Esperado: ${cantidadActual}\n` +
          `Capturado: ${totalBultosActual}`
      );

      return;
    }

    if (
      tallaIndex <
      tallasValidas.length - 1
    ) {
      setTallaIndex(
        (actual) => actual + 1
      );

      setTimeout(() => {
        document
          .getElementById(
            "cantidad-bulto-0"
          )
          ?.focus();
      }, 100);
    } else {
      setPaso(4);
    }
  }

  function irTallaAnterior() {
    if (tallaIndex > 0) {
      setTallaIndex(
        (actual) => actual - 1
      );

      setTimeout(() => {
        document
          .getElementById(
            "cantidad-bulto-0"
          )
          ?.focus();
      }, 100);
    }
  }

  async function crearOrdenFinal() {
    if (todosBultos.length === 0) {
      alert("No hay bultos capturados");
      return;
    }

    for (const talla of tallasValidas) {
      const total = (
        bultosPorTalla[talla.talla] || []
      ).reduce(
        (suma, bulto) =>
          suma +
          Number(bulto.cantidad || 0),
        0
      );

      if (
        total !==
        Number(talla.cantidad)
      ) {
        alert(
          `La talla ${talla.talla} no cuadra.\n\n` +
            `Esperado: ${talla.cantidad}\n` +
            `Capturado: ${total}`
        );

        return;
      }
    }

    const confirmar = confirm(
      "¿Crear la orden completa?"
    );

    if (!confirmar) return;

    const folio = `OP-${Date.now()}`;

    const { data: orden, error } =
      await supabase
        .from("ordenes")
        .insert([
          {
            folio,
            cliente: form.cliente.trim(),
            modelo_id: Number(
              form.modeloId
            ),
            cantidad_total: Number(
              form.cantidadTotal
            ),
            prioridad: form.prioridad,
            estado: form.estado,
            fecha_entrega:
              form.fechaEntrega || null,
            notas: form.notas.trim(),
          },
        ])
        .select()
        .single();

    if (error) {
      alert(error.message);
      return;
    }

    const registrosTallas =
      tallasValidas.map(
        (talla, index) => ({
          orden_id: orden.id,
          talla: talla.talla,
          cantidad: Number(
            talla.cantidad
          ),
          orden: index + 1,
        })
      );

    const { error: errorTallas } =
      await supabase
        .from("orden_tallas")
        .insert(registrosTallas);

    if (errorTallas) {
      alert(errorTallas.message);
      return;
    }

    const registrosBultos =
      todosBultos.map((bulto) => ({
        orden_id: orden.id,
        talla: bulto.talla,
        nombre_bulto:
          bulto.nombre_bulto,
        cantidad: bulto.cantidad,
      }));

    const { error: errorBultos } =
      await supabase
        .from("orden_bultos_v2")
        .insert(registrosBultos);

    if (errorBultos) {
      alert(errorBultos.message);
      return;
    }

    mostrarMensaje(
      "Orden creada correctamente"
    );

    setPaso(1);

    setForm({
      cliente: "",
      modeloId: "",
      cantidadTotal: "",
      prioridad: "Normal",
      estado: "Pendiente",
      fechaEntrega: "",
      notas: "",
    });

    setTallas(tallasIniciales);
    setTallaIndex(0);

    setBultosPorTalla({
      CH: [{ cantidad: "" }],
      M: [{ cantidad: "" }],
      G: [{ cantidad: "" }],
    });

    await cargarDatos();
  }

  function colorEstado(estado) {
    const colores = {
      Pendiente: {
        fondo: "#dbeafe",
        texto: "#1e40af",
        icono: "🔵",
      },

      "En preparación": {
        fondo: "#fef3c7",
        texto: "#92400e",
        icono: "🟡",
      },

      "En producción": {
        fondo: "#dcfce7",
        texto: "#166534",
        icono: "🟢",
      },

      Terminada: {
        fondo: "#e5e7eb",
        texto: "#374151",
        icono: "⚫",
      },
    };

    return (
      colores[estado] || {
        fondo: "#f3f4f6",
        texto: "#374151",
        icono: "⚪",
      }
    );
  }

  function estadoFechaEntrega(orden) {
    if (orden.estado === "Terminada") {
      return {
        texto: "Orden terminada",
        color: "#6b7280",
        fondo: "#f3f4f6",
      };
    }

    if (!orden.fecha_entrega) {
      return {
        texto: "Sin fecha de entrega",
        color: "#6b7280",
        fondo: "#f3f4f6",
      };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const entrega = new Date(
      `${orden.fecha_entrega}T00:00:00`
    );

    const diferenciaDias = Math.ceil(
      (entrega.getTime() -
        hoy.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (diferenciaDias < 0) {
      return {
        texto: `🔴 Vencida hace ${Math.abs(
          diferenciaDias
        )} día(s)`,
        color: "#991b1b",
        fondo: "#fee2e2",
      };
    }

    if (diferenciaDias <= 2) {
      return {
        texto:
          diferenciaDias === 0
            ? "🔴 Se entrega hoy"
            : `🔴 Faltan ${diferenciaDias} día(s)`,
        color: "#991b1b",
        fondo: "#fee2e2",
      };
    }

    if (diferenciaDias <= 5) {
      return {
        texto: `🟡 Faltan ${diferenciaDias} días`,
        color: "#92400e",
        fondo: "#fef3c7",
      };
    }

    return {
      texto: `🟢 Faltan ${diferenciaDias} días`,
      color: "#166534",
      fondo: "#dcfce7",
    };
  }

  async function marcarOrdenTerminada(
    orden
  ) {
    if (
      orden.estado === "Terminada"
    ) {
      return;
    }

    const pendientes =
      orden.totalPasosEsperados -
      orden.pasosTerminados;

    const confirmar = confirm(
      `¿Marcar la orden ${orden.folio} como terminada?\n\n` +
        `Avance registrado: ${orden.porcentajeAvance}%\n` +
        `Pasos terminados: ${orden.pasosTerminados} de ${orden.totalPasosEsperados}\n\n` +
        `${
          pendientes > 0
            ? `⚠ Todavía faltan ${pendientes} pasos registrados.\n\n`
            : ""
        }` +
        `La orden dejará de aparecer en Asignaciones y en las órdenes activas.\n\n` +
        `Su historial no se eliminará.`
    );

    if (!confirmar) return;

    setProcesandoOrden(orden.id);

    try {
      const { error } = await supabase
        .from("ordenes")
        .update({
          estado: "Terminada",
        })
        .eq("id", orden.id);

      if (error) throw error;

      mostrarMensaje(
        `Orden ${orden.folio} marcada como terminada`
      );

      await cargarDatos();
    } catch (error) {
      alert(
        error.message ||
          "No se pudo terminar la orden"
      );
    } finally {
      setProcesandoOrden(null);
    }
  }

  async function editarOrden(orden) {
    const cliente = prompt(
      "Cliente de la orden:",
      orden.cliente || ""
    );

    if (cliente === null) return;

    const prioridad = prompt(
      "Prioridad: Alta, Normal o Baja",
      orden.prioridad || "Normal"
    );

    if (prioridad === null) return;

    const prioridadLimpia =
      prioridad.trim();

    const prioridadesValidas = [
      "Alta",
      "Normal",
      "Baja",
    ];

    if (
      !prioridadesValidas.includes(
        prioridadLimpia
      )
    ) {
      alert(
        "La prioridad debe escribirse exactamente como Alta, Normal o Baja"
      );

      return;
    }

    const fechaEntrega = prompt(
      "Fecha de entrega en formato AAAA-MM-DD. Déjala vacía si no aplica:",
      orden.fecha_entrega || ""
    );

    if (fechaEntrega === null) return;

    const notas = prompt(
      "Notas de la orden:",
      orden.notas || ""
    );

    if (notas === null) return;

    setProcesandoOrden(orden.id);

    try {
      const { error } = await supabase
        .from("ordenes")
        .update({
          cliente: cliente.trim(),
          prioridad: prioridadLimpia,
          fecha_entrega:
            fechaEntrega.trim() || null,
          notas: notas.trim(),
        })
        .eq("id", orden.id);

      if (error) throw error;

      mostrarMensaje(
        `Orden ${orden.folio} actualizada`
      );

      await cargarDatos();
    } catch (error) {
      alert(
        error.message ||
          "No se pudo editar la orden"
      );
    } finally {
      setProcesandoOrden(null);
    }
  }

  async function eliminarOrden(orden) {
    const confirmar = confirm(
      `¿Eliminar la orden ${orden.folio}?\n\n` +
        `Esta opción es solamente para órdenes creadas por error.\n\n` +
        `Primero se verificará que no tenga producción registrada.`
    );

    if (!confirmar) return;

    setProcesandoOrden(orden.id);

    try {
      const [
        respuestaAsignaciones,
        respuestaMovimientos,
        respuestaTiempo,
      ] = await Promise.all([
        supabase
          .from("asignaciones")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("orden_id", orden.id),

        supabase
          .from("movimientos_bulto")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("orden_id", orden.id),

        supabase
          .from("trabajos_tiempo")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("orden_id", orden.id),
      ]);

      const error =
        respuestaAsignaciones.error ||
        respuestaMovimientos.error ||
        respuestaTiempo.error;

      if (error) throw error;

      const tieneProduccion =
        Number(
          respuestaAsignaciones.count ||
            0
        ) > 0 ||
        Number(
          respuestaMovimientos.count || 0
        ) > 0 ||
        Number(
          respuestaTiempo.count || 0
        ) > 0;

      if (tieneProduccion) {
        alert(
          "Esta orden ya tiene asignaciones, movimientos o trabajos registrados.\n\n" +
            "No puede eliminarse. Utiliza “Terminar orden” para conservar el historial."
        );

        return;
      }

      const confirmarDefinitivo =
        confirm(
          `La orden ${orden.folio} no tiene producción registrada.\n\n` +
            `Se eliminarán sus tallas y bultos.\n\n` +
            `Esta acción no se puede deshacer.\n\n` +
            `¿Continuar?`
        );

      if (!confirmarDefinitivo) {
        return;
      }

      const { error: errorBultos } =
        await supabase
          .from("orden_bultos_v2")
          .delete()
          .eq("orden_id", orden.id);

      if (errorBultos) {
        throw errorBultos;
      }

      const { error: errorTallas } =
        await supabase
          .from("orden_tallas")
          .delete()
          .eq("orden_id", orden.id);

      if (errorTallas) {
        throw errorTallas;
      }

      const { error: errorOrden } =
        await supabase
          .from("ordenes")
          .delete()
          .eq("id", orden.id);

      if (errorOrden) {
        throw errorOrden;
      }

      mostrarMensaje(
        `Orden ${orden.folio} eliminada`
      );

      await cargarDatos();
    } catch (error) {
      alert(
        error.message ||
          "No se pudo eliminar la orden"
      );
    } finally {
      setProcesandoOrden(null);
    }
  }

  const resumenEstados = useMemo(() => {
    return {
      abiertas: ordenes.filter(
        (orden) =>
          orden.estado !== "Terminada"
      ).length,

      pendientes: ordenes.filter(
        (orden) =>
          orden.estado === "Pendiente"
      ).length,

      preparacion: ordenes.filter(
        (orden) =>
          orden.estado ===
          "En preparación"
      ).length,

      produccion: ordenes.filter(
        (orden) =>
          orden.estado ===
          "En producción"
      ).length,

      terminadas: ordenes.filter(
        (orden) =>
          orden.estado === "Terminada"
      ).length,
    };
  }, [ordenes]);

  return (
    <div>
      <h1>📦 Órdenes de producción</h1>

      {mensaje && (
        <div style={alerta}>
          {mensaje}
        </div>
      )}

      <section style={resumenOrdenes}>
        <ResumenOrden
          titulo="📦 Órdenes abiertas"
          valor={resumenEstados.abiertas}
        />

        <ResumenOrden
          titulo="🔵 Pendientes"
          valor={resumenEstados.pendientes}
        />

        <ResumenOrden
          titulo="🟡 En preparación"
          valor={resumenEstados.preparacion}
        />

        <ResumenOrden
          titulo="🟢 En producción"
          valor={resumenEstados.produccion}
        />

        <ResumenOrden
          titulo="⚫ Terminadas"
          valor={resumenEstados.terminadas}
        />
      </section>

      <div style={pasos}>
        <strong>Paso {paso} de 4</strong>
        <span>1 Información</span>
        <span>2 Tallas</span>
        <span>3 Bultos</span>
        <span>4 Resumen</span>
      </div>

      {paso === 1 && (
        <section style={card}>
          <h2>
            1. Información de la orden
          </h2>

          <input
            placeholder="Cliente"
            value={form.cliente}
            onChange={(e) =>
              actualizarForm(
                "cliente",
                e.target.value
              )
            }
            style={input}
          />

          <select
            value={form.modeloId}
            onChange={(e) =>
              actualizarForm(
                "modeloId",
                e.target.value
              )
            }
            style={input}
          >
            <option value="">
              Selecciona modelo
            </option>

            {modelos.map((modelo) => (
              <option
                key={modelo.id}
                value={modelo.id}
              >
                {modelo.codigo} -{" "}
                {modelo.nombre}
              </option>
            ))}
          </select>

          <input
            placeholder="Cantidad total oficial"
            type="number"
            min="1"
            value={form.cantidadTotal}
            onChange={(e) =>
              actualizarForm(
                "cantidadTotal",
                e.target.value
              )
            }
            style={input}
          />

          <select
            value={form.prioridad}
            onChange={(e) =>
              actualizarForm(
                "prioridad",
                e.target.value
              )
            }
            style={input}
          >
            <option>Alta</option>
            <option>Normal</option>
            <option>Baja</option>
          </select>

          <select
            value={form.estado}
            onChange={(e) =>
              actualizarForm(
                "estado",
                e.target.value
              )
            }
            style={input}
          >
            <option>Pendiente</option>
            <option>
              En preparación
            </option>
            <option>
              En producción
            </option>
          </select>

          <label>
            Fecha de entrega
          </label>

          <input
            type="date"
            value={form.fechaEntrega}
            onChange={(e) =>
              actualizarForm(
                "fechaEntrega",
                e.target.value
              )
            }
            style={input}
          />

          <textarea
            placeholder="Notas de la orden"
            value={form.notas}
            onChange={(e) =>
              actualizarForm(
                "notas",
                e.target.value
              )
            }
            style={{
              ...input,
              minHeight: 80,
            }}
          />

          <button
            onClick={validarPaso1}
            style={boton}
          >
            Siguiente
          </button>
        </section>
      )}

      {paso === 2 && (
        <section style={card}>
          <h2>2. Tallas</h2>

          {tallas.map(
            (talla, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: 10,
                }}
              >
                <input
                  placeholder="Talla"
                  value={talla.talla}
                  onChange={(e) =>
                    actualizarTalla(
                      index,
                      "talla",
                      e.target.value
                    )
                  }
                  style={input}
                />

                <input
                  placeholder="Cantidad"
                  type="number"
                  min="0"
                  value={talla.cantidad}
                  onChange={(e) =>
                    actualizarTalla(
                      index,
                      "cantidad",
                      e.target.value
                    )
                  }
                  style={input}
                />
              </div>
            )
          )}

          <button
            onClick={agregarTalla}
            style={botonSecundario}
          >
            + Agregar talla
          </button>

          <h3>
            Total tallas: {totalTallas} /
            Total oficial:{" "}
            {form.cantidadTotal || 0}
          </h3>

          <button
            onClick={() => setPaso(1)}
            style={botonSecundario}
          >
            Atrás
          </button>

          <button
            onClick={validarPaso2}
            style={boton}
          >
            Siguiente
          </button>
        </section>
      )}

      {paso === 3 && (
        <section style={card}>
          <h2>3. Bultos</h2>

          <h3>
            Talla {tallaActual}:{" "}
            {totalBultosActual} /{" "}
            {cantidadActual} unidades
          </h3>

          <div style={barraProgreso}>
            <div
              style={{
                ...progreso,
                width: `${Math.min(
                  100,
                  cantidadActual
                    ? (totalBultosActual /
                        cantidadActual) *
                      100
                    : 0
                )}%`,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 15,
            }}
          >
            {tallasValidas.map(
              (talla, index) => (
                <button
                  key={`${talla.talla}-${index}`}
                  onClick={() =>
                    setTallaIndex(index)
                  }
                  style={{
                    ...botonSecundario,
                    background:
                      index === tallaIndex
                        ? "#16a34a"
                        : "#e5e7eb",
                    color:
                      index === tallaIndex
                        ? "white"
                        : "black",
                  }}
                >
                  {talla.talla}
                </button>
              )
            )}
          </div>

          {bultosActuales.map(
            (bulto, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "120px 1fr",
                  gap: 10,
                }}
              >
                <div style={bultoNombre}>
                  {tallaActual}
                  {index + 1}
                </div>

                <input
                  id={`cantidad-bulto-${index}`}
                  placeholder="Cantidad"
                  type="number"
                  min="1"
                  value={bulto.cantidad}
                  onChange={(e) =>
                    actualizarBulto(
                      index,
                      e.target.value
                    )
                  }
                  onKeyDown={(e) =>
                    enterEnBulto(
                      e,
                      index
                    )
                  }
                  style={input}
                />
              </div>
            )
          )}

          <button
            onClick={irTallaAnterior}
            style={botonSecundario}
            disabled={tallaIndex === 0}
          >
            Talla anterior
          </button>

          <button
            onClick={irSiguienteTalla}
            style={boton}
          >
            {tallaIndex <
            tallasValidas.length - 1
              ? "Siguiente talla"
              : "Ir a resumen"}
          </button>
        </section>
      )}

      {paso === 4 && (
        <section style={card}>
          <h2>4. Resumen</h2>

          <p>
            <strong>Cliente:</strong>{" "}
            {form.cliente ||
              "Sin cliente"}
          </p>

          <p>
            <strong>
              Cantidad total:
            </strong>{" "}
            {form.cantidadTotal}
          </p>

          <p>
            <strong>Bultos:</strong>{" "}
            {todosBultos.length}
          </p>

          <h3>Tallas</h3>

          {tallasValidas.map(
            (talla) => {
              const total = (
                bultosPorTalla[
                  talla.talla
                ] || []
              ).reduce(
                (suma, bulto) =>
                  suma +
                  Number(
                    bulto.cantidad || 0
                  ),
                0
              );

              return (
                <p key={talla.talla}>
                  <strong>
                    {talla.talla}
                  </strong>
                  : {total} /{" "}
                  {talla.cantidad}
                </p>
              );
            }
          )}

          <button
            onClick={() => setPaso(3)}
            style={botonSecundario}
          >
            Atrás
          </button>

          <button
            onClick={crearOrdenFinal}
            style={boton}
          >
            Crear orden
          </button>
        </section>
      )}

      <section style={card}>
        <h2>
          Órdenes de producción registradas
        </h2>

        {ordenes.length === 0 && (
          <p>
            Todavía no hay órdenes
            registradas.
          </p>
        )}

        {ordenes.map((orden) => {
          const estiloEstado =
            colorEstado(orden.estado);

          const entrega =
            estadoFechaEntrega(orden);

          const procesando =
            procesandoOrden === orden.id;

          return (
            <div
              key={orden.id}
              style={ordenCard}
            >
              <div style={encabezadoOrden}>
                <div>
                  <h3 style={{ margin: 0 }}>
                    {orden.folio}
                  </h3>

                  <p
                    style={{
                      margin: "5px 0",
                    }}
                  >
                    <strong>
                      Modelo:
                    </strong>{" "}
                    {orden.modelos?.codigo ||
                      "Sin modelo"}{" "}
                    —{" "}
                    {orden.modelos?.nombre ||
                      ""}
                  </p>

                  <p
                    style={{
                      margin: "5px 0",
                    }}
                  >
                    <strong>
                      Cliente:
                    </strong>{" "}
                    {orden.cliente ||
                      "Sin cliente"}
                  </p>
                </div>

                <div
                  style={{
                    ...etiquetaEstado,
                    background:
                      estiloEstado.fondo,
                    color:
                      estiloEstado.texto,
                  }}
                >
                  {estiloEstado.icono}{" "}
                  {orden.estado}
                </div>
              </div>

              <div style={datosOrden}>
                <span>
                  <strong>
                    Cantidad:
                  </strong>{" "}
                  {orden.cantidad_total ||
                    0}
                </span>

                <span>
                  <strong>
                    Prioridad:
                  </strong>{" "}
                  {orden.prioridad ||
                    "Normal"}
                </span>

                <span>
                  <strong>
                    Bultos:
                  </strong>{" "}
                  {orden.totalBultos}
                </span>

                <span>
                  <strong>
                    Procesos:
                  </strong>{" "}
                  {orden.totalProcesos}
                </span>
              </div>

              <div
                style={{
                  ...avisoEntrega,
                  background:
                    entrega.fondo,
                  color: entrega.color,
                }}
              >
                {entrega.texto}
              </div>

              <div
                style={{
                  marginTop: 15,
                }}
              >
                <div
                  style={encabezadoAvance}
                >
                  <strong>
                    Avance de procesos
                  </strong>

                  <span>
                    {
                      orden.porcentajeAvance
                    }
                    %
                  </span>
                </div>

                <div
                  style={barraAvanceOrden}
                >
                  <div
                    style={{
                      ...avanceOrden,
                      width: `${orden.porcentajeAvance}%`,
                    }}
                  />
                </div>

                <small>
                  {
                    orden.pasosTerminados
                  }{" "}
                  de{" "}
                  {
                    orden.totalPasosEsperados
                  }{" "}
                  pasos de bulto
                  registrados como
                  terminados
                </small>
              </div>

              {orden.notas && (
                <div style={notasOrden}>
                  <strong>
                    Notas:
                  </strong>{" "}
                  {orden.notas}
                </div>
              )}

              <div style={accionesOrden}>
                <button
                  type="button"
                  onClick={() =>
                    editarOrden(orden)
                  }
                  style={botonEditar}
                  disabled={procesando}
                >
                  ✏ Editar
                </button>

                {orden.estado !==
                  "Terminada" && (
                  <button
                    type="button"
                    onClick={() =>
                      marcarOrdenTerminada(
                        orden
                      )
                    }
                    style={
                      botonTerminar
                    }
                    disabled={
                      procesando
                    }
                  >
                    ✅ Terminar orden
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    eliminarOrden(orden)
                  }
                  style={botonEliminar}
                  disabled={procesando}
                >
                  🗑 Eliminar
                </button>
              </div>

              {procesando && (
                <small
                  style={{
                    display: "block",
                    marginTop: 10,
                    color: "#6b7280",
                  }}
                >
                  Procesando orden...
                </small>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function ResumenOrden({
  titulo,
  valor,
}) {
  return (
    <div style={resumenCard}>
      <small>{titulo}</small>
      <strong
        style={{
          fontSize: 28,
        }}
      >
        {valor}
      </strong>
    </div>
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
  padding: 10,
  marginTop: 8,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const boton = {
  padding: "12px 18px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 10,
  marginRight: 10,
};

const botonSecundario = {
  padding: "12px 18px",
  background: "#e5e7eb",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 10,
  marginRight: 10,
};

const alerta = {
  background: "#dcfce7",
  color: "#166534",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
  fontWeight: "bold",
};

const pasos = {
  background: "white",
  padding: 12,
  borderRadius: 12,
  marginBottom: 15,
  display: "flex",
  gap: 15,
  flexWrap: "wrap",
};

const barraProgreso = {
  width: "100%",
  height: 16,
  background: "#e5e7eb",
  borderRadius: 999,
  overflow: "hidden",
  marginBottom: 15,
};

const progreso = {
  height: "100%",
  background: "#16a34a",
};

const bultoNombre = {
  padding: 10,
  marginTop: 8,
  marginBottom: 10,
  borderRadius: 8,
  background: "#f3f4f6",
  fontWeight: "bold",
};

const resumenOrdenes = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 15,
  marginBottom: 20,
};

const resumenCard = {
  background: "white",
  padding: 18,
  borderRadius: 12,
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.08)",
  display: "grid",
  gap: 8,
};

const ordenCard = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
  background: "#ffffff",
};

const encabezadoOrden = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 15,
  flexWrap: "wrap",
};

const etiquetaEstado = {
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const datosOrden = {
  display: "flex",
  gap: 18,
  flexWrap: "wrap",
  marginTop: 15,
  paddingTop: 12,
  borderTop: "1px solid #eee",
};

const avisoEntrega = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: "bold",
  marginTop: 15,
};

const encabezadoAvance = {
  display: "flex",
  justifyContent: "space-between",
  gap: 15,
  marginBottom: 7,
};

const barraAvanceOrden = {
  width: "100%",
  height: 14,
  background: "#e5e7eb",
  borderRadius: 999,
  overflow: "hidden",
  marginBottom: 6,
};

const avanceOrden = {
  height: "100%",
  background: "#16a34a",
  transition: "width 0.2s ease",
};

const notasOrden = {
  marginTop: 15,
  padding: 12,
  background: "#f9fafb",
  borderRadius: 8,
};

const accionesOrden = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 18,
};

const botonEditar = {
  padding: "10px 14px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
};

const botonTerminar = {
  padding: "10px 14px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
};

const botonEliminar = {
  padding: "10px 14px",
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
};