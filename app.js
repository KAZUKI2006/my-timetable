/* ============================================================
   CONSTANTS
   ============================================================ */
const DAYS    = ['', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_JA  = { 1:'MONDAY', 2:'TUESDAY', 3:'WEDNESDAY', 4:'THURSDAY', 5:'FRIDAY', 6:'SATURDAY' };
const SEM_JA  = ['spring term', 'autumn term', '集中講義'];
const PERIODS = [
  { n:1, t:'9:00\n10:30'   },
  { n:2, t:'10:40\n12:10'  },
  { n:3, t:'13:00\n14:30'  },
  { n:4, t:'14:40\n16:10'  },
  { n:5, t:'16:20\n17:50'  },
];
const TYPE_CLASS = { required:'cc-required', elective:'cc-elective', free:'cc-free' };
const TYPE_COLOR = { required:'#71b8ee', elective:'#96e065', free:'#FAC775' };
const TYPE_LABEL = { required:'compulsory', elective:'option', free:'outside' };

/* ============================================================
   STATE
   ============================================================ */
let currentSem  = 0;
let editSlot    = null;
let isEdit      = false;
let currentYear = 3;

/* ============================================================
   STORAGE
   ============================================================ */
function storeKey(s)    { return `jikanwari_v3_sem${s}_year${currentYear}`; }
function ondemandKey(s) { return `ondemand_sem${s}_year${currentYear}`; }

async function loadSem(s) {
  try {
    const result = await window.storage.get(storeKey(s));
    return result ? JSON.parse(result.value) : {};
  } catch(e) { return {}; }
}

async function saveSem(s, d) {
  try { await window.storage.set(storeKey(s), JSON.stringify(d)); }
  catch(e) {}
}

async function loadOndemand(s) {
  try {
    const result = await window.storage.get(ondemandKey(s));
    return result ? JSON.parse(result.value) : [];
  } catch(e) { return []; }
}

async function saveOndemand(s, d) {
  try { await window.storage.set(ondemandKey(s), JSON.stringify(d)); }
  catch(e) {}
}

/* ============================================================
   HELPERS
   ============================================================ */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  e.className = cls;
  if (txt) e.textContent = txt;
  return e;
}

/* ============================================================
   GRID
   ============================================================ */
async function buildGrid(semIdx) {
  const data = await loadSem(semIdx);
  const grid = document.getElementById('tt-grid');
  grid.innerHTML = '';

  grid.appendChild(el('div', 'day-hd', 'period'));
  for (let d = 1; d <= 6; d++) {
    const hd = el('div', d === 6 ? 'day-hd sat-hd' : 'day-hd', DAYS[d]);
    grid.appendChild(hd);
  }

  PERIODS.forEach(p => {
    const lbl = document.createElement('div');
    lbl.className = 'period-lbl';
    lbl.innerHTML = `<span class="pn">${p.n}</span><span class="pt">${p.t.replace('\n','<br>')}</span>`;
    grid.appendChild(lbl);

    for (let d = 1; d <= 6; d++) {
      const key    = `${d}-${p.n}`;
      const course = data[key];
      const cell   = document.createElement('div');

      if (course) {
        cell.className = 'tt-cell';
        const card = document.createElement('div');
        card.className = 'course-card ' + (TYPE_CLASS[course.type] || 'cc-required');
        card.innerHTML = `
          <span class="cn">${esc(course.name)}</span>
          <span class="cr">${esc(course.room || '')}</span>
          <div class="cdot"></div>
        `;
        card.addEventListener('mouseenter', (e) => showTooltip(e, course));
        card.addEventListener('mousemove',  (e) => moveTooltip(e));
        card.addEventListener('mouseleave', ()  => hideTooltip());
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          openEdit(key, course, p, d);
        });
        cell.appendChild(card);
      } else {
        cell.className = 'tt-cell empty';
        cell.addEventListener('click', () => openAdd(key, p, d));
      }
      grid.appendChild(cell);
    }
  });

  await updateStats(semIdx);
  await buildOndemand(semIdx);
}

/* ============================================================
   ONDEMAND
   ============================================================ */
async function buildOndemand(semIdx) {
  const data = await loadOndemand(semIdx);
  const wrap = document.getElementById('od-cards');
  wrap.innerHTML = '';

  data.forEach((course, idx) => {
    const card = document.createElement('div');
    card.className = 'course-card ' + (TYPE_CLASS[course.type] || 'cc-required');
    card.style.width = '160px';
    card.style.height = '72px';
    card.style.flexShrink = '0';
    card.innerHTML = `
      <span class="cn">${esc(course.name)}</span>
      <span class="cr">${esc(course.room || '')}</span>
      <div class="cdot"></div>
    `;
    card.addEventListener('mouseenter', (e) => showTooltip(e, course));
    card.addEventListener('mousemove',  (e) => moveTooltip(e));
    card.addEventListener('mouseleave', ()  => hideTooltip());
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditOndemand(idx, course);
    });
    wrap.appendChild(card);
  });

  const addBtn = document.createElement('div');
  addBtn.className = 'od-add-btn';
  addBtn.textContent = '＋';
  addBtn.addEventListener('click', () => openAddOndemand());
  wrap.appendChild(addBtn);
}

