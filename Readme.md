# VML Paths Manager Tool 🛠️

Una suite de herramientas para Google Chrome diseñada específicamente para optimizar el flujo de trabajo de Project Managers, Leads y Publishers de VML, facilitando la gestión, extracción y generación de rutas de publicación (Publishing Paths) dentro del ecosistema de Adobe Experience Manager (AEM) y tickets de Jira.

---

## 📋 Requisitos e Instalación

1. **Requisitos**: Google Chrome (o cualquier navegador basado en Chromium).
2. **Instalación**:
   - Descarga o clona este repositorio en tu máquina.
   - Abre Google Chrome y navega a `chrome://extensions/`.
   - Activa el **"Modo de desarrollador"** (Developer mode) en la esquina superior derecha.
   - Haz clic en **"Cargar extensión sin empaquetar"** (Load unpacked).
   - Selecciona la carpeta raíz del proyecto (que contiene el archivo `manifest.json`).
   - Fija la extensión en la barra de herramientas para acceder con un clic.

---

## 🏗️ Arquitectura del Proyecto

```text
vml-paths-manager-tool/
├── manifest.json                  # Configuración de la extensión (Manifest V3)
├── assets/
│   └── logo-vml.png               # Logotipo y Branding
├── core/
│   ├── content.css                # Estilos inyectados en las pestañas
│   ├── modules-info.js            # Diccionario de documentación in-app
│   ├── popup.css                  # Estilos premium oscuros de la UI del popup
│   ├── popup.html                 # Estructura principal del popup
│   └── popup-ui.js                # Control de tooltips dinámicos de ayuda
├── modules/
│   ├── jira-path-parser/          # Módulo: Extractor de Paths desde Jira (Activo)
│   └── path-validator/            # Módulo: Validador de Publish Paths (Activo)
├── scratch/                       # Scripts de prueba del parseador
└── Readme.md                      # Documentación del proyecto
```

---

## ⚙️ Descripción de los Módulos

La extensión cuenta con dos módulos principales diseñados para tareas complementarias:

### 1. Jira AEM Path Parser 🎫 (Módulo Activo)
Este módulo automatiza la **lectura y consolidación de paths de publicación** directamente desde los comentarios y descripciones de tickets de Jira, evitando el trabajo de buscar y verificar manualmente cada link.

* **Flujo de Un Solo Clic y Anti-Caché**:
  - Estando en cualquier ticket de tu servidor de Jira (ej. `jira.uhub.biz` o `*.atlassian.net`), haz clic en **"SCAN ACTIVE JIRA TICKET"**.
  - **Sincronización en Tiempo Real:** Las peticiones a la API de Jira incluyen destructores de caché agresivos (`cache: 'no-store'` y timestamps) garantizando que siempre obtengas la versión más fresca del ticket sin depender de la caché de Chrome.
  - **Priorización Inteligente**: Busca en orden cronológico inverso el último comentario que contenga paths. Si no encuentra, revisa la descripción del ticket.
* **Escaneo de Sub-tareas en Lote**:
  - Si el ticket tiene sub-tareas asociadas, el botón **"SCAN ALL SUB-TASKS"** se habilitará.
  - **Alerta de Seguridad Modal:** Si intentas escanear todas las sub-tareas sin haber configurado el nombre de tu PM, un modal oscuro personalizado te advertirá antes de proceder para evitar escaneos masivos innecesarios.
  - Filtra las sub-tareas para procesar solo aquellas con estado `"In Progress"` o `"Open"`, asignadas a los PMs autorizados configurados.
* **Agrupación y Aislamiento de Contexto (Publish vs Deactivate)**:
  - Separa y aísla los links para publicar de los links para desactivar (`DEACTIVATE`), agrupando estos últimos en un bloque con prioridad al final de la lista.
  - Los resultados de cada modo se clasifican bajo la jerarquía: Assets, VDM, CF, XF, Pages.
  - **Deduplicación Estricta:** Si el PM repite la misma ruta base, la herramienta agrupa todos los archivos hijos bajo una sola carpeta.
* **Filtros Anti-Basura y Corrección Automática (Auto-Clean)**:
  - Elimina automáticamente la cadena `/ui#/aem/` de las URLs.
  - Detecta y descarta automáticamente las URLs de consolas VDM (`/vdm/`) para no ensuciar la lista.
  - **Inmunidad a Formatos de Texto:** Ignora y limpia dinámicamente marcadores de formato (como **negrita**, *cursiva* o ~~tachado~~) que los PMs suelen agregar accidentalmente en Jira, asegurando que las URLs y elementos se extraigan intactos.
* **Píldoras de Alerta y Resolución (Auto-Fix Pills)**:
  La interfaz muestra píldoras naranjas para informar sobre intervenciones automáticas:
  1. **`Locale Fixed`**: Corrige el locale de la URL (ej. de `en_us` a `en_ca`) si no coincide con el país del ticket.
  2. **`Direct Item Extracted`**: Extrae el nombre del archivo y la carpeta padre cuando el PM pega una ruta directa `.html`.
  3. **`Editor URL Converted`**: Transforma URLs de edición (`editor.html`) a rutas correctas (`assets.html` o `sites.html`).
  4. **`Item URL Unified`**: Fusiona ítems duplicados bajo la misma carpeta padre.
  5. **`⚠️ Conflict: Item in both Publish and Deactivate`**: Advierte si un PM solicitó publicar y desactivar exactamente el mismo archivo, para que el equipo pueda consultarle.
