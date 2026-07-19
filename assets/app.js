let EXERCISES = [];

async function loadExercises() {
  renderSkeletons(12);
  try {
    const res = await fetch("/data/exercises.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    EXERCISES = await res.json();
    init();
  } catch (err) {
    gridEl.innerHTML = `<div class="empty-state"><p>❌</p><p>Failed to load exercises</p></div>`;
    console.error("Failed to load exercises.json:", err);
  }
}

// ── State ──────────────────────────────────────────
const state = {
  exercises: [],
  filtered: [],
  search: "",
  filters: {
    category: new Set(),
    equipment: new Set(),
    target: new Set(),
  },
  page: 0,
  pageSize: 60,
};

// Equipment items to show initially (rest behind "show more")
const EQUIP_INITIAL = 10;

// ── DOM Refs ───────────────────────────────────────
const gridEl = document.getElementById("exercise-grid");
const sentinelEl = document.getElementById("load-sentinel");
const spinnerEl = document.getElementById("load-spinner");
const countEl = document.getElementById("results-count");
const activeFilEl = document.getElementById("active-filters");
const searchEl = document.getElementById("search");
const searchClearEl = document.getElementById("search-clear");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalGif = document.getElementById("modal-gif");
const modalMeta = document.getElementById("modal-meta");
const modalMuscles = document.getElementById("modal-muscles");
const modalInstr = document.getElementById("modal-instructions");
const modalClose = document.getElementById("modal-close");

// ── Utility ────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort();
}

// ── Data Loading ───────────────────────────────────
function init() {
  state.exercises = EXERCISES;

  // Pre-compute search index per exercise
  state.exercises.forEach((ex) => {
    ex._idx =
      `${ex.name} ${ex.category} ${ex.target} ${ex.equipment} ${ex.muscle_group}`.toLowerCase();
  });

  buildFilterOptions();
  applyFilters();
  wireEvents();
}

// ── Build Filter Chips ─────────────────────────────
function buildFilterOptions() {
  const cats = uniqueSorted(state.exercises.map((e) => e.category));
  const equips = uniqueSorted(state.exercises.map((e) => e.equipment));
  const targets = uniqueSorted(state.exercises.map((e) => e.target));

  renderChips("category-chips", cats, "category");
  renderChips("equipment-chips", equips, "equipment");
  renderChips("target-chips", targets, "target");
}

function renderChips(containerId, values, filterKey, initialLimit = null) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const toShow = initialLimit ? values.slice(0, initialLimit) : values;
  const rest = initialLimit ? values.slice(initialLimit) : [];

  toShow.forEach((val) => {
    container.appendChild(makeChip(val, filterKey));
  });

  if (rest.length > 0) {
    // Hidden chips
    const hiddenWrap = document.createElement("div");
    hiddenWrap.style.cssText =
      "display:none;flex-wrap:wrap;gap:5px;width:100%;";
    rest.forEach((val) => hiddenWrap.appendChild(makeChip(val, filterKey)));
    container.appendChild(hiddenWrap);

    // Show more button
    const moreBtn = document.createElement("button");
    moreBtn.className = "chip filter-show-more";
    moreBtn.textContent = `+${rest.length} more`;
    moreBtn.addEventListener("click", () => {
      hiddenWrap.style.display = "flex";
      moreBtn.remove();
    });
    container.appendChild(moreBtn);
  }
}

function makeChip(value, filterKey) {
  const btn = document.createElement("button");
  btn.className = "chip";
  btn.textContent = value;
  btn.dataset.filter = filterKey;
  btn.dataset.value = value;
  return btn;
}

