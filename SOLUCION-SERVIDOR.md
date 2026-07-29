# Servidor Local para Aplidec Clon

## Problema
El error `ERR_CONNECTION_REFUSED` ocurre porque no hay ningún servidor web escuchando en el puerto 8000.

## Solución Rápida

### Opción 1: Doble clic en `iniciar-servidor.bat`
Haz doble clic en el archivo `iniciar-servidor.bat` que está en esta carpeta. Se abrirá una ventana de terminal y el servidor se iniciará automáticamente.

### Opción 2: Línea de comandos
Abre PowerShell o CMD en esta carpeta y ejecuta:

```bash
python -m http.server 8000
```

### Opción 3: Con Node.js (si lo prefieres)
```bash
npx serve . -p 8000
```

## Verificar que funciona

Una vez arrancado el servidor, verás un mensaje como:
```
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

Entonces podrás acceder a:
- http://localhost:8000/ → Página de inicio
- http://localhost:8000/acabados.html → Acabados
- http://localhost:8000/contacto.html → Contacto
- http://localhost:8000/proyectos.html → Proyectos

## Si sigue fallando

1. **Verifica que Python esté instalado**: Abre una terminal y escribe `python --version`
2. **Verifica el puerto**: Otro programa puede estar usando el puerto 8000. Prueba con otro puerto:
   ```bash
   python -m http.server 3000
   ```
   Y luego visita `http://localhost:3000`

3. **Firewall**: Asegúrate de que el firewall de Windows no esté bloqueando Python

## Estructura de archivos verificada

El proyecto contiene todos estos archivos listos para servir:
- ✅ index.html
- ✅ aplicaciones-para-interior.html
- ✅ aplicaciones-para-exterior.html
- ✅ acabados.html
- ✅ clientes.html
- ✅ proyectos.html
- ✅ contacto.html
- ✅ blog.html
- ✅ politicas-de-privacidad.html
- ✅ aplicaciones-para-exterior/corcho-proyectado-aislamiento-natura.html
- ✅ aplicaciones-para-exterior/pintura-anti-radon.html
- ✅ css/styles.css
- ✅ js/main.js
