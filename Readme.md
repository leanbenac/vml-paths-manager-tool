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

* **Flujo de Un Solo Clic (Scan & Auto-Copy)**:
  - Estando en cualquier ticket de tu servidor de Jira (ej. `jira.uhub.biz` o `*.atlassian.net`), haz clic en **"SCAN ACTIVE JIRA TICKET"**.
  - **Priorización de Comentarios**: Emplea una heurística inteligente que busca en orden cronológico inverso (del más nuevo al más antiguo) el **último comentario que contenga paths de publicación**. Si lo encuentra, extrae la información únicamente de este comentario (evitando duplicados); si no, realiza un fallback y escanea la descripción del ticket.
  - **Copiado al Portapapeles Automático**: Los paths detectados se procesan, clasifican y se copian directamente en tu portapapeles de manera automática.
* **Escaneo de Sub-tareas en Lote**:
  - Si el ticket tiene sub-tareas asociadas, el botón **"SCAN ALL SUB-TASKS"** se habilitará mostrando la cantidad de sub-tareas.
  - Al presionarlo, realiza peticiones asíncronas concurrentes a la API de Jira para compilar y unificar los paths de todas las sub-tareas en un solo paso.
  - **Filtro de Estado y Asignado**: Solo se procesan sub-tareas cuyo estado sea `"In Progress"` o `"Open"`, y que estén asignadas a los PMs autorizados configurados, evitando capturar tickets ya cerrados o asignados a editores de contenido.
  - **Configuración de PMs**: Incluye un panel colapsable (`🔧 Configure PMs`) que guarda de forma persistente la lista de PMs permitidos (ej. `"Tony Stark, Peter Parker"`). Los nombres ingresados se formatean y capitalizan automáticamente (iniciales en mayúscula) tanto al escribir como al perder el foco (blur).
* **Agrupación y Jerarquía Inteligente**:
  - Los resultados se clasifican automáticamente y se organizan bajo la siguiente jerarquía:
    1. **Assets**: Recursos de DAM, imágenes, videos o documentos (`/content/dam/...` excluyendo fragmentos).
    2. **VDM**: Páginas o consolas VDM (`/vdm` o `/vdm.html`).
    3. **CF (Content Fragments)**: Fragmentos de contenido (`/content/dam/.../cf/`).
    4. **XF (Experience Fragments)**: Fragmentos de experiencia (`/content/experience-fragments/...`).
    5. **Pages**: Páginas de sitios AEM (`/content/...` que no pertenezcan a las categorías anteriores).
  - Deduplica nombres de recursos de manera insensible a mayúsculas/minúsculas (ej. evita repetir `3 column` y `3 Column`).
  - **Soporte de Elementos Secundarios**: Detecta elementos secundarios anuidos bajo una ruta cuando están precedidos por `>, >>, o >>>` (removiendo automáticamente los prefijos y espacios).
* **Formato de Exportación Compacto**:
  - El formato copiado al portapapeles (o descargado) agrupa los elementos bajo una única cabecera por categoría, optimizando el espacio en los comentarios de Jira:
    ```text
    PUBLISHING PATH - CF

    https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_ca/nameplate/mustang/2026/models/dark-horse-sc
    >>> settings
    >>> specs
    ```
  - **Botones Auxiliares**: Incluye botones para volver a copiar el formato consolidado (**COPY FORMATTED**) o descargar un archivo estructurado (**DOWNLOAD TXT**).
* **Persistencia y Caché Inteligente (Local Storage)**:
  - Guarda automáticamente los resultados de los escaneos (incluyendo la clave del ticket y la cantidad de sub-tareas) en la memoria local del navegador (`chrome.storage.local`) asociados a la URL del ticket de Jira.
  - Al abrir el popup en un ticket previamente analizado, los resultados se restauran al instante sin necesidad de volver a consultar la página o llamar a la API de Jira.
  - Cuenta con un sistema de auto-curación (*self-healing*) que deduce y repara automáticamente la clave del ticket a partir de la URL activa en caso de discrepancias.

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

La extensión cumple estrictamente con los estándares recomendados por Google para **Manifest V3**:
1. **Zero Data Tracking**: No recopila, transmite ni almacena datos fuera del entorno local del navegador. Todo el procesamiento se realiza en memoria.
2. **Protección XSS**: Evita el uso de `eval()` e `innerHTML` dinámico sin sanitizar para evitar inyecciones maliciosas.
3. **Mismo Origen (Same-Origin)**: Accede de forma segura a los iframes de AEM validando políticas de origen cruzado.
4. **Permisos Mínimos**: Utiliza exclusivamente `storage` para recordar preferencias y `activeTab` para comunicarse con las pestañas activas del usuario de forma segura.