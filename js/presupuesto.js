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

    // Límites del formulario. Son EXACTAMENTE los que aplica la API
    // (`TOPE_SUPERFICIE`, `TOPE_MANOS` y los topes por campo de `/api/lead`), y
    // esa igualdad no es cosmética: si la web fuera más permisiva, dejaría
    // teclear algo que el servidor va a rechazar después, con un mensaje que ya
    // no puede señalar el campo; si fuera más estricta, le prohibiría al
    // visitante algo que sí se puede pedir. Al cambiar un tope allí, hay que
    // cambiarlo aquí.
    var SUPERFICIE_MAXIMA = 10000;
    var MANOS_MINIMAS = 1;
    var MANOS_MAXIMAS = 20;
    var MENSAJE_MAXIMO = 500;
    var NOMBRE_MAXIMO = 80;

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
        superficie_invalida: 'La cantidad indicada no es válida. Escríbela como un número mayor que cero.',
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
        mensaje_largo: 'El mensaje es demasiado largo: no puede pasar de ' + MENSAJE_MAXIMO + ' caracteres.',
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
                texto += ' Espera ' + esperaLegible(reintentarEn) + ' e inténtalo de nuevo.';
            } else {
                texto += ' Espera unos segundos e inténtalo de nuevo.';
            }
        }
        return texto;
    }

    // La API cuenta la espera en segundos y el tope por hora llega a devolver
    // 3.600: «espera 3.540 segundos» obliga a dividir mentalmente a quien ya
    // está molesto. Se dice en la unidad en que la gente mide el tiempo, y en
    // aproximado, porque el segundo exacto no le sirve a nadie para nada.
    function esperaLegible(valor) {
        var segundos = Math.max(1, Math.round(valor));
        if (segundos < 60) {
            return segundos === 1 ? '1 segundo' : segundos + ' segundos';
        }
        var minutos = Math.round(segundos / 60);
        if (minutos < 60) {
            return minutos === 1 ? 'un minuto' : 'unos ' + minutos + ' minutos';
        }
        var horas = Math.round(minutos / 60);
        return horas === 1 ? 'una hora' : 'unas ' + horas + ' horas';
    }

    // Etiquetas en español para las categorías que llegan de la API. Las claves
    // son las que de verdad manda el servidor (`CATEGORIAS` en su panel:
    // interior, exterior y acabado, en singular), no las que uno diría: una
    // clave mal escrita aquí no rompe nada, se cae al respaldo de abajo y el
    // grupo aparece titulado «Acabado» sin que nadie se entere.
    var ETIQUETAS_CATEGORIA = {
        interior: 'Interior',
        exterior: 'Exterior',
        acabado: 'Acabados',
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
        return signo + formatearMiles(trozos[0]) + ',' + trozos[1];
    }

    // Rango «2.500,00 – 5.000,00 €» tal cual lo devuelve la API.
    function formatearRango(minimo, maximo) {
        var a = formatearImporte(minimo);
        var b = formatearImporte(maximo);
        if (a === null || b === null) return null;
        return a === b ? a + ' €' : a + ' – ' + b + ' €';
    }

    // La cantidad que se tecleó, escrita en español: miles con punto y decimales
    // con coma. No es dinero y aquí no se calcula nada; se reescribe la cifra.
    function formatearSuperficie(valor) {
        var trozos = String(valor).split('.');
        var entera = formatearMiles(trozos[0]);
        return trozos.length > 1 ? entera + ',' + trozos[1] : entera;
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

    // Miles con punto, como se escriben en español. No es dinero: es el tope del
    // formulario, que se enseña dentro de una frase para que diga la cifra de
    // verdad en lugar de un «demasiado grande» que no orienta.
    function formatearMiles(entero) {
        return String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    /* ------------------------------------------------------------------ */
    /* Unidades                                                            */
    /* ------------------------------------------------------------------ */

    // Cada producto del catálogo trae su unidad y el panel deja elegir entre m²,
    // metros lineales y unidades. Hoy Aplidec solo vende m² y por eso no se
    // nota, pero preguntar «cuántos metros cuadrados» para presupuestar seis
    // puertas lacadas es preguntar mal, y aceptar «2,5» puertas es peor. De aquí
    // sale TODO lo que la web dice sobre la cantidad: el rótulo del campo, el
    // ejemplo, la ayuda, el teclado del móvil, si admite decimales, los dos
    // errores propios y cómo se lee luego en el resumen.
    var UNIDADES = {
        m2: {
            simbolo: 'm²',
            etiqueta: 'Superficie a tratar, en metros cuadrados (m²)',
            ejemplo: 'Por ejemplo: 85,5',
            ayuda: 'Puedes usar coma o punto para los decimales.',
            teclado: 'decimal',
            decimales: true,
            queFalta: 'Indica cuántos metros cuadrados hay que tratar.',
            malEscrito: 'Escribe la superficie como un número mayor que cero, con coma o punto para los decimales (por ejemplo, 85,5).',
            resumenSingular: 'm²',
            resumenPlural: 'm²'
        },
        ml: {
            simbolo: 'ml',
            etiqueta: 'Longitud a tratar, en metros lineales (ml)',
            ejemplo: 'Por ejemplo: 24,5',
            ayuda: 'Puedes usar coma o punto para los decimales.',
            teclado: 'decimal',
            decimales: true,
            queFalta: 'Indica cuántos metros lineales hay que tratar.',
            malEscrito: 'Escribe la longitud como un número mayor que cero, con coma o punto para los decimales (por ejemplo, 24,5).',
            resumenSingular: 'metro lineal',
            resumenPlural: 'metros lineales'
        },
        ud: {
            simbolo: 'ud',
            etiqueta: '¿Cuántas unidades hay que tratar?',
            ejemplo: 'Por ejemplo: 6',
            ayuda: 'Número entero de unidades: media puerta no se laca.',
            teclado: 'numeric',
            decimales: false,
            queFalta: 'Indica cuántas unidades hay que tratar.',
            malEscrito: 'Escribe cuántas unidades son, con un número entero mayor que cero (por ejemplo, 6).',
            resumenSingular: 'unidad',
            resumenPlural: 'unidades'
        }
    };

    var UNIDAD_POR_DEFECTO = 'm2';

    // Una unidad que no está en la tabla se pregunta en genérico y se enseña
    // tal cual llega. Es feo, pero mucho menos que llamar «metros cuadrados» a
    // algo que Aplidec acaba de dar de alta y que no lo es.
    function unidadDe(clave) {
        var normal = String(clave == null ? '' : clave).trim().toLowerCase();
        if (normal === '') return UNIDADES[UNIDAD_POR_DEFECTO];
        if (Object.prototype.hasOwnProperty.call(UNIDADES, normal)) return UNIDADES[normal];
        return {
            simbolo: normal,
            etiqueta: 'Cantidad a tratar, en ' + normal,
            ejemplo: '',
            ayuda: 'Puedes usar coma o punto para los decimales.',
            teclado: 'decimal',
            decimales: true,
            queFalta: 'Indica qué cantidad hay que tratar.',
            malEscrito: 'Escribe la cantidad como un número mayor que cero.',
            resumenSingular: normal,
            resumenPlural: normal
        };
    }

    // «85,5 m²», «24,5 metros lineales», «6 unidades», «1 unidad».
    function cantidadConUnidad(valor, unidad) {
        var etiqueta = valor === 1 ? unidad.resumenSingular : unidad.resumenPlural;
        return formatearSuperficie(valor) + ' ' + etiqueta;
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
            'etiqueta-superficie', 'ayuda-superficie',
            'estado-soporte', 'manos', 'ayuda-manos', 'boton-calcular',
            'error-producto', 'error-superficie', 'error-estado', 'error-manos',
            'error-calculo',
            'resultado-titulo', 'resultado-rango', 'resultado-iva',
            'resultado-resumen', 'resultado-legal', 'boton-cambiar',
            'form-lead', 'lead-nombre', 'lead-email', 'lead-telefono',
            'lead-mensaje', 'no-rellenar-1', 'no-rellenar-2', 'boton-enviar-lead',
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

    /* ------------------------------------------------------------------ */
    /* Topes y unidad: el formulario se escribe desde las constantes        */
    /* ------------------------------------------------------------------ */

    // Los atributos del HTML se ponen desde aquí, y no a mano en la página, para
    // que no puedan volver a decir un máximo distinto del que comprueba la
    // validación de más abajo. El HTML lleva los mismos valores escritos, que es
    // lo que se ve si esta función no llega a correr.
    function aplicarLimites() {
        if (el['manos']) {
            el['manos'].setAttribute('min', String(MANOS_MINIMAS));
            el['manos'].setAttribute('max', String(MANOS_MAXIMAS));
        }
        if (el['ayuda-manos']) {
            el['ayuda-manos'].textContent = 'Número entero, de ' + MANOS_MINIMAS + ' a ' +
                MANOS_MAXIMAS + ': no existe media mano.';
        }
        // Sin esto, el visitante escribe un nombre de 100 letras, lo envía, y la
        // API le contesta con el mismo código que si lo hubiera dejado vacío:
        // «escribe tu nombre», delante de un nombre escrito.
        if (el['lead-nombre']) el['lead-nombre'].setAttribute('maxlength', String(NOMBRE_MAXIMO));
        if (el['lead-mensaje']) el['lead-mensaje'].setAttribute('maxlength', String(MENSAJE_MAXIMO));
    }

    // Deja el campo de la cantidad preguntando en la unidad del trabajo elegido.
    // `step` no pinta nada aquí: el campo es de texto a propósito, para poder
    // aceptar la coma decimal española, y quien impide media puerta es
    // `parsearCantidad`. Lo que sí cambia es el teclado que sale en el móvil.
    function aplicarUnidad(unidad) {
        if (el['etiqueta-superficie']) {
            el['etiqueta-superficie'].textContent = unidad.etiqueta + ' *';
        }
        if (el['ayuda-superficie']) {
            el['ayuda-superficie'].textContent = unidad.ayuda;
        }
        var campo = el['superficie'];
        if (!campo) return;
        campo.setAttribute('inputmode', unidad.teclado);
        if (unidad.ejemplo) {
            campo.setAttribute('placeholder', unidad.ejemplo);
        } else {
            campo.removeAttribute('placeholder');
        }
    }

    // La unidad del trabajo que hay elegido ahora mismo.
    function unidadActual() {
        var producto = productoPorId(el['producto'] ? el['producto'].value : '');
        return unidadDe(producto ? producto.unidad : '');
    }

    // Al elegir un trabajo se muestra su descripción y, si la persona todavía no
    // ha tocado el campo, se propone el número de manos que incluye la tarifa.
    function alCambiarProducto() {
        var producto = productoPorId(el['producto'].value);
        var detalle = el['producto-detalle'];

        aplicarUnidad(unidadDe(producto ? producto.unidad : ''));

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
            // Solo se propone lo que este formulario acepta. Autorrellenar un
            // valor que la validación va a rechazar acto seguido es tenderle
            // una trampa al visitante con sus propios datos.
            if (!manosTocadas && el['manos'] &&
                producto.manos_incluidas >= MANOS_MINIMAS &&
                producto.manos_incluidas <= MANOS_MAXIMAS) {
                el['manos'].value = String(producto.manos_incluidas);
            }
        }
        detalle.textContent = partes.join(' ');
        detalle.removeAttribute('hidden');
    }

    /* ------------------------------------------------------------------ */
    /* Validación del formulario de presupuesto                            */
    /* ------------------------------------------------------------------ */

    // Acepta «12,5» y «12.5» cuando la unidad admite decimales, y solo enteros
    // cuando no (no hay media puerta). Devuelve el número, o null si no es un
    // número que valga. Pasarse del tope NO se resuelve aquí: es un caso con
    // frase propia, porque «85000» está bien escrito y merece que se le diga
    // cuál es el máximo en vez de que se le llame número inválido.
    function parsearCantidad(texto, unidad) {
        var limpio = String(texto == null ? '' : texto).trim().replace(/\s+/g, '').replace(',', '.');
        if (limpio === '') return null;
        var patron = unidad.decimales ? /^\d+(\.\d{1,3})?$/ : /^\d+$/;
        if (!patron.test(limpio)) return null;
        var numero = Number(limpio);
        if (!isFinite(numero) || numero <= 0) return null;
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

        // Cantidad, en la unidad del trabajo elegido (m², ml o unidades)
        var unidad = unidadDe(producto ? producto.unidad : '');
        var textoCantidad = el['superficie'] ? el['superficie'].value : '';
        if (String(textoCantidad).trim() === '') {
            ponerError(el['error-superficie'], el['superficie'], unidad.queFalta);
            errores.push(el['superficie']);
        } else {
            var cantidad = parsearCantidad(textoCantidad, unidad);
            if (cantidad === null) {
                ponerError(el['error-superficie'], el['superficie'], unidad.malEscrito);
                errores.push(el['superficie']);
            } else if (cantidad > SUPERFICIE_MAXIMA) {
                ponerError(el['error-superficie'], el['superficie'],
                    'Por aquí calculamos hasta ' + formatearMiles(SUPERFICIE_MAXIMA) + ' ' +
                    unidad.simbolo + '. Si tu obra es mayor, cuéntanoslo y la valoramos contigo.');
                errores.push(el['superficie']);
            } else {
                valores.superficie = cantidad;
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
        var unidad = unidadDe(respuesta.unidad || (producto && producto.unidad));
        var resumen = [
            producto ? producto.nombre : 'Trabajo seleccionado',
            cantidadConUnidad(peticion.superficie, unidad),
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
        } else if (nombre.length > NOMBRE_MAXIMO) {
            // El `maxlength` ya lo impide al teclear y al pegar; esto es para
            // cuando no llega a ponerse. Que lo diga la web y no la API, que
            // para un nombre largo contesta el mismo código que para uno vacío.
            ponerError(el['error-lead-nombre'], el['lead-nombre'],
                'El nombre no puede pasar de ' + NOMBRE_MAXIMO + ' caracteres.');
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
        // Las dos trampas viajan siempre y vacías: para la API, cualquiera de
        // las dos con texto dentro es un bot. Van dos y no una porque `empresa`
        // es justo el nombre que un gestor de contraseñas o el autorrelleno del
        // navegador reconocen como «organización», y si algún día uno de ellos
        // la rellena sola, `web_url` sigue estando vacía y el lead se salva.
        var cuerpo = {
            nombre: nombre,
            empresa: el['no-rellenar-1'] ? el['no-rellenar-1'].value : '',
            web_url: el['no-rellenar-2'] ? el['no-rellenar-2'].value : '',
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
