(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const encouragements = [
    '数字小怪兽，又被你的认真打败啦！',
    '给小脑袋点个赞，今天又升级了一点！',
    '每解开一道题，就离数学宝藏近一步。',
    '不用跑得最快，认真走也能找到宝藏。',
    '再检查一遍，捉住调皮的小错误！',
    '你的铅笔正在画出一条进步的小路。',
    '慢慢想、仔细算，小小困难也会让路。',
    '今天的小坚持，正在长成大本领！',
    '小脑袋开动啦，数字朋友等你来挑战！',
    '认真是你的超能力，记得随身携带！',
    '给努力的自己击个掌：啪，你真棒！',
    '一道一道慢慢来，数学小山也能翻过去。',
    '让铅笔歇一歇，再带着好奇心出发！',
    '答错也没关系，小侦探会从线索里学会新招。',
    '把问题想明白，就是送给大脑的小礼物。',
    '进步有时很小，小到刚好装进一颗星。'
  ];
  function nextEncouragement(previous) {
    const choices = encouragements.filter(message => message !== previous);
    return choices[Math.floor(Math.random() * choices.length)];
  }
  const state = { rows: window.MathIslandSource, setNumber: 1, edition: 'SOURCE-01', themeName: '', original: true, answers: false, completed: false, exporting: false, encouragement: nextEncouragement() };
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let toastTimer;
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible'); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000); }
  function questionMarkup(cell) {
    const parts = MathIslandPDF.questionParts(cell);
    if (parts.result) return `<span class="writing-formula"><span class="given-expression">${escape(parts.before)}</span><span class="result-writing-slot" aria-label="答案空白">&nbsp;</span></span>`;
    return `<span class="fill-formula">${escape(parts.before)}(<span class="handwriting-gap${cell.type === 'inequality' ? ' wide-gap' : ''}" aria-label="填空区域">&nbsp;</span>)${escape(parts.after)}</span>`;
  }
  function tableMarkup(answers) {
    const widths = answers ? [20,20,20,20,20] : MathIslandPDF.layout.columns;
    return `<table class="source-table${answers ? ' answers-table' : ''}" aria-label="${answers ? '五列二十行答案表' : '五列二十行98道练习题'}"><colgroup>${widths.map(width => `<col style="width:${width}%">`).join('')}</colgroup><thead><tr><th colspan="5">${answers ? '答案' : `二上视算<br>坚持每日视算，筑牢数学计算基础`}</th></tr></thead><tbody>${state.rows.map(row => `<tr>${row.map(cell => `<td${cell.heading ? ' class="instruction-cell"' : ` data-type="${cell.type}"`}>${cell.heading ? (answers ? '' : escape(MathIslandPDF.instructionText(cell.heading))) : answers ? escape(cell.answer) : questionMarkup(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function paperMarkup(answers) {
    const labels = answers ? ['核对答案', '圈出错题', '再试一次'] : ['认真计算', '仔细检查', '坚持完成'];
    return `<div class="adventure-banner"><div class="adventure-brand"><span aria-hidden="true">+</span>口算探险岛</div><div class="adventure-maths" aria-hidden="true"><span>＋</span><span>×</span><span>＝</span></div></div><div class="adventure-meta"><span>小探险家：_______________</span><span>日期：_______ 月 _______ 日</span></div>${tableMarkup(answers)}<div class="adventure-reward"><div class="reward-label"><strong>${answers ? '检查小脚印' : '我的认真星'}</strong><span>做到一项，就涂亮一颗。</span></div>${labels.map(label => `<div class="reward-step"><span class="coloring-star" aria-hidden="true">☆</span><span>${label}</span></div>`).join('')}</div><div class="adventure-footnote">${escape(state.encouragement)}</div>`;
  }
  function render() {
    $('paper').innerHTML = paperMarkup(state.answers);
    $('editionId').textContent = state.original ? '原表 01' : state.edition;
    $('sourceStatus').textContent = state.original ? '源文件题目' : `${state.themeName ? state.themeName + ' · ' : ''}第 ${state.setNumber} 套`;
    $('restoreButton').disabled = state.original;
    for (const [id, active] of [['questionTab', !state.answers], ['answerTab', state.answers]]) { $(id).classList.toggle('active', active); $(id).setAttribute('aria-selected', String(active)); $(id).tabIndex = active ? 0 : -1; }
    $('previewPanel').setAttribute('aria-labelledby', state.answers ? 'answerTab' : 'questionTab');
    $('completeButton').classList.toggle('done', state.completed); $('completeButton').setAttribute('aria-pressed', String(state.completed));
    $('completeButton').innerHTML = `<span aria-hidden="true">${state.completed ? '★' : '☆'}</span>${state.completed ? '认真星已点亮' : '这一套，我完成啦'}`;
    $('rewardMessage').textContent = state.completed ? '今天的认真星，送给坚持完成的你！' : '';
  }
  const luckyWheel = MathIslandWheel.create({
    prepare({ seed, theme }) {
      const worksheetSeed = `${seed}:${theme.id}`;
      return { rows: MathIslandEngine.generateSheet({ seed: worksheetSeed }), edition: seed.replace(/[^a-z0-9]/gi, '').slice(-7).toUpperCase(), encouragement: nextEncouragement(state.encouragement) };
    },
    onAccept(worksheet, theme) {
      state.rows = worksheet.rows; state.edition = worksheet.edition; state.setNumber++;
      state.original = false; state.answers = false; state.completed = false; state.themeName = theme.name;
      state.encouragement = worksheet.encouragement;
      render();
      toast(`出发去${theme.name}！98 道新题准备好了。`);
    }
  });
  function snapshot() { return { rows: state.rows.map(row => row.map(cell => ({ ...cell }))), title: `二上视算`, edition: state.edition, setNumber: state.setNumber, encouragement: state.encouragement, pageCount: 1 }; }
  $('shuffleButton').addEventListener('click', () => luckyWheel.open());
  document.addEventListener('keydown', event => { if (event.key === 'F9') { event.preventDefault(); luckyWheel.open(); } });
  $('restoreButton').addEventListener('click', () => { state.rows = window.MathIslandSource; state.setNumber = 1; state.edition = 'SOURCE-01'; state.themeName = ''; state.original = true; state.answers = false; state.completed = false; state.encouragement = nextEncouragement(state.encouragement); render(); toast('已恢复源文件中的题目和答案。'); });
  $('questionTab').addEventListener('click', () => { state.answers = false; render(); });
  $('answerTab').addEventListener('click', () => { state.answers = true; render(); });
  document.querySelector('.view-tabs').addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); state.answers = event.key === 'Home' ? false : event.key === 'End' ? true : !state.answers; render(); $(state.answers ? 'answerTab' : 'questionTab').focus(); });
  $('includeAnswers').addEventListener('change', () => { $('exportHint').textContent = $('includeAnswers').checked ? '1 页题目 + 1 页答案' : '1 页题目，不含答案'; });
  $('completeButton').addEventListener('click', () => { state.completed = !state.completed; render(); });
  $('downloadButton').addEventListener('click', async () => {
    if (state.exporting) return;
    state.exporting = true;
    const button = $('downloadButton'), label = button.querySelector('span'), model = snapshot(), withAnswers = $('includeAnswers').checked;
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    try { const pdf = await MathIslandPDF.create(model, withAnswers, (page, total) => { label.textContent = `正在排版 ${page} / ${total} 页…`; }); MathIslandPDF.save(pdf, `${model.title}_${model.edition}${withAnswers ? '_含答案' : ''}.pdf`); toast(withAnswers ? 'PDF 已生成：一页练习，一页答案。' : '完整一套 98 道，已导出到一张 A4。'); }
    catch (error) { toast(error.message || '导出失败，请尝试直接打印'); }
    finally { state.exporting = false; button.disabled = false; button.removeAttribute('aria-busy'); label.textContent = '下载 A4 PDF'; }
  });
  function preparePrint() { $('printRoot').innerHTML = [false, ...($('includeAnswers').checked ? [true] : [])].map(answers => `<article class="paper source-paper">${paperMarkup(answers)}</article>`).join(''); }
  window.addEventListener('beforeprint', preparePrint); window.addEventListener('afterprint', () => { $('printRoot').innerHTML = ''; });
  $('printButton').addEventListener('click', () => { preparePrint(); window.print(); });
  render();
})();
