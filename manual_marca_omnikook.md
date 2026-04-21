# Manual de Identidad Visual y Marca: OMNIKOOK

> Versión 1.1 — Documento de referencia para equipos de diseño e inteligencia artificial generativa.

---

## 1. Concepto y Posicionamiento

**Nombre de la Marca:** OMNIKOOK — fusión de "Omni" (omnipresencia en todas las redes sociales) y "Kook" (variación fonética de *cook*, cocinar). El nombre suena técnico, moderno y completamente original.

OMNIKOOK es un software B2B tipo dashboard diseñado exclusivamente para Dark Kitchens (cocinas fantasma). Su función principal es agregar y gestionar en tiempo real los pedidos provenientes de todas las redes sociales —Instagram, WhatsApp, TikTok, Facebook, entre otras— en un único panel de control centralizado. El producto no es un restaurante: es el sistema operativo que lo hace funcionar.

La marca se construye sobre cuatro atributos fundamentales que deben estar presentes en cada decisión de diseño y comunicación: **Minimalista** (interfaz ultra limpia, sin distracciones, porque en una cocina el ruido visual cuesta dinero), **Experimental** (rompe con los esquemas de los sistemas POS tradicionales, diseño audaz y vanguardista), **Ágil** (rápida, reactiva y enfocada en el tiempo real) y **Conectada** (el puente invisible y eficiente entre el comensal digital y el chef).

**Tagline oficial:** *"El sistema nervioso central de tu Dark Kitchen."*

---

## 2. Logotipo y Símbolo

El logotipo debe transmitir precisión técnica y modernidad absoluta. No debe evocar un restaurante tradicional, sino una empresa de tecnología SaaS de alto nivel. La referencia estética es el diseño suizo de los años 60 filtrado por la cultura del software de los 2020s.

**Estructura del Logotipo:**

El logotipo se compone de dos elementos: un **isotipo** (símbolo abstracto) a la izquierda y el **wordmark** "OMNIKOOK" en mayúsculas a la derecha. Debe funcionar también en versión apilada (símbolo arriba, texto abajo) para avatares y aplicaciones cuadradas.

El **isotipo** es un diseño geométrico monolineal que combina sutilmente la silueta de un recipiente de cocina (hexágono o cuenco de líneas finas) con un elemento de conectividad digital (un arco de señal o un nodo de red). Todo el símbolo se construye con líneas de grosor uniforme, sin rellenos sólidos. El **wordmark** usa una tipografía grotesca geométrica en mayúsculas con espaciado entre letras (tracking) ajustado y apretado.

**Estilo Visual:** Brutalista-minimalista. Sin degradados, sin sombras, sin elementos decorativos 3D. Diseño plano (flat design) absoluto.

**Prompt para IA generativa de logotipos:**

> "Minimalist experimental logo for a B2B SaaS tech brand called 'OMNIKOOK'. The logo consists of a clean geometric monoline icon and the wordmark. The icon is an abstract symbol combining a thin-line hexagon representing a kitchen vessel, with a subtle signal or wifi-like arc emanating from it, suggesting real-time connectivity. The wordmark 'OMNIKOOK' is set in a modern geometric sans-serif typeface, all uppercase, with tight letter-spacing. Pure flat design, brutalist-minimal, Swiss design influenced, no gradients, no shadows, no 3D effects. Ultra clean vector style on a transparent background."

---

## 3. Paleta de Color: Sistema Dual (Dark Mode / Light Mode)

OMNIKOOK opera bajo un sistema de color dual. Ambos modos comparten la misma lógica de contraste y el mismo conjunto de colores de acento, pero invierten los valores de fondo y texto. El color de acento principal —el verde neón ácido— es el único elemento que permanece reconocible en ambos modos, actuando como la firma visual de la marca.

### 3.1 Dark Mode (Modo Oscuro)

El modo oscuro es el modo **predeterminado** de la plataforma. Está diseñado para entornos de cocina con iluminación artificial, turnos nocturnos y uso prolongado. Prioriza la reducción de fatiga visual y la visibilidad de alertas.

