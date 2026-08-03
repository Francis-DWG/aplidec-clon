# Sitio estático servido con nginx. Sin build: los HTML/CSS/JS van tal cual.
FROM nginx:alpine

# La configuración por defecto de nginx sirve /usr/share/nginx/html en el 80.
COPY . /usr/share/nginx/html

# Fuera del sitio publicado: el Dockerfile no se sirve a sí mismo ni scripts
# de desarrollo locales.
RUN rm -f /usr/share/nginx/html/Dockerfile \
    /usr/share/nginx/html/download-images.ps1 \
    /usr/share/nginx/html/iniciar-servidor.bat \
    /usr/share/nginx/html/SOLUCION-SERVIDOR.md \
    /usr/share/nginx/html/README.md

EXPOSE 80