// ── Filter Logic ───────────────────────────────────
function toggleFilter(key, value) {
  const set = state.filters[key];
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function applyFilters() {
  const q = state.search.toLowerCase().trim();
  const { category, equipment, target } = state.filters;

  state.filtered = state.exercises.filter((ex) => {
    if (q && !ex._idx.includes(q)) return false;
    if (category.size && !category.has(ex.category)) return false;
    if (equipment.size && !equipment.has(ex.equipment)) return false;
    if (target.size && !target.has(ex.target)) return false;
    return true;
  });

  state.page = 0;
  renderGrid();
  updateResultsBar();
  updateActiveBadges();
}

// ── Rendering ──────────────────────────────────────
function renderGrid() {
  gridEl.innerHTML = "";
  const slice = state.filtered.slice(0, state.pageSize);

  if (slice.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<p>🔍</p><p>تمرینی پیدا نشد</p>";
    gridEl.appendChild(empty);
    spinnerEl.classList.remove("visible");
    return;
  }

  const frag = document.createDocumentFragment();
  slice.forEach((ex) => frag.appendChild(createCard(ex)));
  gridEl.appendChild(frag);

  const hasMore = state.filtered.length > state.pageSize;
  spinnerEl.classList.toggle("visible", hasMore);
}

function appendNextPage() {
  state.page++;
  const start = state.page * state.pageSize;
  const end = start + state.pageSize;
  const slice = state.filtered.slice(start, end);
  if (slice.length === 0) return;

  const frag = document.createDocumentFragment();
  slice.forEach((ex) => frag.appendChild(createCard(ex)));
  gridEl.appendChild(frag);

  const hasMore = end < state.filtered.length;
  spinnerEl.classList.toggle("visible", hasMore);
}

function createCard(ex) {
  const article = document.createElement("article");
  article.className = "exercise-card";
  article.dataset.id = ex.id;

  // Media
  const media = document.createElement("div");
  media.className = "card-media";

  const thumb = document.createElement("img");
  thumb.className = "card-thumb";
  thumb.src = ex.image;
  thumb.alt = ex.name;
  thumb.loading = "lazy";

  const gif = document.createElement("img");
  gif.className = "card-gif";
  gif.dataset.src = ex.gif_url;
  gif.alt = "";

  media.appendChild(thumb);
  media.appendChild(gif);

  // Body
  const body = document.createElement("div");
  body.className = "card-body";

  const name = document.createElement("h3");
  name.className = "card-name";
  name.textContent = ex.name;

  const tags = document.createElement("div");
  tags.className = "card-tags rtl-text";

  const catTag = document.createElement("span");
  catTag.className = "tag tag-cat";
  catTag.textContent = ex.category;

  const equipTag = document.createElement("span");
  equipTag.className = "tag tag-equip";
  equipTag.textContent = ex.equipment;

  tags.appendChild(catTag);
  tags.appendChild(equipTag);
  body.appendChild(name);
  body.appendChild(tags);
  article.appendChild(media);
  article.appendChild(body);

  return article;
}

function renderSkeletons(count) {
  gridEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.innerHTML = `
        <div class="skeleton-media"></div>
        <div class="skeleton-body">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>`;
    frag.appendChild(card);
  }
  gridEl.appendChild(frag);
}

// ── Results Bar ────────────────────────────────────
function updateResultsBar() {
  const total = state.filtered.length;
  const all = state.exercises.length;
  countEl.textContent =
    total === all
      ? `${all.toLocaleString()} تمرین`
      : `${total.toLocaleString()} از ${all.toLocaleString()} تمرین`;
}

function updateActiveBadges() {
  activeFilEl.innerHTML = "";
  const { category, equipment, target } = state.filters;
  let hasAny = false;

  const addBadges = (set, key) => {
    set.forEach((val) => {
      hasAny = true;
      const badge = document.createElement("span");
      badge.className = "active-badge";
      badge.innerHTML = `${val}<button class="active-badge-remove" data-filter="${key}" data-value="${val}" aria-label="Remove ${val}">×</button>`;
      activeFilEl.appendChild(badge);
    });
  };

  addBadges(category, "category");
  addBadges(equipment, "equipment");
  addBadges(target, "target");

  if (hasAny) {
    const clearAll = document.createElement("button");
    clearAll.className = "clear-all";
    clearAll.textContent = "پاک کردن همه";
    clearAll.addEventListener("click", clearAllFilters);
    activeFilEl.appendChild(clearAll);
  }
}

