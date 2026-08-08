/*
 * Calculadora de presupuesto orientativo de Aplidec.
 *
 * IMPORTANTE: en este fichero NO se calcula ningún importe. Los precios, el IVA
 * y el importe mínimo los devuelve la API; el navegador se limita a validar los
 * datos que introduce la persona usuaria y a dar formato español a las cifras
 * que llegan ya calculadas.
 */
(function () {
    'use strict';

    // URL base de la API del agente de Aplidec.
    // Pasará a ser 'https://agente.aplidec.com' cuando exista el subdominio.
    var API = 'https://phonica-aplidec-agent.ten8bl.easypanel.host';

    // Tiempo máximo de espera de cada llamada (AbortController).
    var TIEMPO_MAXIMO_MS = 8000;

    // Límites de cordura del formulario (no son reglas de precio: solo evitan
    // enviar disparates a la API).
    var SUPERFICIE_MAXIMA = 100000;
    var MANOS_MINIMAS = 1;
    var MANOS_MAXIMAS = 10;
    var MENSAJE_MAXIMO = 1000;

    var TELEFONO_APLIDEC = '630 974 876';

    /* ------------------------------------------------------------------ */
    /* Mensajes                                                            */
    /* ------------------------------------------------------------------ */

    // Cada código de error de la API tiene aquí su frase en español.
    // Nunca se muestra un código en pantalla.
    var MENSAJES_ERROR = {
        // POST /api/presupuesto
        producto_inactivo: 'El trabajo que has elegido ya no está disponible. Selecciona otro de la lista o vuelve a cargar la página.',
        estado_desconocido: 'El estado del soporte que has elegido no es válido. Vuelve a seleccionarlo, por favor.',
        superficie_invalida: 'La superficie no es válida. Escribe los metros cuadrados como un número mayor que cero.',
        manos_invalidas: 'El número de manos no es válido. Indica un número entero de una mano o más.',
        precio_no_configurado: 'Todavía no tenemos tarifa cargada para este trabajo. Cuéntanoslo y te preparamos un presupuesto a medida.',
        factor_invalido: 'No hemos podido valorar el estado del soporte indicado. Prueba con otra opción o escríbenos.',
        ajustes_invalidos: 'La calculadora no está bien configurada en este momento. Escríbenos y te damos precio sin compromiso.',
        peticion_invalida: 'Falta algún dato o alguno no tiene el formato esperado. Revisa el formulario, por favor.',
        // POST /api/lead
        nombre_invalido: 'Escribe tu nombre para que sepamos cómo dirigirnos a ti.',
        sin_contacto: 'Necesitamos al menos un email o un teléfono para poder responderte.',
        email_invalido: 'El email no parece correcto. Revísalo, por favor.',
        telefono_invalido: 'El teléfono no parece correcto. Revísalo, por favor.',
        mensaje_largo: 'El mensaje es demasiado largo. Resúmelo un poco, por favor.',
        demasiadas_peticiones: 'Has hecho muchos envíos seguidos.',
        no_disponible: 'El servicio no está disponible en este momento. Vuelve a intentarlo en unos minutos o llámanos al ' + TELEFONO_APLIDEC + '.'
    };

    var MENSAJE_GENERICO = 'No hemos podido completar la operación. Inténtalo de nuevo en unos minutos o llámanos al ' + TELEFONO_APLIDEC + '.';
    var MENSAJE_RED = 'No hemos podido conectar con nuestro servidor. Comprueba tu conexión e inténtalo de nuevo, o llámanos al ' + TELEFONO_APLIDEC + '.';

    // Traduce un código de error de la API a una frase en español.
    // Un código desconocido cae siempre en la frase genérica.
    function mensajeDeError(codigo, reintentarEn) {
        var texto = (codigo && Object.prototype.hasOwnProperty.call(MENSAJES_ERROR, codigo))
            ? MENSAJES_ERROR[codigo]
            : MENSAJE_GENERICO;

        if (codigo === 'demasiadas_peticiones') {
            if (typeof reintentarEn === 'number' && isFinite(reintentarEn) && reintentarEn > 0) {
                texto += ' Espera ' + segundosLegibles(reintentarEn) + ' e inténtalo de nuevo.';
            } else {
                texto += ' Espera unos segundos e inténtalo de nuevo.';
            }
        }
        return texto;
    }

    function segundosLegibles(valor) {
        var entero = Math.round(valor);
        return entero === 1 ? '1 segundo' : entero + ' segundos';
    }

    // Etiquetas en español para las categorías que llegan de la API.
    var ETIQUETAS_CATEGORIA = {
        interior: 'Interior',
        exterior: 'Exterior',
        acabados: 'Acabados',
        impermeabilizacion: 'Impermeabilización',
        reformas: 'Reformas',
        otros: 'Otros trabajos'
    };

    function etiquetaCategoria(clave) {
        if (!clave) return 'Otros trabajos';
        var normal = String(clave).toLowerCase();
        if (Object.prototype.hasOwnProperty.call(ETIQUETAS_CATEGORIA, normal)) {
            return ETIQUETAS_CATEGORIA[normal];
        }
        var legible = String(clave).replace(/[_-]+/g, ' ').trim();
        return legible.charAt(0).toUpperCase() + legible.slice(1);
    }

    /* ------------------------------------------------------------------ */
    /* Formato (solo presentación: aquí no se calcula nada)                */
    /* ------------------------------------------------------------------ */

    // Convierte un importe que YA viene calculado de la API al formato español
    // (miles con punto, decimales con coma). Solo manipula la cadena de texto.
    function formatearImporte(valor) {
        if (typeof valor !== 'number' || !isFinite(valor)) return null;
        var texto = valor.toFixed(2);          // representación con dos decimales
        var signo = '';
        if (texto.charAt(0) === '-') {
            signo = '-';
            texto = texto.slice(1);
        }
        var trozos = texto.split('.');
        var entera = trozos[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return signo + entera + ',' + trozos[1];
    }

    // Rango «2.500,00 – 5.000,00 €» tal cual lo devuelve la API.
    function formatearRango(minimo, maximo) {
        var a = formatearImporte(minimo);
        var b = formatearImporte(maximo);
        if (a === null || b === null) return null;
        return a === b ? a + ' €' : a + ' – ' + b + ' €';
    }

    // Superficie en formato español (no es dinero, solo la cifra que se tecleó).
    function formatearSuperficie(valor) {
        var texto = String(valor);
        if (texto.indexOf('.') === -1) return texto;
        return texto.replace('.', ',');
    }

    // Porcentaje de IVA a partir del tipo que devuelve la API (0.21 -> «21 %»).
    // La conversión la hace Intl, no nosotros.
    function formatearPorcentaje(tipo) {
        if (typeof tipo !== 'number' || !isFinite(tipo)) return null;
        try {
            return new Intl.NumberFormat('es-ES', {
                style: 'percent',
                maximumFractionDigits: 2
            }).format(tipo);
        } catch (e) {
            return null;
        }
    }

    function etiquetaUnidad(unidad) {
        if (unidad === 'm2') return 'm²';
        if (unidad === 'ml') return 'ml';
        return unidad || 'm²';
    }

    /* ------------------------------------------------------------------ */
    /* Llamadas a la API                                                   */
    /* ------------------------------------------------------------------ */

    // Devuelve { estado, datos } o lanza un Error con .tipo = 'red' | 'tiempo'.
    function pedir(ruta, opciones) {
        var control = new AbortController();
        var temporizador = setTimeout(function () { control.abort(); }, TIEMPO_MAXIMO_MS);

        var configuracion = {
            mode: 'cors',
            credentials: 'omit',
            signal: control.signal,
            headers: { 'Accept': 'application/json' }
        };

        if (opciones && opciones.cuerpo) {
            configuracion.method = 'POST';
            configuracion.headers['Content-Type'] = 'application/json';
            configuracion.body = JSON.stringify(opciones.cuerpo);
        }

        return fetch(API + ruta, configuracion).then(function (respuesta) {
            clearTimeout(temporizador);
            return respuesta.json().catch(function () { return null; }).then(function (datos) {
                return { estado: respuesta.status, datos: datos };
            });
        }).catch(function (error) {
            clearTimeout(temporizador);
            var fallo = new Error('No se ha podido contactar con la API');
            fallo.tipo = (error && error.name === 'AbortError') ? 'tiempo' : 'red';
            throw fallo;
        });
    }

    /* ------------------------------------------------------------------ */
    /* Estado de la página                                                 */
    /* ------------------------------------------------------------------ */

    var catalogo = null;        // respuesta de /api/catalogo
    var ultimaPeticion = null;  // datos que se enviaron a /api/presupuesto
    var manosTocadas = false;   // ¿ha cambiado la persona el número de manos?

    var el = {};

    function recogerElementos() {
        var ids = [
            'anuncio',
            'panel-cargando', 'panel-no-disponible', 'panel-formulario',
            'panel-resultado', 'panel-gracias',
            'texto-no-disponible',
            'form-presupuesto', 'producto', 'producto-detalle', 'superficie',
            'estado-soporte', 'manos', 'boton-calcular',
            'error-producto', 'error-superficie', 'error-estado', 'error-manos',
            'error-calculo',
            'resultado-titulo', 'resultado-rango', 'resultado-iva',
            'resultado-resumen', 'resultado-legal', 'boton-cambiar',
            'form-lead', 'lead-nombre', 'lead-email', 'lead-telefono',
            'lead-mensaje', 'empresa', 'boton-enviar-lead',
            'error-lead-nombre', 'error-lead-contacto', 'error-lead-mensaje',
            'error-lead', 'gracias-titulo'
        ];
        ids.forEach(function (id) {
            el[id] = document.getElementById(id);
        });
    }

    function mostrarPanel(nombre) {
        ['panel-cargando', 'panel-no-disponible', 'panel-formulario', 'panel-resultado', 'panel-gracias']
            .forEach(function (id) {
                if (!el[id]) return;
                if (id === nombre) {
                    el[id].removeAttribute('hidden');
                } else {
                    el[id].setAttribute('hidden', '');
                }
            });
    }

    // Región viva permanente: lo que se escriba aquí lo lee el lector de pantalla.
    function anunciar(texto) {
        if (el['anuncio']) el['anuncio'].textContent = texto;
    }

    function llevarFoco(elemento) {
        if (!elemento) return;
        elemento.focus();
        if (typeof elemento.scrollIntoView === 'function') {
            elemento.scrollIntoView({ block: 'center' });
        }
    }

    function ponerError(contenedor, campo, texto) {
        if (contenedor) contenedor.textContent = texto || '';
        if (campo) {
            if (texto) {
                campo.setAttribute('aria-invalid', 'true');
            } else {
                campo.removeAttribute('aria-invalid');
            }
        }
    }

    function limpiarErroresPresupuesto() {
        ponerError(el['error-producto'], el['producto'], '');
        ponerError(el['error-superficie'], el['superficie'], '');
        ponerError(el['error-estado'], null, '');
        ponerError(el['error-manos'], el['manos'], '');
        if (el['error-calculo']) el['error-calculo'].textContent = '';
    }

    function limpiarErroresLead() {
        ponerError(el['error-lead-nombre'], el['lead-nombre'], '');
        ponerError(el['error-lead-contacto'], null, '');
        ponerError(el['error-lead-mensaje'], el['lead-mensaje'], '');
        if (el['error-lead']) el['error-lead'].textContent = '';
        if (el['lead-email']) el['lead-email'].removeAttribute('aria-invalid');
        if (el['lead-telefono']) el['lead-telefono'].removeAttribute('aria-invalid');
    }

    /* ------------------------------------------------------------------ */
    /* Degradación amable                                                  */
    /* ------------------------------------------------------------------ */

    function mostrarNoDisponible(motivo) {
        if (el['texto-no-disponible']) {
            el['texto-no-disponible'].textContent = motivo;
        }
        mostrarPanel('panel-no-disponible');
        anunciar('La calculadora no está disponible ahora mismo. ' + motivo);
    }

    var MOTIVO_VACIO = 'Estamos terminando de cargar nuestras tarifas, así que la calculadora todavía no puede darte una cifra. Cuéntanos qué necesitas y te preparamos un presupuesto sin compromiso.';
    var MOTIVO_CAIDA = 'Ahora mismo no podemos cargar la calculadora. No te quedes sin presupuesto: escríbenos o llámanos y lo valoramos contigo.';

    /* ------------------------------------------------------------------ */
    /* Carga del catálogo                                                  */
    /* ------------------------------------------------------------------ */

    function cargarCatalogo() {
        mostrarPanel('panel-cargando');

        pedir('/api/catalogo').then(function (respuesta) {
            if (respuesta.estado !== 200 || !respuesta.datos) {
                mostrarNoDisponible(MOTIVO_CAIDA);
                return;
            }
            var datos = respuesta.datos;
            var productos = Array.isArray(datos.productos) ? datos.productos : [];
            var factores = Array.isArray(datos.factores) ? datos.factores : [];

            if (productos.length === 0 || factores.length === 0) {
                mostrarNoDisponible(MOTIVO_VACIO);
                return;
            }

            catalogo = {
                productos: productos,
                factores: factores,
                ajustes: datos.ajustes && typeof datos.ajustes === 'object' ? datos.ajustes : {}
            };

            pintarProductos(productos);
            pintarFactores(factores);
            mostrarPanel('panel-formulario');
            anunciar('Calculadora lista. Rellena el formulario para ver tu presupuesto orientativo.');
        }).catch(function () {
            mostrarNoDisponible(MOTIVO_CAIDA);
        });
    }

    function pintarProductos(productos) {
        var select = el['producto'];
        if (!select) return;
        select.innerHTML = '';

        var vacio = document.createElement('option');
        vacio.value = '';
        vacio.textContent = 'Elige un trabajo…';
        select.appendChild(vacio);

        // Agrupa por categoría respetando el orden en que llegan.
        var orden = [];
        var grupos = {};
        productos.forEach(function (producto) {
            var clave = producto.categoria || 'otros';
            if (!grupos[clave]) {
                grupos[clave] = [];
                orden.push(clave);
            }
            grupos[clave].push(producto);
        });

        orden.forEach(function (clave) {
            var grupo = document.createElement('optgroup');
            grupo.label = etiquetaCategoria(clave);
            grupos[clave].forEach(function (producto) {
                var opcion = document.createElement('option');
                opcion.value = String(producto.id);
                opcion.textContent = producto.nombre;
                grupo.appendChild(opcion);
            });
            select.appendChild(grupo);
        });
    }

    function pintarFactores(factores) {
        var contenedor = el['estado-soporte'];
        if (!contenedor) return;
        contenedor.innerHTML = '';

        factores.forEach(function (factor, indice) {
            var id = 'estado-' + indice;

            var fila = document.createElement('div');
            fila.className = 'opcion-radio';

            var radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'estado_soporte';
            radio.id = id;
            radio.value = factor.clave;

            var etiqueta = document.createElement('label');
            etiqueta.setAttribute('for', id);
            etiqueta.textContent = factor.etiqueta || factor.clave;

            fila.appendChild(radio);
            fila.appendChild(etiqueta);
            contenedor.appendChild(fila);
        });
    }

    function productoPorId(id) {
        if (!catalogo) return null;
        var encontrado = null;
        catalogo.productos.forEach(function (producto) {
            if (String(producto.id) === String(id)) encontrado = producto;
        });
        return encontrado;
    }

    function factorPorClave(clave) {
        if (!catalogo) return null;
        var encontrado = null;
        catalogo.factores.forEach(function (factor) {
            if (factor.clave === clave) encontrado = factor;
        });
        return encontrado;
    }

    // Al elegir un trabajo se muestra su descripción y, si la persona todavía no
    // ha tocado el campo, se propone el número de manos que incluye la tarifa.
    function alCambiarProducto() {
        var producto = productoPorId(el['producto'].value);
        var detalle = el['producto-detalle'];
        if (!detalle) return;

        if (!producto) {
            detalle.textContent = '';
            detalle.setAttribute('hidden', '');
            return;
        }

        var partes = [];
        if (producto.descripcion) partes.push(producto.descripcion);
        if (typeof producto.manos_incluidas === 'number' && producto.manos_incluidas > 0) {
            partes.push('Nuestra referencia para este trabajo incluye ' +
                producto.manos_incluidas + (producto.manos_incluidas === 1 ? ' mano.' : ' manos.'));
            if (!manosTocadas && el['manos']) {
                el['manos'].value = String(producto.manos_incluidas);
            }
        }
        detalle.textContent = partes.join(' ');
        detalle.removeAttribute('hidden');
    }

    /* ------------------------------------------------------------------ */
    /* Validación del formulario de presupuesto                            */
    /* ------------------------------------------------------------------ */

    // Acepta «12,5» y «12.5». Devuelve el número o null si no vale.
    function parsearSuperficie(texto) {
        var limpio = String(texto == null ? '' : texto).trim().replace(/\s+/g, '').replace(',', '.');
        if (limpio === '') return null;
        if (!/^\d+(\.\d{1,3})?$/.test(limpio)) return null;
        var numero = Number(limpio);
        if (!isFinite(numero) || numero <= 0 || numero > SUPERFICIE_MAXIMA) return null;
        return numero;
    }

    function estadoSeleccionado() {
        var marcado = document.querySelector('input[name="estado_soporte"]:checked');
        return marcado ? marcado.value : '';
    }

    function validarPresupuesto() {
        limpiarErroresPresupuesto();

        var errores = [];
        var valores = {};

        // Producto
        var idProducto = el['producto'] ? el['producto'].value : '';
        var producto = productoPorId(idProducto);
        if (!producto) {
            ponerError(el['error-producto'], el['producto'], 'Elige el trabajo que quieres presupuestar.');
            errores.push(el['producto']);
        } else {
            valores.producto_id = parseInt(producto.id, 10);
        }

        // Superficie
        var textoSuperficie = el['superficie'] ? el['superficie'].value : '';
        if (String(textoSuperficie).trim() === '') {
            ponerError(el['error-superficie'], el['superficie'], 'Indica cuántos metros cuadrados hay que tratar.');
            errores.push(el['superficie']);
        } else {
            var superficie = parsearSuperficie(textoSuperficie);
            if (superficie === null) {
                ponerError(el['error-superficie'], el['superficie'],
                    'Escribe la superficie como un número mayor que cero, con coma o punto para los decimales (por ejemplo, 85,5).');
                errores.push(el['superficie']);
            } else {
                valores.superficie = superficie;
            }
        }

        // Estado del soporte
        var estado = estadoSeleccionado();
        if (!estado || !factorPorClave(estado)) {
            ponerError(el['error-estado'], null, 'Indica en qué estado está el soporte.');
            var primerRadio = document.querySelector('input[name="estado_soporte"]');
            if (primerRadio) errores.push(primerRadio);
        } else {
            valores.estado_soporte = estado;
        }

        // Manos
        var campoManos = el['manos'];
        var textoManos = campoManos ? String(campoManos.value).trim() : '';
        var malFormado = campoManos && campoManos.validity && campoManos.validity.badInput;
        if (textoManos === '' && !malFormado) {
            ponerError(el['error-manos'], campoManos, 'Indica cuántas manos hay que dar.');
            errores.push(campoManos);
        } else if (malFormado || !/^\d+$/.test(textoManos)) {
            ponerError(el['error-manos'], campoManos, 'Las manos se cuentan de una en una: escribe un número entero (no existe media mano).');
            errores.push(campoManos);
        } else {
            var manos = parseInt(textoManos, 10);
            if (manos < MANOS_MINIMAS || manos > MANOS_MAXIMAS) {
                ponerError(el['error-manos'], campoManos,
                    'Indica entre ' + MANOS_MINIMAS + ' y ' + MANOS_MAXIMAS + ' manos. Si necesitas más, cuéntanoslo y lo valoramos.');
                errores.push(campoManos);
            } else {
                valores.manos = manos;
            }
        }

        if (errores.length > 0) {
            llevarFoco(errores[0]);
            return null;
        }
        return valores;
    }

    /* ------------------------------------------------------------------ */
    /* Cálculo (lo hace la API) y pintado del resultado                    */
    /* ------------------------------------------------------------------ */

    function enviarPresupuesto(evento) {
        evento.preventDefault();

        var datos = validarPresupuesto();
        if (!datos) return;

        var boton = el['boton-calcular'];
        var textoOriginal = boton ? boton.textContent : '';
        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Calculando…';
        }

        pedir('/api/presupuesto', { cuerpo: datos }).then(function (respuesta) {
            if (boton) {
                boton.disabled = false;
                boton.textContent = textoOriginal;
            }

            if (respuesta.estado === 200 && respuesta.datos) {
                ultimaPeticion = datos;
                pintarResultado(respuesta.datos, datos);
                return;
            }

            var codigo = respuesta.datos && respuesta.datos.error;
            var reintentar = respuesta.datos && respuesta.datos.retryAfter;
            if (respuesta.estado === 503 && !codigo) codigo = 'no_disponible';
            if (respuesta.estado === 429 && !codigo) codigo = 'demasiadas_peticiones';
            mostrarErrorCalculo(mensajeDeError(codigo, reintentar));
        }).catch(function (fallo) {
            if (boton) {
                boton.disabled = false;
                boton.textContent = textoOriginal;
            }
            mostrarErrorCalculo(fallo && fallo.tipo === 'tiempo'
                ? 'La calculadora ha tardado demasiado en responder. Inténtalo de nuevo o llámanos al ' + TELEFONO_APLIDEC + '.'
                : MENSAJE_RED);
        });
    }

    function mostrarErrorCalculo(texto) {
        if (!el['error-calculo']) return;
        el['error-calculo'].textContent = texto;
        llevarFoco(el['error-calculo']);
    }

    function pintarResultado(respuesta, peticion) {
        // Rango sin IVA. Todos los importes llegan ya calculados de la API.
        var rango = formatearRango(respuesta.total_min, respuesta.total_max);
        var rangoIva = formatearRango(respuesta.total_min_iva, respuesta.total_max_iva);

        if (rango === null && rangoIva === null) {
            mostrarErrorCalculo(MENSAJE_GENERICO);
            return;
        }

        el['resultado-rango'].textContent = rango !== null ? rango : rangoIva;

        var lineas = [];
        if (rango !== null) lineas.push('Importe sin IVA.');
        if (rangoIva !== null) {
            var porcentaje = catalogo && catalogo.ajustes ? formatearPorcentaje(catalogo.ajustes.iva) : null;
            lineas.push(porcentaje
                ? 'Con IVA (' + porcentaje + ') incluido: ' + rangoIva
                : 'Con IVA incluido: ' + rangoIva);
        }
        el['resultado-iva'].textContent = lineas.join(' ');

        // Resumen en una línea de lo que se ha pedido.
        var producto = productoPorId(peticion.producto_id);
        var factor = factorPorClave(peticion.estado_soporte);
        var unidad = etiquetaUnidad(respuesta.unidad || (producto && producto.unidad));
        var resumen = [
            producto ? producto.nombre : 'Trabajo seleccionado',
            formatearSuperficie(peticion.superficie) + ' ' + unidad,
            factor ? factor.etiqueta : peticion.estado_soporte,
            peticion.manos === 1 ? '1 mano' : peticion.manos + ' manos'
        ].join(' · ');
        el['resultado-resumen'].textContent = resumen;

        // Texto legal tal cual lo devuelve la API.
        if (typeof respuesta.texto_legal === 'string' && respuesta.texto_legal !== '') {
            el['resultado-legal'].textContent = respuesta.texto_legal;
            el['resultado-legal'].removeAttribute('hidden');
        } else {
            el['resultado-legal'].textContent = '';
            el['resultado-legal'].setAttribute('hidden', '');
        }

        limpiarErroresLead();
        mostrarPanel('panel-resultado');
        anunciar('Presupuesto orientativo calculado: ' + el['resultado-rango'].textContent + '.');
        llevarFoco(el['resultado-titulo']);
    }

    function volverAlFormulario() {
        // Los valores del formulario no se tocan: siguen tal cual estaban.
        mostrarPanel('panel-formulario');
        anunciar('Vuelves al formulario con los datos que ya habías puesto.');
        llevarFoco(el['producto']);
    }

    /* ------------------------------------------------------------------ */
    /* Formulario de contacto (lead)                                       */
    /* ------------------------------------------------------------------ */

    function pareceEmail(texto) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto);
    }

    function pareceTelefono(texto) {
        var soloDigitos = texto.replace(/[\s().+-]/g, '');
        return /^\d{9,15}$/.test(soloDigitos);
    }

    function enviarLead(evento) {
        evento.preventDefault();
        limpiarErroresLead();

        if (!ultimaPeticion) {
            if (el['error-lead']) {
                el['error-lead'].textContent = 'Vuelve a calcular el presupuesto antes de enviarnos tus datos.';
            }
            return;
        }

        var errores = [];

        var nombre = el['lead-nombre'] ? el['lead-nombre'].value.trim() : '';
        if (nombre === '') {
            ponerError(el['error-lead-nombre'], el['lead-nombre'], 'Escribe tu nombre para que sepamos cómo dirigirnos a ti.');
            errores.push(el['lead-nombre']);
        }

        var email = el['lead-email'] ? el['lead-email'].value.trim() : '';
        var telefono = el['lead-telefono'] ? el['lead-telefono'].value.trim() : '';

        if (email === '' && telefono === '') {
            ponerError(el['error-lead-contacto'], null, 'Déjanos al menos un email o un teléfono para poder responderte.');
            if (el['lead-email']) {
                el['lead-email'].setAttribute('aria-invalid', 'true');
                errores.push(el['lead-email']);
            }
            if (el['lead-telefono']) el['lead-telefono'].setAttribute('aria-invalid', 'true');
        } else {
            if (email !== '' && !pareceEmail(email)) {
                ponerError(el['error-lead-contacto'], el['lead-email'], 'El email no parece correcto. Revísalo, por favor.');
                errores.push(el['lead-email']);
            } else if (telefono !== '' && !pareceTelefono(telefono)) {
                ponerError(el['error-lead-contacto'], el['lead-telefono'], 'El teléfono no parece correcto: escribe entre 9 y 15 cifras.');
                errores.push(el['lead-telefono']);
            }
        }

        var mensaje = el['lead-mensaje'] ? el['lead-mensaje'].value.trim() : '';
        if (mensaje.length > MENSAJE_MAXIMO) {
            ponerError(el['error-lead-mensaje'], el['lead-mensaje'],
                'El mensaje es demasiado largo: no puede pasar de ' + MENSAJE_MAXIMO + ' caracteres.');
            errores.push(el['lead-mensaje']);
        }

        if (errores.length > 0) {
            llevarFoco(errores[0]);
            return;
        }

        // Se envían solo los datos de la consulta, nunca los importes.
        var cuerpo = {
            nombre: nombre,
            empresa: el['empresa'] ? el['empresa'].value : '',
            presupuesto: {
                producto_id: ultimaPeticion.producto_id,
                superficie: ultimaPeticion.superficie,
                estado_soporte: ultimaPeticion.estado_soporte,
                manos: ultimaPeticion.manos
            }
        };
        if (email !== '') cuerpo.email = email;
        if (telefono !== '') cuerpo.telefono = telefono;
        if (mensaje !== '') cuerpo.mensaje = mensaje;

        var boton = el['boton-enviar-lead'];
        var textoOriginal = boton ? boton.textContent : '';
        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Enviando…';
        }

        pedir('/api/lead', { cuerpo: cuerpo }).then(function (respuesta) {
            if (boton) {
                boton.disabled = false;
                boton.textContent = textoOriginal;
            }

            if (respuesta.estado === 200 && respuesta.datos && respuesta.datos.ok === true) {
                if (el['form-lead']) el['form-lead'].reset();
                mostrarPanel('panel-gracias');
                anunciar('Solicitud enviada correctamente.');
                llevarFoco(el['gracias-titulo']);
                return;
            }

            var codigo = respuesta.datos && respuesta.datos.error;
            var reintentar = respuesta.datos && respuesta.datos.retryAfter;
            if (respuesta.estado === 503 && !codigo) codigo = 'no_disponible';
            if (respuesta.estado === 429 && !codigo) codigo = 'demasiadas_peticiones';
            if (el['error-lead']) {
                el['error-lead'].textContent = mensajeDeError(codigo, reintentar);
                llevarFoco(el['error-lead']);
            }
        }).catch(function (fallo) {
            if (boton) {
                boton.disabled = false;
                boton.textContent = textoOriginal;
            }
            if (el['error-lead']) {
                el['error-lead'].textContent = fallo && fallo.tipo === 'tiempo'
                    ? 'El envío ha tardado demasiado. Inténtalo de nuevo o llámanos al ' + TELEFONO_APLIDEC + '.'
                    : MENSAJE_RED;
                llevarFoco(el['error-lead']);
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Arranque                                                            */
    /* ------------------------------------------------------------------ */

    function iniciar() {
        if (!document.getElementById('presupuesto-app')) return;
        recogerElementos();

        if (el['producto']) {
            el['producto'].addEventListener('change', alCambiarProducto);
        }
        if (el['manos']) {
            el['manos'].addEventListener('input', function () { manosTocadas = true; });
        }
        if (el['form-presupuesto']) {
            el['form-presupuesto'].addEventListener('submit', enviarPresupuesto);
        }
        if (el['boton-cambiar']) {
            el['boton-cambiar'].addEventListener('click', volverAlFormulario);
        }
        if (el['form-lead']) {
            el['form-lead'].addEventListener('submit', enviarLead);
        }

        cargarCatalogo();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
