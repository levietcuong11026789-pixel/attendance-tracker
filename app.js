'use strict';
/* =============================================
   📝 SỔ ĐIỂM DANH — App Điểm Danh Học Sinh
   ============================================= */

// ── STATE ──
let appData = { classes: [], students: [], classStudents: [], attendance: {} };
let currentClassId = null;
let currentAttDate = '';
let summaryMonth = new Date().getMonth();
let summaryYear = new Date().getFullYear();
let pendingAppUpdateReload = false;

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  currentAttDate = todayStr();
  renderDashboard();
  registerSW();
  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  }, 700);
});

// ── SAMPLE DATA ──
function seedSampleData() {
  const ho = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Võ','Đặng','Bùi','Đỗ','Vũ','Phan','Ngô','Dương','Lý'];
  const dem = ['Văn','Thị','Đức','Minh','Hoàng','Thanh','Quốc','Ngọc','Hữu','Phương','Anh','Bảo','Xuân','Hồng','Tuấn'];
  const ten = ['An','Bình','Cường','Dũng','Em','Phúc','Giang','Hải','Khoa','Linh','Mai','Nam','Oanh','Phong','Quân','Sơn','Tâm','Uyên','Vân','Yến'];
  const mkName = () => ho[Math.random()*ho.length|0]+' '+dem[Math.random()*dem.length|0]+' '+ten[Math.random()*ten.length|0];
  const mkId = (p,i) => p+'_'+i;

  // 3 classes
  const classes = [
    {id:'c1',name:'Toán 9A',pricePerSession:50000,createdAt:Date.now()},
    {id:'c2',name:'Toán 10B',pricePerSession:60000,createdAt:Date.now()},
    {id:'c3',name:'Lý 11C',pricePerSession:55000,createdAt:Date.now()}
  ];

  // 45 students (15 per grade)
  const students = []; const classStudents = [];
  const grades = ['Khối 9','Khối 10','Khối 11'];
  const usedNames = new Set();
  grades.forEach((g, gi) => {
    for (let i = 0; i < 15; i++) {
      let name;
      do { name = mkName(); } while (usedNames.has(name));
      usedNames.add(name);
      const sid = mkId('s', gi * 15 + i);
      students.push({id:sid, name, grade:g, createdAt:Date.now()});
      classStudents.push({classId: classes[gi].id, studentId: sid});
    }
  });

  // Sample attendance: last 5 weekdays for each class
  const attendance = {};
  const today = new Date();
  let daysAdded = 0;
  for (let back = 0; back < 14 && daysAdded < 5; back++) {
    const d = new Date(today); d.setDate(d.getDate() - back);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    classes.forEach(cls => {
      const key = `${cls.id}_${ds}`;
      attendance[key] = {};
      classStudents.filter(cs => cs.classId === cls.id).forEach(cs => {
        attendance[key][cs.studentId] = Math.random() > 0.15; // 85% attendance
      });
    });
    daysAdded++;
  }

  appData = {classes, students, classStudents, attendance};
  saveData();
}

// ══════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
function formatMoney(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + ' tr';
  if (n >= 1e3) return Math.round(n / 1e3) + 'k';
  return n.toLocaleString('vi-VN');
}
function formatMoneyFull(n) { return n.toLocaleString('vi-VN') + ' đ'; }
// Student and attendance records stay in this browser's local storage; no cloud sync is used.
function saveData() { localStorage.setItem('att_app_data', JSON.stringify(appData)); }
function loadData() {
  try { const r = localStorage.getItem('att_app_data'); if (r) appData = JSON.parse(r); } catch (e) { /* ignore */ }
  if (!appData.classes) appData.classes = [];
  if (!appData.students) appData.students = [];
  if (!appData.classStudents) appData.classStudents = [];
  if (!appData.attendance) appData.attendance = {};
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.add('hidden'), 2500);
}

// ── MODAL HELPERS ──
function openModal(id) { document.getElementById(id).classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  // restore scroll if no other modals open
  const anyOpen = document.querySelector('.modal:not(.hidden)');
  if (!anyOpen) document.body.style.overflow = '';
  maybeReloadAfterAppUpdate();
}