function clearAllFilters() {
  state.filters.category.clear();
  state.filters.equipment.clear();
  state.filters.target.clear();
  state.search = "";
  searchEl.value = "";
  searchClearEl.classList.remove("visible");

  // Deactivate all chips
  document
    .querySelectorAll(".chip.active")
    .forEach((c) => c.classList.remove("active"));
  applyFilters();
}

// ── Modal ──────────────────────────────────────────
function openModal(id) {
  const ex = state.exercises.find((e) => e.id === id);
  if (!ex) return;

  modalTitle.textContent = ex.name;
  modalGif.src = ex.gif_url;
  modalGif.alt = ex.name;

  // Meta chips
  modalMeta.innerHTML = "";
  const metaItems = [
    { label: "قسمت بدن", value: ex.body_part || ex.category },
    { label: "تجهیزات", value: ex.equipment },
    { label: "هدف", value: ex.target },
  ];
  metaItems.forEach(({ label, value }) => {
    const chip = document.createElement("div");
    chip.className = "meta-chip";
    chip.innerHTML = `<span class="meta-chip-label">${label}</span><span class="meta-chip-value">${value}</span>`;
    modalMeta.appendChild(chip);
  });

  // Muscles
  modalMuscles.innerHTML = "";
  const primaryMuscles = ex.target ? [ex.target] : [];
  const secondaryRaw =
    ex.secondary_muscles || (ex.muscle_group ? [ex.muscle_group] : []);
  const secondaryMuscles = secondaryRaw.filter((m) => m !== ex.target);

  const musclesHeader = document.createElement("div");
  musclesHeader.className = "modal-muscles-label";
  musclesHeader.textContent = "عضلات";
  modalMuscles.appendChild(musclesHeader);

  const musclesGrid = document.createElement("div");
  musclesGrid.className = "muscles-grid";

  const makeMuscleGroup = (title, names, isPrimary) => {
    const group = document.createElement("div");
    group.className = "muscles-group";
    const lbl = document.createElement("div");
    lbl.className = "muscles-group-label";
    lbl.textContent = title;
    const row = document.createElement("div");
    row.className = "muscle-tags";
    names.forEach((name) => {
      const t = document.createElement("span");
      t.className = "muscle-tag" + (isPrimary ? " primary" : "");
      t.textContent = name;
      row.appendChild(t);
    });
    group.appendChild(lbl);
    group.appendChild(row);
    return group;
  };

  if (primaryMuscles.length > 0)
    musclesGrid.appendChild(makeMuscleGroup("اصلی", primaryMuscles, true));
  if (secondaryMuscles.length > 0)
    musclesGrid.appendChild(
      makeMuscleGroup("ثانوی", secondaryMuscles, false),
    );
  if (primaryMuscles.length > 0 || secondaryMuscles.length > 0)
    modalMuscles.appendChild(musclesGrid);

  // Instructions — format is always keyed by language code
  modalInstr.innerHTML = "";
  const LANG_LABELS = {
    fa: "فارسی",
    en: "English",  
  };
  const langs = [ "fa", "en"]
    .map((code) => ({ code, steps: ex.instruction_steps?.[code] ?? [] }))
    .filter((l) => l.steps.length > 0);

  if (langs.length > 0) {
    const instrLabel = document.createElement("span");
    instrLabel.className = "modal-instructions-label";
    instrLabel.textContent = "دستورالعمل";
    modalInstr.appendChild(instrLabel);

    const list = document.createElement("ol");
    list.className = "instructions-list";

    function renderSteps(steps, langCode) {
      list.innerHTML = "";
      list.classList.toggle("rtl", langCode === "fa");
      list.classList.toggle("ltr", langCode !== "fa");
      steps.forEach((step, i) => {
        const li = document.createElement("li");
        li.className = "instruction-step";
        li.innerHTML = `<span class="step-num">${i + 1}</span><span class="step-text">${step}</span>`;
        list.appendChild(li);
      });
    }

    if (langs.length > 1) {
      const tabs = document.createElement("div");
      tabs.className = "lang-tabs";
      const tabButtons = langs.map((l, i) => {
        const btn = document.createElement("button");
        btn.className = "lang-tab" + (i === 0 ? " active" : "");
        btn.textContent = LANG_LABELS[l.code] ?? l.code;
        tabs.appendChild(btn);
        return btn;
      });
      modalInstr.appendChild(tabs);

      tabButtons.forEach((btn, i) => {
        btn.addEventListener("click", () => {
          tabButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          renderSteps(langs[i].steps, langs[i].code);
        });
      });
    }

    renderSteps(langs[0].steps, langs[0].code);
    modalInstr.appendChild(list);
  }

  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  modalClose.focus();
}