* **Recibo de Lote (Batch Receipt) Inteligente**:
  - Acumula los tickets escaneados durante la sesión de trabajo en un panel colapsable para copiarlos fácilmente.
  - Si un ticket escaneado **no contiene paths de publicación**, se lista con una etiqueta roja de alerta `NO PATHS`, dándole al usuario visibilidad inmediata sobre tickets incompletos o mal cargados por QA.
* **Persistencia y Caché Local**:
  - Guarda automáticamente los resultados de los escaneos en la memoria local del navegador (`chrome.storage.local`) asociados a la URL del ticket.

### 2. Path Validator 🔍 (Módulo Activo)
Este módulo permite **validar y verificar en tiempo real si uno o más publish paths existen** en el entorno activo en el que el usuario está posicionado.

* **Entrada de Datos Flexible**:
  - **Pegar Texto**: Permite copiar y pegar directamente uno o más paths (incluso con el formato jerárquico del parseador de Jira con prefijos `>>>`).
  - **Cargar Archivo TXT**: Permite cargar un archivo de texto `.txt` directamente para poblar el validador de forma automática.
* **Detección Automática de Entorno**:
  - Identifica el host de AEM Cloud o VDM de la pestaña activa de Chrome y habilita el botón de validación solo cuando el usuario está en un entorno válido y con sesión iniciada.
  - **Reescritura de Dominio Inteligente**: Si los paths pegados o cargados tienen dominios diferentes (por ejemplo, copiados de Jira que apuntaban a producción), el validador reescribe automáticamente los requests hacia el dominio activo de la pestaña del usuario, evitando errores y validando contra el ambiente actual de trabajo.
* **Validación Asíncrona en Lotes**:
  - Envía la lista de rutas al script de contenido de la página activa para ejecutar las consultas bajo el origen del usuario (heredando sus credenciales de login) de forma segura y veloz.
  - Ejecuta las validaciones de forma asíncrona en lotes de 4 para evitar cuellos de botella de red o rate limits del servidor AEM.
* **Resumen y Navegación Rápida**:
  - Muestra badges de estado en base a la respuesta del servidor: `VALID` (200-299), `INVALID` (404), `RESTRICTED` (403) o `ERROR`.
  - Clasifica las rutas con badges según su categoría (Assets, VDM, CF, XF, Pages).
  - Incluye un botón **Open** rápido al lado de cada path verificado para abrir directamente su consola o editor JCR correspondiente en una nueva pestaña.

---

## 🎨 Diseño Visual y Branding

La extensión cuenta con una interfaz de usuario premium y futurista, diseñada con los siguientes elementos:
- **Identidad de Marca VML**: Logotipo oficial de la empresa en alta definición, con fondo transparente integrado y un halo de brillo neón adaptativo en los bordes.
- **Esquema de Colores "Sci-Fi / Dark Mode"**:
  - Acentos y bordes en Cyan brillante (`#00e5ff`) con sombras de brillo difuminado.
  - Botones de sub-tareas, descarga de archivos TXT y badges de tickets en un elegante degradado de oro y bronce (`#a8864a` a `#c9a96e`).
- **Feedback Visual de Usuario**: Animaciones interactivas (por ejemplo, confirmación de estado visual a color verde con el texto `"COPIED! ✔️"` durante 1.5 segundos al presionar el botón de copia).

---

## 🛡️ Seguridad y Privacidad (AppSec)

La extensión cumple estrictamente con los estándares y recomendaciones del equipo de Enterprise Solutions para **Manifest V3**:
1. **Zero Data Tracking**: No recopila, transmite ni almacena datos fuera del entorno local del navegador. Todo el procesamiento se realiza en memoria.
2. **Protección XSS y Ejecución Segura**: Erradicación total de funciones inseguras como `eval()` e `innerHTML` dinámico. La interfaz gráfica se construye utilizando exclusivamente métodos nativos seguros (`document.createElement`, `textContent`), cerrando vectores de inyección maliciosa.
3. **Mínimo Privilegio (Host Permissions)**: Se ha eliminado el acceso global (`<all_urls>`). La herramienta declara únicamente los dominios estrictamente autorizados para la operación (`*://*.adobeaemcloud.com/*`, `*://jira.uhub.biz/*`, `*://*.atlassian.net/*`), mitigando riesgos de acceso no deseado.
4. **Mismo Origen (Same-Origin)**: Accede de forma segura a los iframes de AEM validando políticas de origen cruzado.
5. **Permisos de la API Chrome**: Utiliza exclusivamente `storage` para recordar preferencias y `activeTab` / `scripting` para comunicarse con las pestañas activas del usuario de forma quirúrgica.