/* ============================================================
   STATS
   ============================================================ */
async function updateStats(semIdx) {
  const vals = Object.values(await loadSem(semIdx));
  const cr   = vals.reduce((a, v) => a + parseInt(v.credits || 2), 0);
  document.getElementById('cnt-courses').textContent  = vals.length;
  document.getElementById('cnt-required').textContent = vals.filter(v => v.type === 'required').length;
  document.getElementById('cnt-elective').textContent = vals.filter(v => v.type === 'elective').length;
  document.getElementById('cnt-credits').textContent  = cr;

  let totalYear = 0;
  for (let s = 0; s < 3; s++) {
    const v = Object.values(await loadSem(s));
    totalYear += v.reduce((a, c) => a + parseInt(c.credits || 2), 0);
  }
  document.getElementById('cnt-fullyear').textContent = totalYear;

  let totalAll = 0;
  for (let yr = 1; yr <= 4; yr++) {
    const tmp = currentYear;
    currentYear = yr;
    for (let s = 0; s < 3; s++) {
      const v = Object.values(await loadSem(s));
      totalAll += v.reduce((a, c) => a + parseInt(c.credits || 2), 0);
    }
    currentYear = tmp;
  }
  document.getElementById('total-credits').textContent = totalAll;
}

/* ============================================================
   TOOLTIP
   ============================================================ */
const tipEl = document.getElementById('tooltip');

function showTooltip(e, course) {
  document.getElementById('tip-name').textContent = course.name;
  document.getElementById('tip-room').textContent = course.room || course.teacher || '';
  document.getElementById('tip-dot').style.background = TYPE_COLOR[course.type] || '#AFA9EC';
  document.getElementById('tip-type').textContent =
    (TYPE_LABEL[course.type] || '') + ' · ' + (course.credits || 2) + '単位';
  moveTooltip(e);
  tipEl.classList.add('show');
}

function moveTooltip(e) {
  const tw = 200, th = 80;
  let x = e.clientX + 14;
  let y = e.clientY - 10;
  if (x + tw > window.innerWidth  - 8) x = e.clientX - tw - 14;
  if (y + th > window.innerHeight - 8) y = e.clientY - th - 10;
  tipEl.style.left = x + 'px';
  tipEl.style.top  = y + 'px';
}

function hideTooltip() { tipEl.classList.remove('show'); }

/* ============================================================
   POPUP
   ============================================================ */
function positionPopup() {
  const pw = 270, ph = 440;
  const wrap = document.getElementById('popup-wrap');
  let x = window.innerWidth  / 2 - pw / 2;
  let y = window.innerHeight / 2 - ph / 2;
  if (y < 8) y = 8;
  wrap.style.left = x + 'px';
  wrap.style.top  = y + 'px';
}

function openAdd(key, p, d) {
  isEdit = false;
  editSlot = key;
  document.getElementById('popup-title').textContent     = '授業を追加';
  document.getElementById('popup-slot-info').textContent = `${SEM_JA[currentSem]} · ${DAY_JA[d]} ${p.n}限`;
  document.getElementById('f-name').value    = '';
  document.getElementById('f-class').value   = '';
  document.getElementById('f-room').value    = '';
  document.getElementById('f-teacher').value = '';
  document.getElementById('f-credits').value = '2';
  document.getElementById('f-type').value    = 'required';
  document.getElementById('btn-delete').style.display = 'none';
  showPopup();
  setTimeout(() => document.getElementById('f-name').focus(), 60);
}

function openEdit(key, course, p, d) {
  isEdit = true;
  editSlot = key;
  document.getElementById('popup-title').textContent     = '授業を編集';
  document.getElementById('popup-slot-info').textContent = `${SEM_JA[currentSem]} · ${DAY_JA[d]} ${p.n}限`;
  document.getElementById('f-name').value    = course.name    || '';
  document.getElementById('f-class').value   = course.class   || '';
  document.getElementById('f-room').value    = course.room    || '';
  document.getElementById('f-teacher').value = course.teacher || '';
  document.getElementById('f-credits').value = course.credits || '2';
  document.getElementById('f-type').value    = course.type    || 'required';
  document.getElementById('btn-delete').style.display = '';
  showPopup();
  setTimeout(() => document.getElementById('f-name').focus(), 60);
}