function closeModal() {
  modalOverlay.classList.remove("open");
  document.body.style.overflow = "";
  modalGif.src = "";
}

// ── Events ─────────────────────────────────────────
function wireEvents() {
  // Search
  searchEl.addEventListener(
    "input",
    debounce(() => {
      state.search = searchEl.value;
      searchClearEl.classList.toggle("visible", state.search.length > 0);
      applyFilters();
    }, 250),
  );

  searchClearEl.addEventListener("click", () => {
    searchEl.value = "";
    state.search = "";
    searchClearEl.classList.remove("visible");
    applyFilters();
  });

  // Filter chips (delegated)
  document.querySelector(".sidebar-body").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip || chip.classList.contains("filter-show-more")) return;
    const { filter, value } = chip.dataset;
    toggleFilter(filter, value);
    chip.classList.toggle("active");
    applyFilters();
  });

  // Remove active badge
  activeFilEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".active-badge-remove");
    if (!btn) return;
    const { filter, value } = btn.dataset;
    state.filters[filter].delete(value);
    // Deactivate corresponding chip
    const chip = document.querySelector(
      `.chip[data-filter="${filter}"][data-value="${value}"]`,
    );
    if (chip) chip.classList.remove("active");
    applyFilters();
  });

  // Card hover → load GIF
  gridEl.addEventListener("mouseover", (e) => {
    const card = e.target.closest(".exercise-card");
    if (!card) return;
    const gif = card.querySelector(".card-gif");
    if (gif && gif.dataset.src && !gif.src) {
      gif.src = gif.dataset.src;
    }
  });

  // Card click → modal
  gridEl.addEventListener("click", (e) => {
    const card = e.target.closest(".exercise-card");
    if (card) openModal(card.dataset.id);
  });

  // Modal close
  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Infinite scroll
  const observer = new IntersectionObserver(
    (entries) => {
      if (
        entries[0].isIntersecting &&
        spinnerEl.classList.contains("visible")
      ) {
        appendNextPage();
      }
    },
    { rootMargin: "200px" },
  );
  observer.observe(sentinelEl);
}

// ── Boot ───────────────────────────────────────────
loadExercises();

// ══════════════════════════════════════════════════
// ── DB Setup ───────────────────────────────────────
// ══════════════════════════════════════════════════

