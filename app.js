(() => {
  const STORAGE_COURSES = 'uni_portal_data';
  const STORAGE_CITIES = 'uni_portal_cities';
  const STORAGE_UNIS = 'uni_portal_universities';

  const DEFAULT_CITIES = [
    'Munich (München)',
    'Berlin',
    'Hamburg',
    'Frankfurt am Main',
    'Stuttgart',
    'Düsseldorf',
    'Cologne (Köln)',
    'Karlsruhe',
    'Nuremberg (Nürnberg)',
    'Dresden'
  ];

  let courses = [];
  let cities = [];
  let universities = [];
  let editingId = null;
  let sortCol = null;
  let sortAsc = true;

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

  // ── Persistence ──
  function saveAll() {
    try {
      localStorage.setItem(STORAGE_COURSES, JSON.stringify(courses));
      localStorage.setItem(STORAGE_CITIES, JSON.stringify(cities));
      localStorage.setItem(STORAGE_UNIS, JSON.stringify(universities));
    } catch {}
    $('#last-saved').textContent = 'Last saved: ' + new Date().toLocaleTimeString();
  }

  function loadAll() {
    try {
      const rc = localStorage.getItem(STORAGE_COURSES);
      courses = (rc && Array.isArray(JSON.parse(rc))) ? JSON.parse(rc) : [];
    } catch { courses = []; }

    try {
      const rci = localStorage.getItem(STORAGE_CITIES);
      cities = (rci && Array.isArray(JSON.parse(rci))) ? JSON.parse(rci) : [];
    } catch { cities = []; }

    try {
      const ru = localStorage.getItem(STORAGE_UNIS);
      universities = (ru && Array.isArray(JSON.parse(ru))) ? JSON.parse(ru) : [];
    } catch { universities = []; }

    if (cities.length === 0) {
      cities = DEFAULT_CITIES.map(name => ({ id: uid(), name }));
      try { localStorage.setItem(STORAGE_CITIES, JSON.stringify(cities)); } catch {}
    }
  }

  // ── Derived lists ──
  function allCityNames() {
    const fromCities = cities.map(c => c.name);
    const fromCourses = courses.map(c => c.city).filter(Boolean);
    return [...new Set([...fromCities, ...fromCourses])].sort();
  }

  function allUnisForCity(cityName) {
    const fromUnis = universities.filter(u => u.city === cityName).map(u => u.name);
    const fromCourses = courses.filter(c => c.city === cityName).map(c => c.university).filter(Boolean);
    return [...new Set([...fromUnis, ...fromCourses])].sort();
  }

  function allUniNames() {
    const fromUnis = universities.map(u => u.name);
    const fromCourses = courses.map(c => c.university).filter(Boolean);
    return [...new Set([...fromUnis, ...fromCourses])].sort();
  }

  function allCustomLabels() {
    const s = new Set();
    courses.forEach(d => (d.customFields || []).forEach(f => { if (f.label) s.add(f.label); }));
    return [...s].sort();
  }

  // ── Populate dropdowns ──
  function refreshFormCityDropdown() {
    const names = allCityNames();
    fillSelect('#form-city', names, '-- Select City --');
    fillSelect('#filter-city', names, 'All Cities');
  }

  function refreshFormUniDropdown(cityName) {
    const unis = cityName ? allUnisForCity(cityName) : allUniNames();
    fillSelect('#form-university', unis, '-- Select University --');
  }

  function refreshFilterUniDropdown() {
    const cityFilter = $('#filter-city').value;
    const unis = cityFilter ? allUnisForCity(cityFilter) : allUniNames();
    fillSelect('#filter-university', unis, 'All Universities');
  }

  function fillSelect(sel, items, placeholder) {
    const el = $(sel);
    const cur = el.value;
    el.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      el.appendChild(o);
    });
    if ([...el.options].some(o => o.value === cur)) el.value = cur;
  }

  // ── Tabs ──
  function initTabs() {
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        $$('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        $(`#${btn.dataset.tab}`).classList.add('active');
        if (btn.dataset.tab === 'tab-view') renderTable();
      });
    });
  }

  // ── City & University quick-add ──
  function saveCity() {
    const name = $('#new-city-name').value.trim();
    if (!name) { alert('Please enter a city name.'); return; }
    if (allCityNames().some(c => c.toLowerCase() === name.toLowerCase())) {
      alert('This city already exists.');
      return;
    }
    cities.push({ id: uid(), name });
    saveAll();
    refreshFormCityDropdown();
    $('#new-city-name').value = '';
    $('#form-city').value = name;
    $('#form-city').dispatchEvent(new Event('change'));
    $('#city-add-row').classList.add('hidden-input');
  }

  function deleteCity(name) {
    const coursesInCity = courses.filter(c => c.city === name).length;
    const unisInCity = universities.filter(u => u.city === name).length;
    let msg = `Delete city "${name}"?`;
    if (coursesInCity > 0 || unisInCity > 0) {
      msg += `\n\nThis will also remove ${unisInCity} university record(s) and ${coursesInCity} course(s) under this city.`;
    }
    if (!confirm(msg)) return;
    cities = cities.filter(c => c.name !== name);
    universities = universities.filter(u => u.city !== name);
    courses = courses.filter(c => c.city !== name);
    saveAll();
    refreshFormCityDropdown();
    refreshFormUniDropdown();
    renderCityList();
    renderUniList();
    renderTable();
  }

  function saveUniversity() {
    const cityName = $('#form-city').value;
    if (!cityName) { alert('Please select a city first.'); return; }
    const name = $('#new-uni-name').value.trim();
    if (!name) { alert('Please enter a university name.'); return; }
    if (allUnisForCity(cityName).some(u => u.toLowerCase() === name.toLowerCase())) {
      alert('This university already exists under this city.');
      return;
    }
    universities.push({ id: uid(), name, city: cityName });
    saveAll();
    refreshFormUniDropdown(cityName);
    $('#new-uni-name').value = '';
    $('#form-university').value = name;
    $('#uni-add-row').classList.add('hidden-input');
  }

  function deleteUniversity(uniName, cityName) {
    const coursesInUni = courses.filter(c => c.university === uniName && c.city === cityName).length;
    let msg = `Delete university "${uniName}"?`;
    if (coursesInUni > 0) {
      msg += `\n\nThis will also remove ${coursesInUni} course(s) under this university.`;
    }
    if (!confirm(msg)) return;
    universities = universities.filter(u => !(u.name === uniName && u.city === cityName));
    courses = courses.filter(c => !(c.university === uniName && c.city === cityName));
    saveAll();
    refreshFormUniDropdown($('#form-city').value);
    renderUniList();
    renderTable();
  }

  function renderCityList() {
    const container = $('#city-list');
    container.innerHTML = '';
    const names = allCityNames();
    if (names.length === 0) { container.innerHTML = '<span class="list-empty">No cities yet</span>'; return; }
    names.forEach(name => {
      const uniCount = allUnisForCity(name).length;
      const courseCount = courses.filter(c => c.city === name).length;
      const row = document.createElement('div');
      row.className = 'entity-chip';
      row.innerHTML = `
        <span class="chip-name">${escHtml(name)}</span>
        <span class="chip-count">${uniCount} uni · ${courseCount} course${courseCount !== 1 ? 's' : ''}</span>
        <button type="button" class="chip-del" title="Delete city">&times;</button>
      `;
      row.querySelector('.chip-del').addEventListener('click', (e) => { e.stopPropagation(); deleteCity(name); });
      row.addEventListener('click', () => { $('#form-city').value = name; $('#form-city').dispatchEvent(new Event('change')); });
      container.appendChild(row);
    });
  }

  function renderUniList() {
    const container = $('#uni-list');
    container.innerHTML = '';
    const cityName = $('#form-city').value;
    if (!cityName) { container.innerHTML = '<span class="list-empty">Select a city to see universities</span>'; return; }
    const unis = allUnisForCity(cityName);
    if (unis.length === 0) { container.innerHTML = '<span class="list-empty">No universities in this city yet</span>'; return; }
    unis.forEach(name => {
      const courseCount = courses.filter(c => c.university === name && c.city === cityName).length;
      const row = document.createElement('div');
      row.className = 'entity-chip';
      row.innerHTML = `
        <span class="chip-name">${escHtml(name)}</span>
        <span class="chip-count">${courseCount} course${courseCount !== 1 ? 's' : ''}</span>
        <button type="button" class="chip-del" title="Delete university">&times;</button>
      `;
      row.querySelector('.chip-del').addEventListener('click', (e) => { e.stopPropagation(); deleteUniversity(name, cityName); });
      row.addEventListener('click', () => { $('#form-university').value = name; });
      container.appendChild(row);
    });
  }

  // ── Custom fields in form ──
  function addCustomFieldRow(label = '', value = '') {
    const container = $('#custom-fields-container');
    const row = document.createElement('div');
    row.className = 'custom-field-row';
    row.innerHTML = `
      <input type="text" placeholder="Label" class="cf-label" value="${escHtml(label)}">
      <input type="text" placeholder="Value" class="cf-value" value="${escHtml(value)}">
      <button type="button" class="cf-remove" title="Remove">&times;</button>
    `;
    row.querySelector('.cf-remove').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  function getCustomFieldsFromForm() {
    const fields = [];
    $$('#custom-fields-container .custom-field-row').forEach(row => {
      const label = row.querySelector('.cf-label').value.trim();
      const value = row.querySelector('.cf-value').value.trim();
      if (label) fields.push({ label, value });
    });
    return fields;
  }

  // ── Course form logic ──
  function resetForm() {
    $('#course-form').reset();
    editingId = null;
    $('#course-form-title').textContent = 'Course Details';
    $('#btn-delete-form').style.display = 'none';
    $('#btn-save').textContent = 'Save Course';
    $('#custom-fields-container').innerHTML = '';
    $('#apply-other-input').classList.add('hidden-input');
    $('#city-add-row').classList.add('hidden-input');
    $('#uni-add-row').classList.add('hidden-input');
    setVpd(null);
    refreshFormCityDropdown();
    refreshFormUniDropdown();
    renderCityList();
    renderUniList();
  }

  function setVpd(val) {
    $$('.vpd-btn').forEach(b => b.classList.remove('active'));
    if (val === true) $('.vpd-btn[data-val="yes"]').classList.add('active');
    else if (val === false) $('.vpd-btn[data-val="no"]').classList.add('active');
  }

  function getVpd() {
    const active = $('.vpd-btn.active');
    if (!active) return null;
    return active.dataset.val === 'yes';
  }

  function loadRecordIntoForm(record) {
    editingId = record.id;
    $('#course-form-title').textContent = 'Edit Course';
    $('#btn-delete-form').style.display = '';
    $('#btn-save').textContent = 'Update Course';

    refreshFormCityDropdown();
    $('#form-city').value = record.city || '';
    $('#form-city').dispatchEvent(new Event('change'));
    setTimeout(() => {
      $('#form-university').value = record.university || '';
    }, 0);
    $('#form-course').value = record.course || '';
    $('#form-requirements').value = record.requirements || '';
    $('#form-summer-start').value = record.summerStart || '';
    $('#form-summer-end').value = record.summerEnd || '';
    $('#form-winter-start').value = record.winterStart || '';
    $('#form-winter-end').value = record.winterEnd || '';
    $('#form-ielts').value = record.ielts || '';
    $('#form-tuition').value = record.tuition || '';
    $('#form-apply').value = record.applyMethod || '';
    if (record.applyMethod === 'Other') {
      $('#apply-other-input').classList.remove('hidden-input');
      $('#form-apply-other').value = record.applyMethodOther || '';
    }
    setVpd(record.vpdRequired);
    $('#form-url').value = record.url || '';
    $('#form-comments').value = record.comments || '';

    $('#custom-fields-container').innerHTML = '';
    (record.customFields || []).forEach(f => addCustomFieldRow(f.label, f.value));

    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    $('.tab-btn[data-tab="tab-form"]').classList.add('active');
    $('#tab-form').classList.add('active');
    document.querySelector('.course-form-card').scrollIntoView({ behavior: 'smooth' });
  }

  function saveCourse() {
    const city = $('#form-city').value;
    const university = $('#form-university').value;
    const course = $('#form-course').value.trim();

    if (!city || !university || !course) {
      alert('City, University, and Course name are required.');
      return;
    }

    const record = {
      id: editingId || uid(),
      city,
      university,
      course,
      requirements: $('#form-requirements').value.trim(),
      summerStart: $('#form-summer-start').value,
      summerEnd: $('#form-summer-end').value,
      winterStart: $('#form-winter-start').value,
      winterEnd: $('#form-winter-end').value,
      ielts: $('#form-ielts').value.trim(),
      tuition: $('#form-tuition').value.trim(),
      applyMethod: $('#form-apply').value,
      applyMethodOther: $('#form-apply').value === 'Other' ? $('#form-apply-other').value.trim() : '',
      vpdRequired: getVpd(),
      url: $('#form-url').value.trim(),
      comments: $('#form-comments').value.trim(),
      customFields: getCustomFieldsFromForm()
    };

    if (editingId) {
      const idx = courses.findIndex(d => d.id === editingId);
      if (idx !== -1) courses[idx] = record;
    } else {
      courses.push(record);
    }

    saveAll();
    resetForm();
    renderTable();
  }

  function deleteRecord(id) {
    if (!confirm('Delete this course record? This cannot be undone.')) return;
    courses = courses.filter(d => d.id !== id);
    saveAll();
    if (editingId === id) resetForm();
    refreshFormCityDropdown();
    refreshFilterUniDropdown();
    renderCityList();
    renderUniList();
    renderTable();
  }

  // ── Table rendering ──
  const BASE_COLS = [
    { key: 'city', label: 'City' },
    { key: 'university', label: 'University' },
    { key: 'course', label: 'Course' },
    { key: 'requirements', label: 'Requirements' },
    { key: 'summerStart', label: 'Summer Start' },
    { key: 'summerEnd', label: 'Summer End' },
    { key: 'winterStart', label: 'Winter Start' },
    { key: 'winterEnd', label: 'Winter End' },
    { key: 'ielts', label: 'IELTS/Language' },
    { key: 'tuition', label: 'Tuition/Fees' },
    { key: 'applyMethod', label: 'Apply Method' },
    { key: 'vpdRequired', label: 'VPD' },
    { key: 'url', label: 'URL' },
    { key: 'comments', label: 'Comments' },
  ];

  function getFilteredData() {
    let filtered = [...courses];
    const fCity = $('#filter-city').value;
    const fUni = $('#filter-university').value;
    const fApply = $('#filter-apply').value;
    const fVpd = $('#filter-vpd').value;
    const fSearch = $('#filter-search').value.toLowerCase().trim();

    const fSummerStartFrom = $('#filter-summer-start-from').value;
    const fSummerStartTo = $('#filter-summer-start-to').value;
    const fSummerEndFrom = $('#filter-summer-end-from').value;
    const fSummerEndTo = $('#filter-summer-end-to').value;
    const fWinterStartFrom = $('#filter-winter-start-from').value;
    const fWinterStartTo = $('#filter-winter-start-to').value;
    const fWinterEndFrom = $('#filter-winter-end-from').value;
    const fWinterEndTo = $('#filter-winter-end-to').value;

    if (fCity) filtered = filtered.filter(d => d.city === fCity);
    if (fUni) filtered = filtered.filter(d => d.university === fUni);
    if (fApply) filtered = filtered.filter(d => d.applyMethod === fApply);
    if (fVpd === 'yes') filtered = filtered.filter(d => d.vpdRequired === true);
    if (fVpd === 'no') filtered = filtered.filter(d => d.vpdRequired === false);

    if (fSearch) {
      filtered = filtered.filter(d => {
        const searchable = [d.course, d.requirements, d.comments, d.ielts, d.tuition, d.city, d.university]
          .concat((d.customFields || []).map(f => f.label + ' ' + f.value))
          .join(' ').toLowerCase();
        return searchable.includes(fSearch);
      });
    }

    filtered = applyDateFilter(filtered, 'summerStart', fSummerStartFrom, fSummerStartTo);
    filtered = applyDateFilter(filtered, 'summerEnd', fSummerEndFrom, fSummerEndTo);
    filtered = applyDateFilter(filtered, 'winterStart', fWinterStartFrom, fWinterStartTo);
    filtered = applyDateFilter(filtered, 'winterEnd', fWinterEndFrom, fWinterEndTo);

    if (sortCol) {
      filtered.sort((a, b) => {
        let va = getCellValue(a, sortCol);
        let vb = getCellValue(b, sortCol);
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }

  function applyDateFilter(arr, field, from, to) {
    if (from) arr = arr.filter(d => d[field] && d[field] >= from);
    if (to) arr = arr.filter(d => d[field] && d[field] <= to);
    return arr;
  }

  function getCellValue(record, key) {
    if (key === 'vpdRequired') return record.vpdRequired ? 'Yes' : record.vpdRequired === false ? 'No' : '';
    if (key === 'applyMethod') return record.applyMethod === 'Other' ? (record.applyMethodOther || 'Other') : (record.applyMethod || '');
    if (key.startsWith('cf__')) {
      const label = key.slice(4);
      const f = (record.customFields || []).find(cf => cf.label === label);
      return f ? f.value : '';
    }
    return record[key] || '';
  }

  function renderTable() {
    const cfLabels = allCustomLabels();
    const allCols = [...BASE_COLS, ...cfLabels.map(l => ({ key: 'cf__' + l, label: l }))];

    const thead = $('#data-thead');
    const tbody = $('#data-tbody');

    thead.innerHTML = '';
    const headRow = document.createElement('tr');
    allCols.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label;
      if (sortCol === col.key) {
        th.innerHTML += `<span class="sort-arrow">${sortAsc ? '▲' : '▼'}</span>`;
      }
      th.addEventListener('click', () => {
        if (sortCol === col.key) sortAsc = !sortAsc;
        else { sortCol = col.key; sortAsc = true; }
        renderTable();
      });
      headRow.appendChild(th);
    });
    const thActions = document.createElement('th');
    thActions.textContent = 'Actions';
    thActions.style.cursor = 'default';
    headRow.appendChild(thActions);
    thead.appendChild(headRow);

    const filtered = getFilteredData();
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = allCols.length + 1;
      td.style.textAlign = 'center';
      td.style.padding = '40px';
      td.style.color = '#94a3b8';
      td.textContent = courses.length === 0 ? 'No courses added yet. Use the form to add your first course.' : 'No records match the current filters.';
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      filtered.forEach(record => {
        const tr = document.createElement('tr');
        allCols.forEach(col => {
          const td = document.createElement('td');
          const val = getCellValue(record, col.key);
          if (col.key === 'url' && val) {
            const a = document.createElement('a');
            a.href = val;
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = val.length > 40 ? val.slice(0, 40) + '...' : val;
            a.title = val;
            td.appendChild(a);
          } else if (col.key === 'vpdRequired') {
            td.className = val === 'Yes' ? 'vpd-yes' : 'vpd-no';
            td.textContent = val || '—';
          } else {
            td.textContent = val;
            td.title = val;
          }
          tr.appendChild(td);
        });
        const tdAct = document.createElement('td');
        tdAct.style.whiteSpace = 'nowrap';
        const btnEdit = document.createElement('button');
        btnEdit.className = 'action-btn';
        btnEdit.textContent = 'Edit';
        btnEdit.addEventListener('click', () => loadRecordIntoForm(record));
        const btnDel = document.createElement('button');
        btnDel.className = 'action-btn del';
        btnDel.textContent = 'Del';
        btnDel.addEventListener('click', () => deleteRecord(record.id));
        tdAct.appendChild(btnEdit);
        tdAct.appendChild(btnDel);
        tr.appendChild(tdAct);
        tbody.appendChild(tr);
      });
    }

    $('#record-count').textContent = filtered.length === courses.length
      ? `${courses.length} record${courses.length !== 1 ? 's' : ''}`
      : `${filtered.length} of ${courses.length} records shown`;

    refreshFilterUniDropdown();
  }

  // ── Export / Import Excel ──
  function exportExcel() {
    if (courses.length === 0) { alert('No data to export.'); return; }
    const cfLabels = allCustomLabels();
    const rows = courses.map(d => {
      const row = {
        City: d.city, University: d.university, Course: d.course,
        Requirements: d.requirements,
        'Summer Start': d.summerStart, 'Summer End': d.summerEnd,
        'Winter Start': d.winterStart, 'Winter End': d.winterEnd,
        'IELTS/Language': d.ielts, 'Tuition/Fees': d.tuition,
        'Apply Method': d.applyMethod === 'Other' ? (d.applyMethodOther || 'Other') : (d.applyMethod || ''),
        'VPD Required': d.vpdRequired === true ? 'Yes' : d.vpdRequired === false ? 'No' : '',
        URL: d.url, Comments: d.comments
      };
      cfLabels.forEach(l => {
        const f = (d.customFields || []).find(cf => cf.label === l);
        row[l] = f ? f.value : '';
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Courses');
    XLSX.writeFile(wb, `uni-portal-export-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function importExcel(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) { alert('The file appears empty.'); return; }

        const baseCols = ['City','University','Course','Requirements','Summer Start','Summer End',
          'Winter Start','Winter End','IELTS/Language','Tuition/Fees','Apply Method','VPD Required','URL','Comments'];

        const imported = rows.map(r => {
          const applyRaw = (r['Apply Method'] || '').toString().trim();
          const knownMethods = ['Uni-Assist', 'University website'];
          let applyMethod = knownMethods.find(m => m.toLowerCase() === applyRaw.toLowerCase()) || '';
          let applyMethodOther = '';
          if (applyRaw && !applyMethod) { applyMethod = 'Other'; applyMethodOther = applyRaw; }

          const vpdRaw = (r['VPD Required'] || '').toString().trim().toLowerCase();
          let vpdRequired = null;
          if (vpdRaw === 'yes' || vpdRaw === 'true') vpdRequired = true;
          else if (vpdRaw === 'no' || vpdRaw === 'false') vpdRequired = false;

          const cfs = [];
          Object.keys(r).forEach(k => {
            if (!baseCols.includes(k) && r[k] !== '') {
              cfs.push({ label: k, value: String(r[k]) });
            }
          });

          return {
            id: uid(),
            city: String(r['City'] || '').trim(),
            university: String(r['University'] || '').trim(),
            course: String(r['Course'] || '').trim(),
            requirements: String(r['Requirements'] || '').trim(),
            summerStart: String(r['Summer Start'] || '').trim(),
            summerEnd: String(r['Summer End'] || '').trim(),
            winterStart: String(r['Winter Start'] || '').trim(),
            winterEnd: String(r['Winter End'] || '').trim(),
            ielts: String(r['IELTS/Language'] || '').trim(),
            tuition: String(r['Tuition/Fees'] || '').trim(),
            applyMethod,
            applyMethodOther,
            vpdRequired,
            url: String(r['URL'] || '').trim(),
            comments: String(r['Comments'] || '').trim(),
            customFields: cfs
          };
        }).filter(d => d.city || d.university || d.course);

        const mode = confirm('Click OK to REPLACE all existing data with the imported file.\nClick Cancel to MERGE (add imported records to existing data).');
        if (mode) courses = imported;
        else courses = courses.concat(imported);

        saveAll();
        refreshFormCityDropdown();
        refreshFilterUniDropdown();
        renderTable();
        resetForm();
        alert(`Imported ${imported.length} record(s) successfully.`);
      } catch (err) {
        alert('Error importing file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Export / Import JSON ──
  function exportJSON() {
    const payload = { cities, universities, courses };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `uni-portal-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        let importedCourses, importedCities, importedUnis;

        if (Array.isArray(parsed)) {
          importedCourses = parsed.map(d => ({ ...d, id: d.id || uid() }));
          importedCities = [];
          importedUnis = [];
        } else if (parsed && typeof parsed === 'object') {
          importedCourses = (Array.isArray(parsed.courses) ? parsed.courses : []).map(d => ({ ...d, id: d.id || uid() }));
          importedCities = Array.isArray(parsed.cities) ? parsed.cities : [];
          importedUnis = Array.isArray(parsed.universities) ? parsed.universities : [];
        } else {
          alert('Invalid JSON format.'); return;
        }

        const mode = confirm('Click OK to REPLACE all existing data.\nClick Cancel to MERGE.');
        if (mode) {
          courses = importedCourses;
          if (importedCities.length) cities = importedCities;
          if (importedUnis.length) universities = importedUnis;
        } else {
          courses = courses.concat(importedCourses);
          cities = cities.concat(importedCities.filter(ic => !cities.some(c => c.name === ic.name)));
          universities = universities.concat(importedUnis.filter(iu => !universities.some(u => u.name === iu.name && u.city === iu.city)));
        }

        saveAll();
        refreshFormCityDropdown();
        refreshFilterUniDropdown();
        renderTable();
        resetForm();
        alert(`Imported ${importedCourses.length} course(s) from JSON.`);
      } catch (err) {
        alert('Error importing JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Init ──
  function init() {
    loadAll();
    initTabs();
    refreshFormCityDropdown();
    refreshFormUniDropdown();
    renderCityList();
    renderUniList();
    renderTable();

    // City dropdown change → update university list + entity lists
    $('#form-city').addEventListener('change', function() {
      refreshFormUniDropdown(this.value);
      renderUniList();
    });

    // Show/hide city add row
    $('#btn-show-add-city').addEventListener('click', () => {
      $('#city-add-row').classList.toggle('hidden-input');
      if (!$('#city-add-row').classList.contains('hidden-input')) $('#new-city-name').focus();
    });
    $('#btn-save-city').addEventListener('click', saveCity);
    $('#new-city-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveCity(); } });

    // Show/hide uni add row
    $('#btn-show-add-uni').addEventListener('click', () => {
      if (!$('#form-city').value) { alert('Please select a city first.'); return; }
      $('#uni-add-row').classList.toggle('hidden-input');
      if (!$('#uni-add-row').classList.contains('hidden-input')) $('#new-uni-name').focus();
    });
    $('#btn-save-uni').addEventListener('click', saveUniversity);
    $('#new-uni-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveUniversity(); } });

    // Apply method → show/hide "Other" input
    $('#form-apply').addEventListener('change', function() {
      if (this.value === 'Other') {
        $('#apply-other-input').classList.remove('hidden-input');
        $('#form-apply-other').focus();
      } else {
        $('#apply-other-input').classList.add('hidden-input');
      }
    });

    // VPD toggle
    $$('.vpd-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const isActive = btn.classList.contains('active');
        $$('.vpd-btn').forEach(b => b.classList.remove('active'));
        if (!isActive) btn.classList.add('active');
      });
    });

    // Custom fields
    $('#btn-add-cf').addEventListener('click', () => addCustomFieldRow());

    // Save course
    $('#btn-save').addEventListener('click', saveCourse);

    // Clear form
    $('#btn-clear').addEventListener('click', resetForm);

    // Delete from form
    $('#btn-delete-form').addEventListener('click', () => { if (editingId) deleteRecord(editingId); });

    // Export/Import Excel
    $('#btn-export-xlsx').addEventListener('click', exportExcel);
    $('#btn-import-xlsx').addEventListener('click', () => $('#file-xlsx').click());
    $('#file-xlsx').addEventListener('change', function() { if (this.files[0]) { importExcel(this.files[0]); this.value = ''; } });

    // Export/Import JSON
    $('#btn-export-json').addEventListener('click', exportJSON);
    $('#btn-import-json').addEventListener('click', () => $('#file-json').click());
    $('#file-json').addEventListener('change', function() { if (this.files[0]) { importJSON(this.files[0]); this.value = ''; } });

    // Filters
    ['#filter-city', '#filter-university', '#filter-apply', '#filter-vpd'].forEach(sel => {
      $(sel).addEventListener('change', renderTable);
    });
    $('#filter-city').addEventListener('change', () => { refreshFilterUniDropdown(); renderTable(); });
    $('#filter-search').addEventListener('input', renderTable);

    ['#filter-summer-start-from','#filter-summer-start-to','#filter-summer-end-from','#filter-summer-end-to',
     '#filter-winter-start-from','#filter-winter-start-to','#filter-winter-end-from','#filter-winter-end-to'
    ].forEach(sel => $(sel).addEventListener('change', renderTable));

    $('#btn-clear-filters').addEventListener('click', () => {
      ['#filter-city','#filter-university','#filter-apply','#filter-vpd','#filter-search',
       '#filter-summer-start-from','#filter-summer-start-to','#filter-summer-end-from','#filter-summer-end-to',
       '#filter-winter-start-from','#filter-winter-start-to','#filter-winter-end-from','#filter-winter-end-to'
      ].forEach(sel => $(sel).value = '');
      renderTable();
    });

    if (courses.length > 0) {
      $('#last-saved').textContent = 'Data loaded from browser storage';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
