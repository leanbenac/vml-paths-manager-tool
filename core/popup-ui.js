// ============================================
// VML Paths Manager Tool — Popup: UI Logic
// Versioning + Documentation Tooltips
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  // ── DYNAMIC VERSION ─────────────────────────────────────────────
  const appVersionEl = document.getElementById('appVersion');
  if (appVersionEl && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    const manifest = chrome.runtime.getManifest();
    appVersionEl.textContent = `v${manifest.version} - Internal Release`;
  }

  // ── IN-APP DOCUMENTATION (TOOLTIPS) ──────────────────────────────
  const infoButtons = document.querySelectorAll('.info-btn');
  
  // Crear el contenedor único de tooltip si no existe
  let tooltipEl = document.getElementById('infoTooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'infoTooltip';
    tooltipEl.className = 'info-tooltip';
    tooltipEl.innerHTML = `
      <div class="tooltip-header">
        <h4 id="tooltipTitle" class="tooltip-title"></h4>
      </div>
      <p id="tooltipDesc" class="tooltip-desc"></p>
      <div class="tooltip-validations-section">
        <span class="tooltip-section-label">Validation Rules:</span>
        <ul id="tooltipValidations" class="tooltip-validations-list"></ul>
      </div>
    `;
    document.body.appendChild(tooltipEl);
  }

  const tooltipTitle = tooltipEl.querySelector('#tooltipTitle');
  const tooltipDesc = tooltipEl.querySelector('#tooltipDesc');
  const tooltipValidations = tooltipEl.querySelector('#tooltipValidations');

  let activeBtn = null;

  function showTooltip(btn) {
    const moduleId = btn.dataset.module;
    if (typeof MODULES_DOCUMENTATION === 'undefined') {
      console.warn('[VML Paths Manager Tool] MODULES_DOCUMENTATION is not loaded.');
      return;
    }

    const info = MODULES_DOCUMENTATION[moduleId];
    if (!info) return;

    // Llenar contenido
    tooltipTitle.textContent = info.title;
    tooltipDesc.textContent = info.description;
    
    tooltipValidations.innerHTML = '';
    if (Array.isArray(info.validations)) {
      info.validations.forEach(val => {
        const li = document.createElement('li');
        li.textContent = val;
        tooltipValidations.appendChild(li);
      });
    }

    // Posicionamiento dinámico
    tooltipEl.style.display = 'block';
    
    // Forzar reflow para que comience la transición
    tooltipEl.offsetHeight;
    
    const btnRect = btn.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    // Calcular posición óptima: centrado debajo del botón
    let top = btnRect.bottom + 8;
    let left = btnRect.left + (btnRect.width / 2) - (tooltipRect.width / 2);

    // Evitar desbordamiento horizontal en el viewport del popup (ancho 420px)
    if (left < 10) {
      left = 10;
    } else if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }

    // Evitar desbordamiento vertical (si se sale por abajo, mostrar arriba)
    if (top + tooltipRect.height > window.innerHeight - 10) {
      top = btnRect.top - tooltipRect.height - 8;
    }

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.classList.add('visible');
    
    activeBtn = btn;
  }

  function hideTooltip() {
    tooltipEl.classList.remove('visible');
    // Esperar a que termine la animación (200ms) para ocultar
    setTimeout(() => {
      if (!tooltipEl.classList.contains('visible')) {
        tooltipEl.style.display = 'none';
      }
    }, 200);
    activeBtn = null;
  }

  infoButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeBtn === btn) {
        hideTooltip();
      } else {
        showTooltip(btn);
      }
    });

    btn.addEventListener('mouseenter', (e) => {
      e.stopPropagation();
      showTooltip(btn);
    });

    btn.addEventListener('mouseleave', (e) => {
      e.stopPropagation();
      hideTooltip();
    });
  });

  // Cerrar tooltip al hacer clic en cualquier parte de la pantalla
  document.addEventListener('click', () => {
    hideTooltip();
  });

});