// ══════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════
function renderDashboard() { renderDateDisplay(); renderHero(); renderClassList(); }
function toggleMobileNav() {
  const app = document.getElementById('app');
  const open = !app.classList.contains('mobile-nav-open');
  app.classList.toggle('mobile-nav-open', open);
  document.getElementById('mobile-menu-toggle')?.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeMobileNav() {
  document.getElementById('app')?.classList.remove('mobile-nav-open');
  document.getElementById('mobile-menu-toggle')?.setAttribute('aria-expanded', 'false');
  if (!document.querySelector('.modal:not(.hidden)')) document.body.style.overflow = '';
}
function setDashboardNav(button) {
  closeMobileNav();
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const active = link === button;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
function scrollToClasses() {
  document.getElementById('class-list-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function openFirstClassTab(tab) {
  if (!appData.classes.length) { showToast('Tạo nhóm lớp trước để bắt đầu.'); return; }
  openClassDetail(appData.classes[0].id);
  if (tab !== 'attendance') switchClassTab(tab);
}

function renderDateDisplay() {
  const d = new Date();
  const days = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  document.getElementById('date-display').textContent =
    `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

function renderHero() {
  const now = new Date(), m = now.getMonth(), y = now.getFullYear();
  let totalRevenue = 0;
  appData.classes.forEach(cls => {
    appData.classStudents.filter(cs => cs.classId === cls.id).forEach(cs => {
      totalRevenue += countSessions(cls.id, cs.studentId, m, y) * cls.pricePerSession;
    });
  });
  document.getElementById('hero-classes').textContent = appData.classes.length;
  document.getElementById('hero-students').textContent = appData.students.length;
  document.getElementById('hero-revenue').textContent = formatMoneyFull(totalRevenue);
}

function countSessions(classId, studentId, month, year) {
  let c = 0;
  const dim = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const k = `${classId}_${ds}`;
    if (appData.attendance[k] && appData.attendance[k][studentId] === true) c++;
  }
  return c;
}

function countClassDays(classId, month, year) {
  let c = 0;
  const dim = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (appData.attendance[`${classId}_${ds}`]) c++;
  }
  return c;
}

function emptyClassesMarkup() {
  return [
    '<div class="empty-classes">',
    '<svg class="empty-illustration" viewBox="0 0 520 245" role="img" aria-label="Minh họa một lớp học">',
    '<path d="M67 207c-28-18-25-58 10-70 1-34 41-55 73-36 18-37 73-45 103-13 31-25 78-15 91 18 34-22 82-3 82 38 34 13 37 48 7 63z" fill="#e8f2f9"/>',
    '<circle cx="104" cy="75" r="18" fill="#f4f9fc"/><circle cx="415" cy="65" r="22" fill="#f4f9fc"/>',
    '<rect x="82" y="41" width="91" height="88" rx="7" fill="#fff" stroke="#d8e8f2" stroke-width="4"/>',
    '<rect x="90" y="49" width="75" height="72" rx="3" fill="#dff3fc"/><path d="M127.5 49v72M90 85h75" stroke="#fff" stroke-width="4"/>',
    '<path d="M90 106c14-13 25-12 38 0 10-10 22-11 37 0v15H90z" fill="#9ed6a8"/>',
    '<rect x="240" y="36" width="172" height="111" rx="8" fill="#cf9559"/><rect x="248" y="43" width="156" height="95" rx="4" fill="#31826d"/>',
    '<path d="m326 66 31 14-31 14-31-14z" fill="none" stroke="#f5faf7" stroke-width="2"/><path d="M311 91v13c10 8 21 8 31 0V91m15-11v22m0 0-5 7m5-7 5 7" fill="none" stroke="#f5faf7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    '<rect x="232" y="144" width="188" height="8" rx="3" fill="#b87c46"/>',
    '<path d="M64 169c-3-24 10-40 27-42-1 18-7 33-27 42zm8 1c1-22 15-37 31-37 0 17-12 31-31 37zm8 4c8-19 25-27 39-21-6 16-20 25-39 21z" fill="#77ad70"/>',
    '<rect x="67" y="172" width="42" height="32" rx="7" fill="#d7a269"/><path d="M73 174h30l-4 26H77z" fill="#e3b37a"/>',
    '<rect x="196" y="153" width="178" height="13" rx="4" fill="#d99f65"/><rect x="181" y="165" width="208" height="13" rx="4" fill="#e6b780"/>',
    '<path d="M199 177h12v42h-12zm169 0h12v42h-12z" fill="#c88b52"/>',
    '<rect x="214" y="140" width="54" height="9" rx="3" fill="#4c89c0"/><rect x="220" y="131" width="48" height="8" rx="3" fill="#f1c36f"/><rect x="226" y="122" width="42" height="8" rx="3" fill="#e67d68"/>',
    '<path d="M286 130h23l-3 22h-17z" fill="#f5f7f8" stroke="#d7e2e8" stroke-width="2"/><path d="m291 130 1-21m7 21 7-25m-3 25 3-16" stroke="#df9a54" stroke-width="3" stroke-linecap="round"/>',
    '<path d="M149 184h40v8h-40zm182 0h40v8h-40z" fill="#d99f65"/><path d="M155 192v29m29-29v29m153-29v29m29-29v29" stroke="#c88b52" stroke-width="5" stroke-linecap="round"/>',
    '</svg>',
    '<p class="empty-classes-message">Chưa có nhóm lớp nào. Tạo nhóm lớp đầu tiên để bắt đầu theo dõi.</p>',
    '</div>'
  ].join('');
}
function renderClassList() {
  const el = document.getElementById('class-list');
  if (!appData.classes.length) {
    el.innerHTML = emptyClassesMarkup();
    return;
  }
  const now = new Date(), m = now.getMonth(), y = now.getFullYear();
  el.innerHTML = appData.classes.map(cls => {
    const sc = appData.classStudents.filter(cs => cs.classId === cls.id).length;
    const cd = countClassDays(cls.id, m, y);
    let rev = 0;
    appData.classStudents.filter(cs => cs.classId === cls.id).forEach(cs => {
      rev += countSessions(cls.id, cs.studentId, m, y) * cls.pricePerSession;
    });
    return `<div class="class-card" onclick="openClassDetail('${cls.id}')">
      <div class="cc-header">
        <div class="cc-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8"/></svg></div>
        <div class="cc-info"><div class="cc-name">${escapeHtml(cls.name)}</div><div class="cc-meta">${formatMoneyFull(cls.pricePerSession)}/buổi</div></div>
        <button class="cc-edit-btn" onclick="event.stopPropagation();openEditClassModal('${cls.id}')" title="Sửa">Sửa</button>
      </div>
      <div class="cc-stats">
        <div class="cc-stat"><span class="cc-stat-val">${sc}</span><span class="cc-stat-lbl">Học sinh</span></div>
        <div class="cc-stat"><span class="cc-stat-val">${cd}</span><span class="cc-stat-lbl">Buổi học</span></div>
        <div class="cc-stat"><span class="cc-stat-val">${formatMoney(rev)}</span><span class="cc-stat-lbl">Học phí</span></div>
      </div></div>`;
  }).join('');
}

// ══════════════════════════════════════
//  CLASS CRUD
// ══════════════════════════════════════
function openAddClassModal() {
  document.getElementById('class-modal-title').textContent = 'Tạo nhóm lớp';
  document.getElementById('class-name').value = '';
  document.getElementById('class-price').value = '';
  document.getElementById('class-modal').dataset.editId = '';
  document.getElementById('class-delete-btn').classList.add('hidden');
  openModal('class-modal');
}
function openEditClassModal(id) {
  const cls = appData.classes.find(c => c.id === id);
  if (!cls) return;
  document.getElementById('class-modal-title').textContent = 'Sửa nhóm lớp';
  document.getElementById('class-name').value = cls.name;
  document.getElementById('class-price').value = cls.pricePerSession;
  document.getElementById('class-modal').dataset.editId = id;
  document.getElementById('class-delete-btn').classList.remove('hidden');
  openModal('class-modal');
}
function saveClass() {
  const name = document.getElementById('class-name').value.trim();
  const priceRaw = document.getElementById('class-price').value.replace(/[^\d]/g, '');
  const price = parseInt(priceRaw) || 0;
  if (!name) { showToast('Nhập tên lớp!'); return; }
  if (price <= 0) { showToast('Nhập giá tiền/buổi!'); return; }
  const eid = document.getElementById('class-modal').dataset.editId;
  if (eid) {
    const c = appData.classes.find(x => x.id === eid);
    if (c) { c.name = name; c.pricePerSession = price; }
    showToast('Đã cập nhật lớp!');
  } else {
    appData.classes.push({ id: generateId(), name, pricePerSession: price, createdAt: Date.now() });
    showToast('Đã tạo lớp mới!');
  }
  saveData(); renderDashboard(); closeModal('class-modal');
}
function deleteClass() {
  const eid = document.getElementById('class-modal').dataset.editId;
  if (!eid || !confirm('Xóa lớp này? Dữ liệu điểm danh cũng sẽ mất!')) return;
  appData.classes = appData.classes.filter(c => c.id !== eid);
  appData.classStudents = appData.classStudents.filter(cs => cs.classId !== eid);
  Object.keys(appData.attendance).forEach(k => { if (k.startsWith(eid + '_')) delete appData.attendance[k]; });
  saveData(); renderDashboard(); closeModal('class-modal');
  showToast('Xóa Đã xóa lớp!');
}

// ══════════════════════════════════════
//  STUDENT CRUD
// ══════════════════════════════════════
function openStudentManager() { renderStudentManager(); openModal('student-manager-modal'); }
function renderStudentManager() {
  const fv = document.getElementById('student-filter')?.value || 'all';
  const grades = [...new Set(appData.students.map(s => s.grade))].sort();
  const fe = document.getElementById('student-filter');
  if (fe) {
    const cur = fe.value;
    fe.innerHTML = '<option value="all">Tất cả khối</option>' + grades.map(g => `<option value="${escapeHtml(g)}" ${cur===g?'selected':''}>${escapeHtml(g)}</option>`).join('');
  }
  let list = [...appData.students];
  if (fv !== 'all') list = list.filter(s => s.grade === fv);
  const el = document.getElementById('student-list');
  if (!list.length) { el.innerHTML = '<div class="empty-msg">Chưa có học sinh nào 📝</div>'; return; }
  el.innerHTML = list.map(s => {
    const cc = appData.classStudents.filter(cs => cs.studentId === s.id).length;
    return `<div class="stu-row"><div class="stu-info"><div class="stu-name">${escapeHtml(s.name)}</div><div class="stu-meta">${escapeHtml(s.grade)} · ${cc} lớp</div></div>
      <div class="stu-actions"><button class="stu-btn stu-edit" onclick="openEditStudentModal('${s.id}')">Sửa</button><button class="stu-btn stu-del" onclick="deleteStudent('${s.id}')">Xóa</button></div></div>`;
  }).join('');
}
function openAddStudentModal() {
  document.getElementById('add-stu-title').textContent = 'Thêm học sinh';
  document.getElementById('stu-name').value = '';
  document.getElementById('stu-grade').value = '';
  document.getElementById('add-student-modal').dataset.editId = '';
  openModal('add-student-modal');
}
function openEditStudentModal(id) {
  const s = appData.students.find(x => x.id === id);
  if (!s) return;
  document.getElementById('add-stu-title').textContent = 'Sửa học sinh';
  document.getElementById('stu-name').value = s.name;
  document.getElementById('stu-grade').value = s.grade;
  document.getElementById('add-student-modal').dataset.editId = id;
  openModal('add-student-modal');
}
function saveStudent() {
  const name = document.getElementById('stu-name').value.trim();
  const grade = document.getElementById('stu-grade').value.trim();
  if (!name) { showToast('Nhập tên HS!'); return; }
  if (!grade) { showToast('Nhập khối lớp!'); return; }
  const eid = document.getElementById('add-student-modal').dataset.editId;
  if (eid) {
    const s = appData.students.find(x => x.id === eid);
    if (s) { s.name = name; s.grade = grade; }
    showToast('Đã cập nhật!');
  } else {
    appData.students.push({ id: generateId(), name, grade, createdAt: Date.now() });
    showToast('Đã thêm HS!');
  }
  saveData(); renderStudentManager(); renderDashboard(); closeModal('add-student-modal');
}
function deleteStudent(id) {
  if (!confirm('Xóa học sinh này?')) return;
  appData.students = appData.students.filter(s => s.id !== id);
  appData.classStudents = appData.classStudents.filter(cs => cs.studentId !== id);
  saveData(); renderStudentManager(); renderDashboard();
  showToast('Xóa Đã xóa!');
}

// ══════════════════════════════════════
//  CLASS DETAIL
// ══════════════════════════════════════
function openClassDetail(classId) {
  currentClassId = classId;
  currentAttDate = todayStr();
  const now = new Date(); summaryMonth = now.getMonth(); summaryYear = now.getFullYear();
  const cls = appData.classes.find(c => c.id === classId);
  if (!cls) return;
  document.getElementById('detail-class-name').textContent = cls.name;
  document.getElementById('detail-class-price').textContent = formatMoneyFull(cls.pricePerSession) + '/buổi';
  document.getElementById('att-date').value = currentAttDate;
  // Reset tabs
  document.querySelectorAll('.cd-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.cd-tab[data-tab="attendance"]').classList.add('active');
  document.querySelectorAll('.cd-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-attendance').classList.remove('hidden');
  renderAttendance();
  openModal('class-detail-modal');
}
function switchClassTab(tab) {
  document.querySelectorAll('.cd-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.cd-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-' + tab).classList.remove('hidden');
  if (tab === 'attendance') renderAttendance();
  if (tab === 'students') renderClassStudents();
  if (tab === 'monthly') renderMonthlySummary();
}

// ══════════════════════════════════════
//  ATTENDANCE
// ══════════════════════════════════════
function renderAttendance() {
  if (!currentClassId) return;
  const date = document.getElementById('att-date').value || todayStr();
  currentAttDate = date;
  const stus = appData.classStudents.filter(cs => cs.classId === currentClassId)
    .map(cs => appData.students.find(s => s.id === cs.studentId)).filter(Boolean);
  const el = document.getElementById('att-list');
  if (!stus.length) {
    el.innerHTML = '<div class="empty-msg">Chưa có học sinh trong nhóm này. Chuyển sang tab Học sinh để thêm.</div>';
    document.getElementById('att-summary').innerHTML = '';
    return;
  }
  const k = `${currentClassId}_${date}`;
  const dd = appData.attendance[k] || {};
  let pc = 0, ac = 0, pending = 0;
  stus.forEach(s => {
    if (dd[s.id] === true) pc++;
    else if (dd[s.id] === false) ac++;
    else pending++;
  });
  document.getElementById('att-summary').innerHTML =
    `<span class="att-present">${pc} có mặt</span><span class="att-absent">${ac} vắng</span><span class="att-pending">○ ${pending} chưa điểm danh</span>`;
  el.innerHTML = stus.map((s, i) => {
    const status = dd[s.id];
    const rowState = status === true ? 'att-present-row' : status === false ? 'att-absent-row' : 'att-unmarked-row';
    return `<div class="att-row ${rowState}">
      <div class="att-num">${i + 1}</div>
      <div class="att-info"><div class="att-name">${escapeHtml(s.name)}</div><div class="att-grade">${escapeHtml(s.grade)}</div></div>
      <div class="att-status-controls" role="group" aria-label="Điểm danh ${escapeHtml(s.name)}">
        <button type="button" class="att-status-btn att-status-present ${status === true ? 'selected' : ''}" aria-pressed="${status === true}" onclick="setAttendance('${s.id}', true)">✓ Có mặt</button>
        <button type="button" class="att-status-btn att-status-absent ${status === false ? 'selected' : ''}" aria-pressed="${status === false}" onclick="setAttendance('${s.id}', false)">✕ Vắng</button>
      </div></div>`;
  }).join('');
}
function setAttendance(sid, present) {
  const k = `${currentClassId}_${currentAttDate}`;
  if (appData.attendance[k]?.[sid] === present) return;
  if (!appData.attendance[k]) appData.attendance[k] = {};
  appData.attendance[k][sid] = present;
  saveData(); renderAttendance(); renderDashboard();
}
function onAttDateChange() { currentAttDate = document.getElementById('att-date').value; renderAttendance(); }
function markAllPresent() {
  const k = `${currentClassId}_${currentAttDate}`;
  if (!appData.attendance[k]) appData.attendance[k] = {};
  appData.classStudents.filter(cs => cs.classId === currentClassId).forEach(cs => { appData.attendance[k][cs.studentId] = true; });
  saveData(); renderAttendance(); renderDashboard(); showToast('Tất cả có mặt!');
}
function markAllAbsent() {
  const k = `${currentClassId}_${currentAttDate}`;
  if (!appData.attendance[k]) appData.attendance[k] = {};
  appData.classStudents.filter(cs => cs.classId === currentClassId).forEach(cs => { appData.attendance[k][cs.studentId] = false; });
  saveData(); renderAttendance(); renderDashboard(); showToast('Tất cả vắng!');
}

// ══════════════════════════════════════
//  CLASS STUDENTS
// ══════════════════════════════════════
function renderClassStudents() {
  if (!currentClassId) return;
  const stus = appData.classStudents.filter(cs => cs.classId === currentClassId)
    .map(cs => appData.students.find(s => s.id === cs.studentId)).filter(Boolean);
  document.getElementById('class-stu-count').textContent = `${stus.length} học sinh`;
  const el = document.getElementById('class-students-list');
  if (!stus.length) { el.innerHTML = '<div class="empty-msg">Chưa có học sinh trong nhóm này.</div>'; return; }
  el.innerHTML = stus.map((s, i) => `<div class="stu-row">
    <div class="stu-num">${i + 1}</div>
    <div class="stu-info"><div class="stu-name">${escapeHtml(s.name)}</div><div class="stu-meta">${escapeHtml(s.grade)}</div></div>
    <button class="stu-btn stu-del" onclick="removeFromClass('${s.id}')">✕</button></div>`).join('');
}
function removeFromClass(sid) {
  appData.classStudents = appData.classStudents.filter(cs => !(cs.classId === currentClassId && cs.studentId === sid));
  saveData(); renderClassStudents(); renderDashboard(); showToast('Đã xóa khỏi lớp!');
}

// ── ASSIGN STUDENTS ──
let pendingFileNames = [];

function openAssignModal() {
  // Reset tabs to "type" mode
  switchAssignTab('type');
  document.getElementById('batch-names').value = '';
  document.getElementById('batch-grade').value = '';
  document.getElementById('file-grade').value = '';
  document.getElementById('file-preview').classList.add('hidden');
  document.getElementById('file-input').value = '';
  pendingFileNames = [];
  renderAssignList();
  openModal('assign-modal');
}

function switchAssignTab(tab) {
  document.querySelectorAll('#assign-modal .cd-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.assign-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('assign-panel-' + tab).classList.remove('hidden');
  if (tab === 'pick') renderAssignList();
}

// TAB 1: Batch type names
function batchAddStudents() {
  const grade = document.getElementById('batch-grade').value.trim();
  const raw = document.getElementById('batch-names').value.trim();
  if (!grade) { showToast('Nhập khối lớp!'); return; }
  if (!raw) { showToast('Nhập tên học sinh!'); return; }
  const names = raw.split('\n').map(n => n.trim()).filter(n => n.length > 0);
  if (!names.length) { showToast('Không có tên nào!'); return; }
  let added = 0;
  names.forEach(name => {
    const sid = generateId();
    appData.students.push({ id: sid, name, grade, createdAt: Date.now() });
    appData.classStudents.push({ classId: currentClassId, studentId: sid });
    added++;
  });
  saveData(); renderClassStudents(); renderDashboard();
  document.getElementById('batch-names').value = '';
  showToast(`Đã thêm ${added} học sinh vào lớp!`);
}

// TAB 2: File import
function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const text = ev.target.result;
    pendingFileNames = text.split('\n').map(l => {
      // Handle CSV: take first column or whole line
      const parts = l.split(/[,;\t]/);
      return (parts[0] || '').trim();
    }).filter(n => n.length > 0 && !/^(stt|STT|#|họ|tên|name)/i.test(n));
    showFilePreview();
  };
  reader.readAsText(file, 'UTF-8');
}

function showFilePreview() {
  document.getElementById('file-preview').classList.remove('hidden');
  document.getElementById('file-count').textContent = pendingFileNames.length;
  document.getElementById('file-preview-list').innerHTML = pendingFileNames.map((n, i) =>
    `<div class="stu-row"><div class="stu-num">${i+1}</div><div class="stu-info"><div class="stu-name">${escapeHtml(n)}</div></div></div>`
  ).join('');
}

function confirmFileImport() {
  const grade = document.getElementById('file-grade').value.trim();
  if (!grade) { showToast('Nhập khối lớp!'); return; }
  if (!pendingFileNames.length) { showToast('Không có tên!'); return; }
  pendingFileNames.forEach(name => {
    const sid = generateId();
    appData.students.push({ id: sid, name, grade, createdAt: Date.now() });
    appData.classStudents.push({ classId: currentClassId, studentId: sid });
  });
  saveData(); renderClassStudents(); renderDashboard();
  showToast(`Đã thêm ${pendingFileNames.length} HS từ file!`);
  pendingFileNames = [];
  document.getElementById('file-preview').classList.add('hidden');
  document.getElementById('file-input').value = '';
}

// Drag & drop for file zone
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const zone = document.getElementById('file-drop-zone');
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) { document.getElementById('file-input').files = e.dataTransfer.files; handleFileImport({target:{files:[file]}}); }
    });
  }, 1000);
});

// TAB 3: Pick existing
function renderAssignList() {
  const inClass = new Set(appData.classStudents.filter(cs => cs.classId === currentClassId).map(cs => cs.studentId));
  const fv = document.getElementById('assign-filter')?.value || 'all';
  const grades = [...new Set(appData.students.map(s => s.grade))].sort();
  const fe = document.getElementById('assign-filter');
  if (fe) {
    const cur = fe.value;
    fe.innerHTML = '<option value="all">Tất cả</option>' + grades.map(g => `<option value="${g}" ${cur===g?'selected':''}>${g}</option>`).join('');
  }
  let avail = appData.students.filter(s => !inClass.has(s.id));
  if (fv !== 'all') avail = avail.filter(s => s.grade === fv);
  const el = document.getElementById('assign-list');
  if (!avail.length) { el.innerHTML = '<div class="empty-msg">Không có học sinh để thêm. Hãy nhập tên hoặc chọn từ danh sách.</div>'; return; }
  el.innerHTML = avail.map(s => `<div class="assign-row" onclick="assignStudent('${s.id}')">
    <div class="stu-info"><div class="stu-name">${escapeHtml(s.name)}</div><div class="stu-meta">${escapeHtml(s.grade)}</div></div>
    <div class="assign-check">+</div></div>`).join('');
}
function assignStudent(sid) {
  const exists = appData.classStudents.find(cs => cs.classId === currentClassId && cs.studentId === sid);
  if (exists) return;
  appData.classStudents.push({ classId: currentClassId, studentId: sid });
  saveData(); renderAssignList(); renderClassStudents(); renderDashboard();
  showToast('Đã thêm vào lớp!');
}

// ══════════════════════════════════════
//  MONTHLY SUMMARY
// ══════════════════════════════════════
function renderMonthlySummary() {
  if (!currentClassId) return;
  const cls = appData.classes.find(c => c.id === currentClassId);
  if (!cls) return;
  const monthNames = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  document.getElementById('summary-month-label').textContent = `${monthNames[summaryMonth]} / ${summaryYear}`;

  const stus = appData.classStudents.filter(cs => cs.classId === currentClassId)
    .map(cs => appData.students.find(s => s.id === cs.studentId)).filter(Boolean);
  const wrap = document.getElementById('summary-table-wrap');
  const totalEl = document.getElementById('summary-total');

  if (!stus.length) {
    wrap.innerHTML = '<div class="empty-msg">Chưa có học sinh trong nhóm này.</div>';
    totalEl.innerHTML = '';
    return;
  }

  // Find which days had attendance recorded
  const dim = new Date(summaryYear, summaryMonth + 1, 0).getDate();
  const activeDays = [];
  for (let d = 1; d <= dim; d++) {
    const ds = `${summaryYear}-${String(summaryMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (appData.attendance[`${currentClassId}_${ds}`]) activeDays.push(d);
  }

  // Show marked attendance, absences, and unmarked dates separately.
  let html = '<table class="summary-table"><thead><tr><th>Học sinh</th>';
  activeDays.forEach(d => {
    const ds = `${summaryYear}-${String(summaryMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    html += `<th title="${ds}">${d}</th>`;
  });
  html += '<th>Có mặt</th><th>Vắng</th><th>Phải đóng</th></tr></thead><tbody>';

  let totalPresent = 0, totalAbsent = 0, grandTotal = 0;
  stus.forEach(s => {
    html += `<tr><td>${escapeHtml(s.name)}</td>`;
    let presentCount = 0, absentCount = 0;
    activeDays.forEach(d => {
      const ds = `${summaryYear}-${String(summaryMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const k = `${currentClassId}_${ds}`;
      const status = appData.attendance[k]?.[s.id];
      if (status === true) {
        presentCount++;
        html += '<td class="td-present">✓</td>';
      } else if (status === false) {
        absentCount++;
        html += '<td class="td-absent">✗</td>';
      } else {
        html += '<td class="td-pending">—</td>';
      }
    });
    const fee = presentCount * cls.pricePerSession;
    totalPresent += presentCount;
    totalAbsent += absentCount;
    grandTotal += fee;
    html += `<td class="td-total">${presentCount}</td><td class="td-absent-count">${absentCount}</td><td class="td-fee">${formatMoneyFull(fee)}</td></tr>`;
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;

  totalEl.innerHTML = `<div class="summary-metric"><span class="summary-metric-label">Buổi có mặt</span><strong>${totalPresent}</strong><small>Tổng theo học sinh</small></div>
    <div class="summary-metric"><span class="summary-metric-label">Lượt vắng</span><strong>${totalAbsent}</strong><small>Tổng theo học sinh</small></div>
    <div class="summary-metric summary-metric-fee"><span class="summary-metric-label">Học phí phải đóng</span><strong>${formatMoneyFull(grandTotal)}</strong><small>${monthNames[summaryMonth]}</small></div>`;
}

function summaryPrev() {
  summaryMonth--;
  if (summaryMonth < 0) { summaryMonth = 11; summaryYear--; }
  renderMonthlySummary();
}
function summaryNext() {
  summaryMonth++;
  if (summaryMonth > 11) { summaryMonth = 0; summaryYear++; }
  renderMonthlySummary();
}

// ══════════════════════════════════════
//  SERVICE WORKER & UPDATE
// ══════════════════════════════════════
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const pageWasAlreadyControlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!pageWasAlreadyControlled) return;
    pendingAppUpdateReload = true;
    maybeReloadAfterAppUpdate();
  });

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(registration => {
      const checkForUpdate = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      checkForUpdate();
      window.addEventListener('online', checkForUpdate);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    })
    .catch(() => {});
}
function maybeReloadAfterAppUpdate() {
  if (!pendingAppUpdateReload || document.querySelector('.modal:not(.hidden)')) return;
  pendingAppUpdateReload = false;
  window.location.reload();
}
