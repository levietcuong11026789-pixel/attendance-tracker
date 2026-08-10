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

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  if (!appData.classes.length && !appData.students.length) seedSampleData();
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
function formatMoney(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + ' tr';
  if (n >= 1e3) return Math.round(n / 1e3) + 'k';
  return n.toLocaleString('vi-VN');
}
function formatMoneyFull(n) { return n.toLocaleString('vi-VN') + ' đ'; }
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
}

// ══════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════
function renderDashboard() { renderDateDisplay(); renderHero(); renderClassList(); }

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

function renderClassList() {
  const el = document.getElementById('class-list');
  if (!appData.classes.length) {
    el.innerHTML = '<div class="empty-msg">Chưa có lớp nào. Nhấn ➕ để tạo lớp mới! 📚</div>';
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
        <div class="cc-icon">📚</div>
        <div class="cc-info"><div class="cc-name">${cls.name}</div><div class="cc-meta">${formatMoneyFull(cls.pricePerSession)}/buổi</div></div>
        <button class="cc-edit-btn" onclick="event.stopPropagation();openEditClassModal('${cls.id}')" title="Sửa">✏️</button>
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
  document.getElementById('class-modal-title').textContent = '📚 Tạo lớp mới';
  document.getElementById('class-name').value = '';
  document.getElementById('class-price').value = '';
  document.getElementById('class-modal').dataset.editId = '';
  document.getElementById('class-delete-btn').classList.add('hidden');
  openModal('class-modal');
}
function openEditClassModal(id) {
  const cls = appData.classes.find(c => c.id === id);
  if (!cls) return;
  document.getElementById('class-modal-title').textContent = '✏️ Sửa lớp';
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
  if (!name) { showToast('⚠️ Nhập tên lớp!'); return; }
  if (price <= 0) { showToast('⚠️ Nhập giá tiền/buổi!'); return; }
  const eid = document.getElementById('class-modal').dataset.editId;
  if (eid) {
    const c = appData.classes.find(x => x.id === eid);
    if (c) { c.name = name; c.pricePerSession = price; }
    showToast('✅ Đã cập nhật lớp!');
  } else {
    appData.classes.push({ id: generateId(), name, pricePerSession: price, createdAt: Date.now() });
    showToast('✅ Đã tạo lớp mới!');
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
  showToast('🗑️ Đã xóa lớp!');
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
    fe.innerHTML = '<option value="all">Tất cả khối</option>' + grades.map(g => `<option value="${g}" ${cur===g?'selected':''}>${g}</option>`).join('');
  }
  let list = [...appData.students];
  if (fv !== 'all') list = list.filter(s => s.grade === fv);
  const el = document.getElementById('student-list');
  if (!list.length) { el.innerHTML = '<div class="empty-msg">Chưa có học sinh nào 📝</div>'; return; }
  el.innerHTML = list.map(s => {
    const cc = appData.classStudents.filter(cs => cs.studentId === s.id).length;
    return `<div class="stu-row"><div class="stu-info"><div class="stu-name">${s.name}</div><div class="stu-meta">${s.grade} · ${cc} lớp</div></div>
      <div class="stu-actions"><button class="stu-btn stu-edit" onclick="openEditStudentModal('${s.id}')">✏️</button><button class="stu-btn stu-del" onclick="deleteStudent('${s.id}')">🗑️</button></div></div>`;
  }).join('');
}
function openAddStudentModal() {
  document.getElementById('add-stu-title').textContent = '👨‍🎓 Thêm học sinh';
  document.getElementById('stu-name').value = '';
  document.getElementById('stu-grade').value = '';
  document.getElementById('add-student-modal').dataset.editId = '';
  openModal('add-student-modal');
}
function openEditStudentModal(id) {
  const s = appData.students.find(x => x.id === id);
  if (!s) return;
  document.getElementById('add-stu-title').textContent = '✏️ Sửa học sinh';
  document.getElementById('stu-name').value = s.name;
  document.getElementById('stu-grade').value = s.grade;
  document.getElementById('add-student-modal').dataset.editId = id;
  openModal('add-student-modal');
}
function saveStudent() {
  const name = document.getElementById('stu-name').value.trim();
  const grade = document.getElementById('stu-grade').value.trim();
  if (!name) { showToast('⚠️ Nhập tên HS!'); return; }
  if (!grade) { showToast('⚠️ Nhập khối lớp!'); return; }
  const eid = document.getElementById('add-student-modal').dataset.editId;
  if (eid) {
    const s = appData.students.find(x => x.id === eid);
    if (s) { s.name = name; s.grade = grade; }
    showToast('✅ Đã cập nhật!');
  } else {
    appData.students.push({ id: generateId(), name, grade, createdAt: Date.now() });
    showToast('✅ Đã thêm HS!');
  }
  saveData(); renderStudentManager(); renderDashboard(); closeModal('add-student-modal');
}
function deleteStudent(id) {
  if (!confirm('Xóa học sinh này?')) return;
  appData.students = appData.students.filter(s => s.id !== id);
  appData.classStudents = appData.classStudents.filter(cs => cs.studentId !== id);
  saveData(); renderStudentManager(); renderDashboard();
  showToast('🗑️ Đã xóa!');
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
    el.innerHTML = '<div class="empty-msg">Chưa có HS trong lớp.<br>Chuyển tab "Học sinh" để thêm! 👨‍🎓</div>';
    document.getElementById('att-summary').innerHTML = '';
    return;
  }
  const k = `${currentClassId}_${date}`;
  const dd = appData.attendance[k] || {};
  let pc = 0;
  stus.forEach(s => { if (dd[s.id] === true) pc++; });
  document.getElementById('att-summary').innerHTML =
    `<span class="att-present">✅ ${pc} có mặt</span><span class="att-absent">❌ ${stus.length - pc} vắng</span>`;
  el.innerHTML = stus.map((s, i) => {
    const p = dd[s.id] === true;
    return `<div class="att-row ${p ? 'att-present-row' : 'att-absent-row'}" onclick="toggleAtt('${s.id}')">
      <div class="att-num">${i + 1}</div>
      <div class="att-info"><div class="att-name">${s.name}</div><div class="att-grade">${s.grade}</div></div>
      <div class="att-toggle ${p ? 'att-on' : 'att-off'}">${p ? '✅' : '❌'}</div></div>`;
  }).join('');
}
function toggleAtt(sid) {
  const k = `${currentClassId}_${currentAttDate}`;
  if (!appData.attendance[k]) appData.attendance[k] = {};
  appData.attendance[k][sid] = !appData.attendance[k][sid];
  saveData(); renderAttendance();
}
function onAttDateChange() { currentAttDate = document.getElementById('att-date').value; renderAttendance(); }
function markAllPresent() {
  const k = `${currentClassId}_${currentAttDate}`;
  if (!appData.attendance[k]) appData.attendance[k] = {};
  appData.classStudents.filter(cs => cs.classId === currentClassId).forEach(cs => { appData.attendance[k][cs.studentId] = true; });
  saveData(); renderAttendance(); showToast('✅ Tất cả có mặt!');
}
function markAllAbsent() {
  const k = `${currentClassId}_${currentAttDate}`;
  if (!appData.attendance[k]) appData.attendance[k] = {};
  appData.classStudents.filter(cs => cs.classId === currentClassId).forEach(cs => { appData.attendance[k][cs.studentId] = false; });
  saveData(); renderAttendance(); showToast('❌ Tất cả vắng!');
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
  if (!stus.length) { el.innerHTML = '<div class="empty-msg">Chưa có HS. Nhấn "Thêm HS vào lớp"! 📝</div>'; return; }
  el.innerHTML = stus.map((s, i) => `<div class="stu-row">
    <div class="stu-num">${i + 1}</div>
    <div class="stu-info"><div class="stu-name">${s.name}</div><div class="stu-meta">${s.grade}</div></div>
    <button class="stu-btn stu-del" onclick="removeFromClass('${s.id}')">✕</button></div>`).join('');
}
function removeFromClass(sid) {
  appData.classStudents = appData.classStudents.filter(cs => !(cs.classId === currentClassId && cs.studentId === sid));
  saveData(); renderClassStudents(); renderDashboard(); showToast('Đã xóa khỏi lớp!');
}