function openAddOndemand() {
  isEdit = false;
  editSlot = '__ondemand_new__';
  document.getElementById('popup-title').textContent     = 'オンデマンド授業を追加';
  document.getElementById('popup-slot-info').textContent = `${SEM_JA[currentSem]} · オンデマンド`;
  document.getElementById('f-name').value    = '';
  document.getElementById('f-class').value   = '';
  document.getElementById('f-room').value    = '';
  document.getElementById('f-teacher').value = '';
  document.getElementById('f-credits').value = '2';
  document.getElementById('f-type').value    = 'required';
  document.getElementById('btn-delete').style.display = 'none';
  showPopup();
  setTimeout(() => document.getElementById('f-name').focus(), 60);
}

function openEditOndemand(idx, course) {
  isEdit = true;
  editSlot = `__ondemand_${idx}__`;
  document.getElementById('popup-title').textContent     = 'オンデマンド授業を編集';
  document.getElementById('popup-slot-info').textContent = `${SEM_JA[currentSem]} · オンデマンド`;
  document.getElementById('f-name').value    = course.name    || '';
  document.getElementById('f-class').value   = course.class   || '';
  document.getElementById('f-room').value    = course.room    || '';
  document.getElementById('f-teacher').value = course.teacher || '';
  document.getElementById('f-credits').value = course.credits || '2';
  document.getElementById('f-type').value    = course.type    || 'required';
  document.getElementById('btn-delete').style.display = '';
  showPopup();
  setTimeout(() => document.getElementById('f-name').focus(), 60);
}

function showPopup() {
  hideTooltip();
  positionPopup();
  document.getElementById('popup-wrap').classList.add('open');
  document.getElementById('popup-overlay').classList.add('open');
}

function closePopup() {
  document.getElementById('popup-wrap').classList.remove('open');
  document.getElementById('popup-overlay').classList.remove('open');
  editSlot = null;
}

async function saveCourse() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) {
    const inp = document.getElementById('f-name');
    inp.style.borderColor = '#E24B4A';
    inp.focus();
    setTimeout(() => { inp.style.borderColor = ''; }, 1200);
    return;
  }

  const course = {
    name,
    class:   document.getElementById('f-class').value.trim(),
    room:    document.getElementById('f-room').value.trim(),
    teacher: document.getElementById('f-teacher').value.trim(),
    credits: document.getElementById('f-credits').value,
    type:    document.getElementById('f-type').value,
  };

  if (editSlot === '__ondemand_new__') {
    const data = await loadOndemand(currentSem);
    data.push(course);
    await saveOndemand(currentSem, data);
    closePopup();
    await buildOndemand(currentSem);
  } else if (editSlot && editSlot.startsWith('__ondemand_')) {
    const idx = parseInt(editSlot.replace('__ondemand_', '').replace('__', ''));
    const data = await loadOndemand(currentSem);
    data[idx] = course;
    await saveOndemand(currentSem, data);
    closePopup();
    await buildOndemand(currentSem);
  } else {
    const data = await loadSem(currentSem);
    data[editSlot] = course;
    await saveSem(currentSem, data);
    closePopup();
    await buildGrid(currentSem);
  }
}

async function deleteCourse() {
  if (!editSlot) return;
  const name = document.getElementById('f-name').value;
  if (!confirm(`「${name}」を削除しますか？`)) return;

  if (editSlot && editSlot.startsWith('__ondemand_')) {
    const idx = parseInt(editSlot.replace('__ondemand_', '').replace('__', ''));
    const data = await loadOndemand(currentSem);
    data.splice(idx, 1);
    await saveOndemand(currentSem, data);
    closePopup();
    await buildOndemand(currentSem);
  } else {
    const data = await loadSem(currentSem);
    delete data[editSlot];
    await saveSem(currentSem, data);
    closePopup();
    await buildGrid(currentSem);
  }
}

async function switchSem(idx) {
  currentSem = idx;
  document.querySelectorAll('.sem-pill').forEach((p, i) => {
    p.classList.toggle('active', i === idx);
  });
  await buildGrid(idx);
}

async function switchYear(yr) {
  currentYear = yr;
  await buildGrid(currentSem);
}

/* ============================================================
   NAVBAR SCROLL SHRINK
   ============================================================ */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePopup();
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveCourse();
});

/* ============================================================
   OVERLAY DISMISS
   ============================================================ */
document.getElementById('popup-overlay').addEventListener('click', closePopup);

/* ============================================================
   INIT
   ============================================================ */
buildGrid(0);