| Token de Diseño | Nombre | HEX | Uso |
|---|---|---|---|
| `--bg-primary` | Void Black | `#0A0A0A` | Fondo general del dashboard |
| `--bg-surface` | Surface Dark | `#141414` | Tarjetas, paneles y módulos |
| `--text-primary` | Pure White | `#FFFFFF` | Títulos, datos críticos, texto principal |
| `--text-secondary` | Muted Gray | `#888888` | Etiquetas, metadatos, texto de apoyo |
| `--border` | Grid Line Dark | `#333333` | Líneas divisoras de 1px entre secciones |
| `--accent-success` | Neon Acid Green | `#CCFF00` | Nuevo pedido, estado activo, éxito |
| `--accent-error` | Alert Red | `#FF3333` | Error, retraso, alerta crítica |
| `--accent-action` | Electric Blue | `#0044FF` | Botones primarios, enlaces, acciones |

### 3.2 Light Mode (Modo Claro)

El modo claro está diseñado para cocinas con alta iluminación natural, uso diurno o preferencia del operador. Mantiene la estética brutalista y experimental invirtiendo los valores de fondo y texto. Los colores de acento se oscurecen ligeramente para garantizar el contraste WCAG AA sobre fondos blancos.

| Token de Diseño | Nombre | HEX | Uso |
|---|---|---|---|
| `--bg-primary` | Clinical White | `#F8F9FA` | Fondo general del dashboard |
| `--bg-surface` | Surface Light | `#FFFFFF` | Tarjetas, paneles y módulos |
| `--text-primary` | Ink Black | `#111111` | Títulos, datos críticos, texto principal |
| `--text-secondary` | Steel Gray | `#666666` | Etiquetas, metadatos, texto de apoyo |
| `--border` | Grid Line Light | `#E0E0E0` | Líneas divisoras de 1px entre secciones |
| `--accent-success` | Acid Green | `#A3CC00` | Nuevo pedido, estado activo, éxito |
| `--accent-error` | Alert Red | `#E60000` | Error, retraso, alerta crítica |
| `--accent-action` | Electric Blue | `#0033CC` | Botones primarios, enlaces, acciones |

**Prompt para IA generativa de UI — Dark Mode:**

> "UI design for a dark kitchen restaurant management dashboard, DARK MODE. Minimalist, experimental, brutalist aesthetic. Deep black background (#0A0A0A) with surface panels in (#141414) and pure white text (#FFFFFF). Neon acid green (#CCFF00) accents for new order notifications. Strict visible grid with 1px dark gray (#333333) borders separating panels. Left sidebar for navigation, main area showing real-time incoming orders from social media channels. Mix of geometric sans-serif and monospace typography. High contrast, ultra-clean, no gradients, no drop shadows. B2B SaaS software interface."

**Prompt para IA generativa de UI — Light Mode:**

> "UI design for a dark kitchen restaurant management dashboard, LIGHT MODE. Minimalist, experimental, brutalist aesthetic. Clinical white background (#F8F9FA) with pure white panels (#FFFFFF) and ink black text (#111111). Acid green (#A3CC00) accents for new order notifications. Strict visible grid with 1px light gray (#E0E0E0) borders separating panels. Left sidebar for navigation, main area showing real-time incoming orders from social media channels. Mix of geometric sans-serif and monospace typography. High contrast, ultra-clean, no gradients, no drop shadows. B2B SaaS software interface."

---

## 4. Tipografía

La tipografía refuerza la dualidad de la marca: tecnología de alto rendimiento al servicio de la gastronomía. Se utilizan dos familias tipográficas con roles claramente diferenciados.

La **tipografía principal** es *Space Grotesk* (alternativa: *Inter*), disponible en Google Fonts. Es una grotesca geométrica con un carácter técnico y ligeramente inusual que la diferencia de las sans-serif corporativas genéricas. Se usa para títulos de sección, números grandes de estadísticas (pedidos totales, ingresos, tiempos), el wordmark del logotipo y cualquier texto de jerarquía alta.

La **tipografía secundaria** es *JetBrains Mono* (alternativa: *Roboto Mono*), también en Google Fonts. Es una fuente monoespaciada diseñada originalmente para entornos de código, lo que refuerza la estética experimental y de "software de control". Se usa para IDs de pedidos, marcas de tiempo, tablas de datos, detalles técnicos y cualquier información que requiera alineación precisa en columnas.