const DB_SQL = {
  mssql: `CREATE TABLE exercises (
  id                NVARCHAR(10)  PRIMARY KEY,
  name              NVARCHAR(255) NOT NULL,
  category          NVARCHAR(100),
  body_part         NVARCHAR(100),
  equipment         NVARCHAR(100),
  instructions_en   NVARCHAR(MAX),
  instructions_fa   NVARCHAR(MAX),
  muscle_group      NVARCHAR(100),
  secondary_muscles NVARCHAR(MAX),  -- JSON array stored as string
  target            NVARCHAR(100),
  image             NVARCHAR(500),
  gif_url           NVARCHAR(500),
  created_at        DATETIME2
);`,
  postgresql: `CREATE TABLE exercises (
  id                VARCHAR(10)  PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  category          VARCHAR(100),
  body_part         VARCHAR(100),
  equipment         VARCHAR(100),
  instructions_en   TEXT,
  instructions_fa   TEXT,
  muscle_group      VARCHAR(100),
  secondary_muscles JSONB,
  target            VARCHAR(100),
  image             VARCHAR(500),
  gif_url           VARCHAR(500),
  created_at        TIMESTAMPTZ
);`,
  mysql: `CREATE TABLE exercises (
  id                VARCHAR(10)  PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  category          VARCHAR(100),
  body_part         VARCHAR(100),
  equipment         VARCHAR(100),
  instructions_en   TEXT,
  instructions_fa   TEXT,
  muscle_group      VARCHAR(100),
  secondary_muscles JSON,
  target            VARCHAR(100),
  image             VARCHAR(500),
  gif_url           VARCHAR(500),
  created_at        DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  sqlite: `CREATE TABLE exercises (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  category          TEXT,
  body_part         TEXT,
  equipment         TEXT,
  instructions_en   TEXT,
  instructions_fa   TEXT,
  muscle_group      TEXT,
  secondary_muscles TEXT,  -- JSON array stored as string
  target            TEXT,
  image             TEXT,
  gif_url           TEXT,
  created_at        TEXT
);`,
};

let currentDb = "mssql";

const dbOverlay = document.getElementById("db-overlay");
const dbOpenBtn = document.getElementById("db-setup-open");
const dbCloseBtn = document.getElementById("db-setup-close");
const dbTabs = document.querySelectorAll(".db-tab");
const createSqlEl = document.getElementById("create-table-sql");
const copyCreateBtn = document.getElementById("copy-create-btn");
const generateBtn = document.getElementById("generate-sql-btn");
const generateStatus = document.getElementById("generate-status");

function openDbSetup() {
  dbOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  switchDbTab(currentDb);
}

function closeDbSetup() {
  dbOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

function switchDbTab(db) {
  currentDb = db;
  dbTabs.forEach((t) => t.classList.toggle("active", t.dataset.db === db));
  createSqlEl.textContent = DB_SQL[db];
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copy";
      btn.classList.remove("copied");
    }, 2000);
  });
}

function escStr(val, db) {
  if (val === null || val === undefined) return "NULL";
  const s = String(val).replace(/'/g, "''");
  return db === "mssql" ? `N'${s}'` : `'${s}'`;
}

function buildInserts(exercises, db) {
  const lines = [];
  const header = db === "mssql" ? "BEGIN TRANSACTION;\nGO\n" : "BEGIN;\n";
  const footer = db === "mssql" ? "\nCOMMIT;\nGO" : "\nCOMMIT;";
  lines.push(header);

  exercises.forEach((ex, i) => {
    const muscles = JSON.stringify(
      Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles : [],
    );
    const instrEn =
      ex.instructions && ex.instructions.en
        ? ex.instructions.en
        : Array.isArray(ex.instruction_steps)
          ? ex.instruction_steps.join(" ")
          : ex.instructions || "";
    const instrFa =
      ex.instructions && ex.instructions.fa ? ex.instructions.fa : "";

    const vals = [
      escStr(ex.id, db),
      escStr(ex.name, db),
      escStr(ex.category, db),
      escStr(ex.body_part, db),
      escStr(ex.equipment, db),
      escStr(instrEn, db),
      escStr(instrFa, db),    
      escStr(ex.muscle_group, db),
      escStr(muscles, db),
      escStr(ex.target, db),
      escStr(ex.image, db),
      escStr(ex.gif_url, db),
      escStr(ex.created_at, db),
    ].join(", ");

    lines.push(
      `INSERT INTO exercises (id, name, category, body_part, equipment, instructions_en, instructions_fa, muscle_group, secondary_muscles, target, image, gif_url, created_at) VALUES (${vals});`,
    );

    // Batch commits every 50 rows for MSSQL compatibility
    if (db === "mssql" && (i + 1) % 50 === 0 && i + 1 < exercises.length) {
      lines.push("GO");
    }
  });

  lines.push(footer);
  return lines.join("\n");
}

function generateInsertSql() {
  generateBtn.disabled = true;
  generateStatus.textContent = "Generating…";

  setTimeout(() => {
    try {
      const sql = buildInserts(EXERCISES, currentDb);
      const blob = new Blob([sql], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exercises_insert_${currentDb}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      generateStatus.textContent = `✓ Downloaded exercises_insert_${currentDb}.sql`;
    } catch (e) {
      generateStatus.textContent = "Error generating file.";
      console.error(e);
    }
    generateBtn.disabled = false;
  }, 10);
}

// Wire DB Setup events
dbOpenBtn.addEventListener("click", openDbSetup);
dbCloseBtn.addEventListener("click", closeDbSetup);
dbOverlay.addEventListener("click", (e) => {
  if (e.target === dbOverlay) closeDbSetup();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dbOverlay.classList.contains("open"))
    closeDbSetup();
});
dbTabs.forEach((tab) =>
  tab.addEventListener("click", () => switchDbTab(tab.dataset.db)),
);
copyCreateBtn.addEventListener("click", () =>
  copyToClipboard(DB_SQL[currentDb], copyCreateBtn),
);
generateBtn.addEventListener("click", generateInsertSql);

// PWA Install Prompt
let deferredPrompt;
const installPromptDismissed = localStorage.getItem('installPromptDismissed');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    if (!installPromptDismissed) {
        showInstallPrompt();
    }
});

function showInstallPrompt() {
    const prompt = document.createElement('div');
    prompt.className = 'install-prompt';
    prompt.innerHTML = `
        <div class="install-prompt-text">
            <div class="install-prompt-title">📱 نصب اپلیکیشن</div>
        </div>
        <button class="install-btn" id="installBtn">نصب</button>
        <button class="close-install" id="closeInstall">✕</button>
    `;
    document.body.appendChild(prompt);

    document.getElementById('installBtn').addEventListener('click', async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const {outcome} = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        }

        deferredPrompt = null;
        prompt.remove();
    });

    document.getElementById('closeInstall').addEventListener('click', () => {
        localStorage.setItem('installPromptDismissed', 'true');
        prompt.remove();
    });
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    let newWorker;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered:', registration);

                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60000); // Check every minute

                // Listen for waiting worker
                registration.addEventListener('updatefound', () => {
                    newWorker = registration.installing;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker is ready
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch(err => {
                console.log('SW registration failed:', err);
            });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                showUpdateNotification();
            }
        });

        // Handle controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    });

    // Show update notification
    function showUpdateNotification() {
        const notification = document.getElementById('updateNotification');
        if (notification) {
            notification.classList.remove('hidden');
            notification.classList.add('show');
        }
    }

    // Handle update button click
    document.addEventListener('DOMContentLoaded', () => {
        const updateButton = document.getElementById('updateButton');
        const dismissButton = document.getElementById('dismissUpdate');
        const notification = document.getElementById('updateNotification');

        if (updateButton) {
            updateButton.addEventListener('click', () => {
                // Clear all caches and reload
                if ('caches' in window) {
                    caches.keys().then(names => {
                        names.forEach(name => {
                            caches.delete(name);
                        });
                    }).then(() => {
                        // Tell the service worker to skip waiting
                        if (newWorker) {
                            newWorker.postMessage({type: 'SKIP_WAITING'});
                        } else {
                            window.location.reload();
                        }
                    });
                } else {
                    window.location.reload();
                }
            });
        }

        if (dismissButton) {
            dismissButton.addEventListener('click', () => {
                notification.classList.remove('show');
                notification.classList.add('hidden');
            });
        }
    });
}

// Handle app installation
window.addEventListener('appinstalled', () => {
    console.log('App installed successfully');
    deferredPrompt = null;
});