// ── ASSIGN STUDENTS ──
function openAssignModal() { renderAssignList(); openModal('assign-modal'); }
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
  if (!avail.length) { el.innerHTML = '<div class="empty-msg">Không có HS nào để thêm.<br>Tạo HS mới ở mục "Quản lý HS" 👨‍🎓</div>'; return; }
  el.innerHTML = avail.map(s => `<div class="assign-row" onclick="assignStudent('${s.id}')">
    <div class="stu-info"><div class="stu-name">${s.name}</div><div class="stu-meta">${s.grade}</div></div>
    <div class="assign-check">➕</div></div>`).join('');
}
function assignStudent(sid) {
  const exists = appData.classStudents.find(cs => cs.classId === currentClassId && cs.studentId === sid);
  if (exists) return;
  appData.classStudents.push({ classId: currentClassId, studentId: sid });
  saveData(); renderAssignList(); renderClassStudents(); renderDashboard();
  showToast('✅ Đã thêm vào lớp!');
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
    wrap.innerHTML = '<div class="empty-msg">Chưa có học sinh trong lớp 📝</div>';
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

  // Build table
  let html = '<table class="summary-table"><thead><tr><th>Học sinh</th>';
  activeDays.forEach(d => { html += `<th>${d}</th>`; });
  html += '<th>Buổi</th><th>Học phí</th></tr></thead><tbody>';

  let grandTotal = 0;
  stus.forEach(s => {
    html += `<tr><td>${s.name}</td>`;
    let total = 0;
    activeDays.forEach(d => {
      const ds = `${summaryYear}-${String(summaryMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const k = `${currentClassId}_${ds}`;
      const present = appData.attendance[k]?.[s.id] === true;
      if (present) total++;
      html += `<td class="${present ? 'td-present' : 'td-absent'}">${present ? '✓' : '✗'}</td>`;
    });
    const fee = total * cls.pricePerSession;
    grandTotal += fee;
    html += `<td class="td-total">${total}</td><td class="td-fee">${formatMoney(fee)}</td></tr>`;
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;

  totalEl.innerHTML = `<div class="summary-total-label">💰 Tổng học phí ${monthNames[summaryMonth]}</div>
    <div class="summary-total-val">${formatMoneyFull(grandTotal)}</div>`;
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
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'APP_UPDATED') {
      document.getElementById('update-banner').classList.add('update-banner-show');
    }
  });
}
function applyUpdate() {
  document.getElementById('update-banner').classList.remove('update-banner-show');
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
  setTimeout(() => location.reload(), 300);
}
function dismissUpdate() {
  document.getElementById('update-banner').classList.remove('update-banner-show');
}
