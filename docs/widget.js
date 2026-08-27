/*! 컴시간 시간표 위젯 — 어떤 웹앱에나 한 줄로 붙이는 시간표 뷰어
 *  사용: <script src="https://woorimalsam-lab.github.io/comci-timetable/widget.js" defer></script>
 *  옵션(스크립트 태그 속성):
 *    data-teacher="김수*"   기본 교사
 *    data-mount="#toolbar"  버튼을 넣을 곳(없으면 우측 하단에 떠있는 버튼)
 *    data-fab="0"           떠있는 버튼 끄기 (호스트 앱이 ComciTimetable.open() 직접 호출)
 *  API: window.ComciTimetable.open() / .close() / .refresh()
 */
(function () {
  "use strict";
  if (window.ComciTimetable) return;                 // 중복 로드 방지

  var SRC = 'https://woorimalsam-lab.github.io/comci-timetable/data/';
  var DAYS = ['월', '화', '수', '목', '금'];
  var LS_T = 'ctt_teacher', LS_C = 'ctt_cache_v1';
  var me = document.currentScript || (function () {
    var s = document.getElementsByTagName('script'); return s[s.length - 1];
  })();
  var OPT = {
    teacher: (me && me.dataset && me.dataset.teacher) || '김수*',
    mount: (me && me.dataset && me.dataset.mount) || '',
    fab: !(me && me.dataset && me.dataset.fab === '0')
  };

  var idx = null, cur = null, booted = false, root = null;
  var z = function (n) { return String(n).padStart(2, '0'); };

  function thisMonday() {
    var d = new Date(), dow = (d.getDay() + 6) % 7;
    d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dow);
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function pickWeek(weeks, today) {
    if (!weeks || !weeks.length) return null;
    for (var i = 0; i < weeks.length; i++) if (weeks[i].start === today) return today;
    var past = weeks.filter(function (w) { return w.start < today; })
                    .map(function (w) { return w.start; }).sort();
    if (past.length) return past[past.length - 1];
    return weeks.map(function (w) { return w.start; }).sort()[0];
  }
  var cache = {
    all: function () { try { return JSON.parse(localStorage.getItem(LS_C) || '{}'); } catch (e) { return {}; } },
    get: function (k) { return this.all()[k]; },
    put: function (k, v) { try { var c = this.all(); c[k] = v; localStorage.setItem(LS_C, JSON.stringify(c)); } catch (e) {} }
  };
  function getJSON(name) {
    return fetch(SRC + name + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { cache.put(name, j); return { data: j, fresh: true }; })
      .catch(function (e) {
        var c = cache.get(name);
        if (c) return { data: c, fresh: false };
        throw e;
      });
  }

  /* ---------- UI ---------- */
  var CSS = [
    '#cttFab{position:fixed;right:18px;bottom:18px;z-index:99998;width:52px;height:52px;border-radius:50%;',
    'border:0;background:#2563eb;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.28)}',
    '#cttFab:hover{background:#1d4ed8}',
    '.ctt-btn{border:1px solid var(--ctt-line);background:var(--ctt-panel);color:var(--ctt-ink);',
    'border-radius:9px;padding:6px 11px;font-size:13px;cursor:pointer}',
    '#cttWrap{position:fixed;inset:0;z-index:99999;display:none;',
    '--ctt-panel:#fff;--ctt-panel2:#f3f5f9;--ctt-line:#dfe3ea;--ctt-ink:#1b2432;--ctt-muted:#7c8494;--ctt-ac:#2563eb}',
    '#cttWrap.ctt-dark{--ctt-panel:#171c23;--ctt-panel2:#212831;--ctt-line:#2a323d;--ctt-ink:#e8edf3;--ctt-muted:#8b96a5;--ctt-ac:#4c9aff}',
    '#cttWrap.show{display:block}',
    '#cttBd{position:absolute;inset:0;background:rgba(8,12,18,.5)}',
    '#cttPanel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(880px,94vw);',
    'max-height:90vh;display:flex;flex-direction:column;background:var(--ctt-panel);color:var(--ctt-ink);',
    'border:1px solid var(--ctt-line);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden;',
    'font-family:"Malgun Gothic",system-ui,-apple-system,sans-serif}',
    '#cttHead{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--ctt-line);background:var(--ctt-panel2)}',
    '#cttHead b{font-size:15px}#cttHead .sp{margin-left:auto}',
    '#cttCtl{display:flex;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--ctt-line)}',
    '#cttWrap select{padding:7px 9px;border:1px solid var(--ctt-line);border-radius:9px;background:var(--ctt-panel);color:var(--ctt-ink);font-size:13px;max-width:100%}',
    '#cttBody{padding:12px 14px;overflow:auto}',
    '#cttMeta{color:var(--ctt-muted);font-size:12px;margin:0 0 8px}',
    '#cttWrap table{border-collapse:collapse;width:100%;font-size:13px}',
    '#cttWrap th,#cttWrap td{border:1px solid var(--ctt-line);padding:6px 4px;text-align:center;height:46px;vertical-align:middle}',
    '#cttWrap thead th{background:var(--ctt-panel2);font-weight:600}',
    '#cttWrap thead th.today{color:var(--ctt-ac)}',
    '#cttWrap td.p{background:var(--ctt-panel2);font-weight:600;width:56px;white-space:nowrap}',
    '#cttWrap td.p small{display:block;font-weight:400;color:var(--ctt-muted);font-size:10px}',
    '#cttWrap td .c{font-weight:700;color:var(--ctt-ac)}',
    '#cttWrap td .s{display:block;color:var(--ctt-muted);font-size:11px;margin-top:1px}',
    '#cttWrap td.e{color:var(--ctt-line)}',
    '#cttWrap td.chg{background:rgba(225,29,72,.12)}#cttWrap td.chg .c{color:#e11d48}',
    '#cttNote{padding:0 14px 12px;color:var(--ctt-muted);font-size:11px;line-height:1.5}',
    '@media (max-width:560px){#cttPanel{width:100vw;height:100vh;max-height:100vh;border-radius:0;left:0;top:0;transform:none}',
    '#cttWrap th,#cttWrap td{font-size:11px;height:42px;padding:4px 2px}#cttWrap td.p{width:44px}',
    '#cttWrap td .s{font-size:10px}#cttCtl select{flex:1;min-width:0}}'
  ].join('');

  var HTML = [
    '<div id="cttBd"></div>',
    '<div id="cttPanel" role="dialog" aria-label="시간표">',
    '<div id="cttHead"><b>📅 시간표</b><span class="sp"></span>',
    '<button class="ctt-btn" id="cttReload" title="새로고침">↻</button>',
    '<button class="ctt-btn" id="cttClose">닫기</button></div>',
    '<div id="cttCtl"><select id="cttWeek"></select><select id="cttTeacher"></select></div>',
    '<div id="cttBody"><p id="cttMeta">불러오는 중…</p><div id="cttGrid"></div></div>',
    '<div id="cttNote"></div></div>'
  ].join('');

  function build() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'cttWrap'; root.innerHTML = HTML;
    document.body.appendChild(root);
    root.querySelector('#cttClose').onclick = close;
    root.querySelector('#cttBd').onclick = close;
    root.querySelector('#cttReload').onclick = refresh;
    root.querySelector('#cttWeek').onchange = function () { loadWeek().catch(function () {}); };
    root.querySelector('#cttTeacher').onchange = function () { render(true); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('show')) { e.stopPropagation(); close(); }
    }, true);
    var btn = document.createElement('button');
    btn.textContent = '📅'; btn.title = '시간표'; btn.onclick = open;
    var host = OPT.mount ? document.querySelector(OPT.mount) : null;
    if (host) { btn.className = 'ctt-btn'; host.appendChild(btn); }
    else if (OPT.fab) { btn.id = 'cttFab'; document.body.appendChild(btn); }
  }
  function syncTheme() {
    var d = document.documentElement.getAttribute('data-theme');
    var dark = d ? d === 'dark'
      : (document.body.classList.contains('dark') ||
         (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
    root.classList.toggle('ctt-dark', !!dark);
  }

  function loadIndex() {
    return getJSON('index.json').then(function (r) {
      idx = r.data;
      var today = thisMonday(), next = addDays(today, 7);
      var sel = pickWeek(idx.weeks, today);
      root.querySelector('#cttWeek').innerHTML = idx.weeks.map(function (w) {
        var tag = w.start === today ? '이번주'
                : w.start === next ? '다음주'
                : w.start < today ? '지난 기록' : '예정';
        return '<option value="' + w.start + '"' + (w.start === sel ? ' selected' : '') + '>'
             + (w.label || w.start) + ' [' + tag + ']</option>';
      }).join('');
      return r.fresh;
    });
  }
  function loadWeek() {
    var st = root.querySelector('#cttWeek').value;
    return getJSON(idx.school.code + '_' + st + '.json').then(function (r) {
      cur = r.data;
      var keep = localStorage.getItem(LS_T) || OPT.teacher;
      root.querySelector('#cttTeacher').innerHTML = cur.teachers.map(function (t) {
        return '<option value="' + t.idx + '">' + t.name + '</option>';
      }).join('');
      var hit = cur.teachers.filter(function (t) { return t.name === keep; })[0];
      if (hit) root.querySelector('#cttTeacher').value = hit.idx;
      render(r.fresh);
    });
  }
  function render(fresh) {
    if (!cur) return;
    var tv = root.querySelector('#cttTeacher').value;
    var who = (cur.teachers.filter(function (t) { return String(t.idx) === String(tv); })[0] || {}).name || '';
    if (who) localStorage.setItem(LS_T, who);
    var list = cur.per_teacher[tv] || [], map = {};
    list.forEach(function (e) { map[e.day + '_' + e.period] = e; });
    var maxP = Math.max(6, (cur.max_period || 5) + 1), times = cur.period_times || [];
    var todayDow = (new Date().getDay() + 6) % 7;
    var h = '<table><thead><tr><th></th>' + DAYS.map(function (d, i) {
      return '<th class="' + (i === todayDow ? 'today' : '') + '">' + d + '</th>';
    }).join('') + '</tr></thead><tbody>';
    for (var p = 0; p < maxP; p++) {
      h += '<tr><td class="p">' + (p + 1) + '<small>' + (times[p] || '') + '</small></td>';
      for (var d = 0; d < 5; d++) {
        var c = map[d + '_' + p];
        h += c ? '<td class="' + (c.changed ? 'chg' : '') + '"><span class="c">' + c.cls
                 + '</span><span class="s">' + (c.sub || '') + '</span></td>'
               : '<td class="e">·</td>';
      }
      h += '</tr>';
    }
    root.querySelector('#cttGrid').innerHTML = h + '</tbody></table>';
    root.querySelector('#cttMeta').textContent =
      idx.school.name + ' · ' + (cur.week_label || '') + ' · ' + who + ' · 주당 ' + list.length + '시간';
    var sel = root.querySelector('#cttWeek').value, today = thisMonday();
    var hasToday = idx.weeks.some(function (w) { return w.start === today; });
    var note = '· 컴시간알리미 자료를 자동으로 받아옵니다. "기본시간표"는 학기 표준 시간표(예정)입니다.';
    if (!hasToday) note += '<br>· ⚠ 이번 주 자료가 아직 없어 <b>가장 가까운 주</b>를 보여드립니다.';
    if (!fresh) note += '<br>· ⚠ 인터넷 연결이 없어 <b>저장된 자료</b>를 보고 있습니다.';
    root.querySelector('#cttNote').innerHTML = note;
  }
  function refresh() {
    root.querySelector('#cttMeta').textContent = '불러오는 중…';
    root.querySelector('#cttGrid').innerHTML = '';
    root.querySelector('#cttNote').textContent = '';
    return loadIndex().then(loadWeek).catch(function () {
      root.querySelector('#cttMeta').textContent = '시간표를 불러오지 못했습니다.';
      root.querySelector('#cttNote').innerHTML = '· 인터넷 연결을 확인해 주세요.';
    });
  }
  function open() {
    if (!root) build();
    syncTheme();
    root.classList.add('show');
    if (!booted) { booted = true; refresh(); }
  }
  function close() { if (root) root.classList.remove('show'); }

  function init() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.ComciTimetable = { open: open, close: close, refresh: refresh };
})();
