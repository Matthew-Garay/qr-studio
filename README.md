# QR Studio

Generador de códigos QR **100% offline** (funciona solo en el navegador: tus datos
nunca salen de tu equipo). Descarga el código QR en **PNG, JPG, WebP, SVG y PDF**
con varias calidades de resolución y muchas opciones de personalización.

## ✨ Características

### Tipos de contenido
- Texto / URL
- URL `https://` (auto-completa el esquema)
- Red WiFi (SSID, contraseña y cifrado)
- Contacto vCard (nombre, organización, móvil y email)
- SMS
- Llamada de teléfono
- Correo electrónico (asunto + cuerpo)
- WhatsApp (con texto previo)

### Exportación: varias calidades y formatos
- **Formatos**: `PNG`, `JPG`, `WebP` (raster con antialiasing desactivado para nitidez), `SVG` (vectorial, sin pérdida) y `PDF` (vectorial/rastrero según calidad).
- **Calidades / resoluciones** escalables:
  | Calidad | Multiplicador | Exporta (~) |
  |---------|---------------|-------------|
  | Baja    | 1×            | 150 px      |
  | Media   | 2×            | 300 px      |
  | Alta    | 4×            | 600 px      |
  | Ultra   | 8×            | 1200 px     |
- El multiplicador reescala el lienzo directamente, por lo que el PNG/JPG/WebP
  resultante conserva nitidez en impresiones grandes. El SVG y PDF son vectoriales.

### Personalización visual
- Color de los módulos y del fondo (selector de color).
- Forma de los módulos: **cuadrado**, redondeado, puntos, extra redondeado.
- Forma de los "ojos" (finder patterns): clásico, circular, redondeado, extra redondeado.
- Nivel de corrección de errores: **L / M / Q / H** (hasta 30% de daño tolerante).
- Margen / zona de silencio ajustable (0–20 módulos).
- Tamaño de módulos ajustable.
- Logo o imagen central (PNG/JPG/SVG) con tamaño configurable (10–40%).

### Extras
- Vista previa en tiempo real (con *debounce*) y al pulsar **Generar**.
- Metadatos de la vista previa: tipo de contenido, icono y número de módulos.
- Nombre de archivo personalizado.
- La última entrada de datos se guarda en `localStorage`.

## 🚀 Uso

1. Abre `index.html` en cualquier navegador moderno (Chrome, Edge, Firefox, Safari).
2. Elige el tipo de contenido y escribe los datos.
3. Ajusta colores, forma, corrección de errores, margen y (opcionalmente) un logo.
4. Pulsa **Generar** para ver la vista previa.
5. Selecciona el formato y la calidad, escribe un nombre y pulsa **Descargar**.

> No se necesita instalación ni conexión a Internet. Si deseas, sirve la carpeta con
> `npx serve` o abre el `index.html` directamente.

## 📦 Tecnologías
- **[qr-code-styling](https://github.com/kazuhikoarita/qr-code-styling)** — renderizado y opciones avanzadas.
- **[jsPDF](https://github.com/parallax/jsPDF)** — exportación a PDF.
- HTML5, CSS3 (grid/flex, dark mode automático) y ES modules (`js/app.js`).

## 📝 Licencia
Libre para uso personal y comercial.