| Rol | Familia | Peso | Uso |
|---|---|---|---|
| Display / Títulos | Space Grotesk | Bold (700) | Encabezados de sección, KPIs grandes |
| Subtítulos | Space Grotesk | Medium (500) | Nombres de módulos, etiquetas de tarjeta |
| Datos / Cuerpo | JetBrains Mono | Regular (400) | IDs, horas, cantidades, tablas |
| Alertas | Space Grotesk | SemiBold (600) | Mensajes de estado, notificaciones |

---

## 5. Sistema de Diseño e Interfaz (UI)

La interfaz de OMNIKOOK se construye sobre una cuadrícula (grid) visible y técnica. El orden visual no proviene de la decoración, sino de la estructura.

**Bordes y Formas:** Se usan bordes afilados con radio de 0px como regla general. Se permite un radio máximo de 4px únicamente en elementos interactivos pequeños (botones, badges de estado) para mejorar la usabilidad táctil. Las formas orgánicas o muy redondeadas están prohibidas.

**Espaciado:** El espaciado es generoso y consistente. El minimalismo se logra dejando que los elementos respiren, no eliminando información. Se recomienda un sistema de espaciado basado en múltiplos de 8px (8, 16, 24, 32, 48, 64px).

**Iconografía:** Todos los iconos son de línea fina con un grosor de trazo de 1.5px, geométricos y sin relleno. Las bibliotecas de referencia son *Feather Icons* o *Phosphor Icons*. Ningún icono debe tener más de dos niveles de detalle visual.

---

## 6. Interacción: Toggle Dark / Light Mode

El cambio entre modos es una funcionalidad de primer nivel en OMNIKOOK y debe estar siempre accesible, reflejando la agilidad del sistema.

**Ubicación:** El botón toggle se coloca en la esquina superior derecha del dashboard, adyacente al avatar del usuario. Como alternativa válida, puede ubicarse en la parte inferior del menú lateral (sidebar), anclado al pie.

**Diseño del Toggle:** El componente es un interruptor (switch) minimalista de 40×20px o un botón de icono cuadrado de 32×32px. No debe tener animaciones complejas ni iconos detallados. El icono en estado de modo oscuro activo es una luna creciente de línea fina; en estado de modo claro activo, un círculo con cuatro líneas rectas cortas representando el sol.

**Comportamiento de la Transición:** Al activar el toggle, el cambio de tema aplica en toda la interfaz con una transición CSS de tipo `transition: background-color 150ms ease, color 150ms ease`. La duración máxima es de 150ms. La sensación buscada es la de un "corte de circuito" —inmediato y preciso— no una animación suave y orgánica. Todos los tokens de diseño (`--bg-primary`, `--text-primary`, etc.) se reemplazan simultáneamente.

**Estado persistente:** El modo seleccionado por el usuario se guarda en `localStorage` y se respeta en sesiones futuras. Si no existe preferencia guardada, el sistema detecta la preferencia del sistema operativo mediante `prefers-color-scheme` y aplica el modo correspondiente por defecto.

---

## 7. Tono de Voz y Copywriting

El lenguaje de OMNIKOOK es tan parte de la identidad como el color o la tipografía. Debe ser directo, técnico y sin adornos. En una cocina, el tiempo es oro y cada palabra cuenta.

**Directo y Conciso:** Los mensajes de la interfaz van al punto sin exclamaciones ni lenguaje emocional. Se escribe "Pedido #402 recibido — Instagram" y no "¡Genial! Tienes un nuevo pedido". Se escribe "Canal desconectado" y no "Ups, algo salió mal".

**Técnico pero Accesible:** La plataforma usa terminología de software y operaciones, pero nunca jerga incomprensible. Los términos preferidos son: sincronización de canales, flujo de pedidos, latencia, panel de control, estado en tiempo real, integración activa.

**Seguro y Autorizado:** El sistema no duda. Los mensajes de confirmación son afirmativos. Los mensajes de error son precisos y ofrecen una acción inmediata. OMNIKOOK no pide disculpas; informa y resuelve.

| Situación | Tono incorrecto | Tono OMNIKOOK |
|---|---|---|
| Nuevo pedido | "¡Tienes un nuevo pedido!" | "Pedido #512 — WhatsApp — 14:32" |
| Error de conexión | "Ups, algo salió mal" | "Canal Instagram desconectado. Reconectar." |
| Confirmación | "¡Listo! Todo guardado correctamente" | "Configuración guardada." |
| Carga del sistema | "Estamos preparando todo para ti..." | "Cargando panel..." |