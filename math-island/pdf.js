(function (root) {
  'use strict';
  const W = 794, H = 1123, SCALE = 3;
  const INK = '#243957', MUTED = '#59677a', BLUE = '#356db0';
  const FONT = '"Avenir Next", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  const layout = Object.freeze({
    pageWidth: W, pageHeight: H, x: 38, y: 90, width: 718,
    headerHeight: 48, rowHeight: 43, fontSize: 16 * 4 / 3 * (650 / 671.625),
    padding: 5, resultGap: 3, minResultWidth: 45, factorBlankWidth: 34, inequalityBlankWidth: 40,
    columns: Object.freeze([116, 128, 148, 160, 166].map(width => width / 718 * 100))
  });
  const instructionText = heading => heading.replace(/\(\s*\)/g, '(　)');
  function questionParts(cell) {
    const expression = (cell.sourceText || cell.expression).replace(/\s/g, '').replace(/−/g, '-').replace(/\(\)/g, '□');
    const result = ['multiply', 'mixed', 'chain'].includes(cell.type);
    if (result) return { before: expression.replace(/□$/, ''), after: '', result: true };
    const [before, after = ''] = expression.split('□');
    return { before, after, result: false, blankWidth: cell.type === 'missing' ? layout.factorBlankWidth : layout.inequalityBlankWidth };
  }
  function pageCanvas(model, answerPage) {
    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE; canvas.height = H * SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器暂时无法生成 PDF，请尝试直接打印');
    ctx.scale(SCALE, SCALE); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const paperFont = '"Songti SC", SimSun, "Noto Serif CJK SC", serif';
    const { x, y, width, headerHeight, rowHeight, fontSize } = layout;
    const rawWidths = answerPage ? [20,20,20,20,20] : layout.columns;
    const sum = rawWidths.reduce((a,b) => a+b,0), edges = [x];
    rawWidths.forEach(value => edges.push(edges[edges.length-1] + value / sum * width));
    const tableBottom = y + headerHeight + 20 * rowHeight;
    function caption(str, tx, ty, size = 12, color = INK, weight = 400, align = 'left') {
      ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color;
      ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(str, tx, ty);
    }
    function roundedBox(bx, by, bw, bh, radius, fill, stroke) {
      ctx.beginPath(); ctx.moveTo(bx + radius, by); ctx.lineTo(bx + bw - radius, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius); ctx.lineTo(bx + bw, by + bh - radius);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh); ctx.lineTo(bx + radius, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius); ctx.lineTo(bx, by + radius);
      ctx.quadraticCurveTo(bx, by, bx + radius, by); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }
    function star(sx, sy, radius, color) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * .46 : radius;
        const px = sx + Math.cos(angle) * r, py = sy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
    }
    // Use narrower outer margins to enlarge every question cell without reducing its type size.
    roundedBox(x, 33, 29, 29, 8, '#edf4fb', BLUE);
    caption('+', x + 14.5, 55, 25, BLUE, 500, 'center');
    caption('口算探险岛', x + 41, 55, 21, INK, 700);
    caption('＋', x + 260, 52, 22, '#ac7c22', 500);
    caption('×', x + 300, 57, 26, BLUE, 500);
    caption('＝', x + 340, 50, 21, '#508174', 500);
    caption('小探险家：_______________', x + width, 47, 11, MUTED, 400, 'right');
    caption('日期：_______ 月 _______ 日', x + width, 73, 11, MUTED, 400, 'right');
    ctx.fillStyle = answerPage ? '#eef6f2' : '#edf4fb'; ctx.fillRect(x, y, width, headerHeight);
    if (!answerPage) {
      ctx.fillStyle = '#f8fafc';
      for (const col of [1,3]) ctx.fillRect(edges[col], y + headerHeight, edges[col+1] - edges[col], 20 * rowHeight);
      ctx.fillStyle = '#fff4cf';
      for (const row of [0,10]) ctx.fillRect(edges[4], y + headerHeight + row * rowHeight, edges[5] - edges[4], rowHeight);
    }
    function text(str, tx, ty, size, bold, align = 'left', limit = 1000) {
      ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#000';
      ctx.font = `${bold ? 700 : 400} ${size}px ${paperFont}`;
      while (ctx.measureText(str).width > limit && size > 14) {
        size -= .25; ctx.font = `${bold ? 700 : 400} ${size}px ${paperFont}`;
      }
      ctx.fillText(str, tx, ty);
    }
    if (answerPage) text('答案', x + width / 2, y + headerHeight / 2 + fontSize / 3, fontSize, false, 'center');
    else {
      text(`二上视算`, x + width / 2, y + headerHeight * .42, fontSize, true, 'center');
      text('坚持每日视算，筑牢数学计算基础', x + width / 2, y + headerHeight * .84, fontSize, true, 'center');
    }
    model.rows.forEach((row, r) => row.forEach((cell, c) => {
      const top = y + headerHeight + r * rowHeight;
      const left = edges[c] + layout.padding, right = edges[c+1] - layout.padding;
      const baseline = top + (answerPage ? rowHeight / 2 + fontSize / 3 : fontSize + 1);
      if (answerPage) {
        text(cell.heading ? '' : String(cell.answer), (edges[c]+edges[c+1])/2, baseline, c === 2 ? fontSize * 14/16 : fontSize, false, 'center', right-left);
        return;
      }
      if (cell.heading) { text(instructionText(cell.heading), left, baseline, fontSize, true, 'left', right-left); return; }
      const parts = questionParts(cell);
      text(parts.result ? parts.before : parts.before + '(', left, baseline, fontSize, true);
      const prefixWidth = ctx.measureText(parts.result ? parts.before : parts.before + '(').width;
      const blankLeft = left + prefixWidth + (parts.result ? layout.resultGap : 1);
      const blankRight = parts.result ? right : blankLeft + parts.blankWidth;
      if (!parts.result) text(')' + parts.after, blankRight + 1, baseline, fontSize, true);
      ctx.beginPath(); ctx.strokeStyle = '#9aaebe'; ctx.lineWidth = .7;
      ctx.moveTo(blankLeft, baseline + 4); ctx.lineTo(blankRight, baseline + 4); ctx.stroke();
    }));
    ctx.strokeStyle = '#576b7c'; ctx.lineWidth = .65; ctx.beginPath();
    ctx.rect(x, y, width, headerHeight + 20 * rowHeight);
    for (let r = 0; r < 20; r++) {
      const ry = y + headerHeight + r * rowHeight;
      ctx.moveTo(x, ry); ctx.lineTo(x + width, ry);
    }
    for (let c = 1; c < 5; c++) {
      ctx.moveTo(edges[c], y + headerHeight); ctx.lineTo(edges[c], y + headerHeight + 20 * rowHeight);
    }
    ctx.stroke();
    const rewardY = tableBottom + 14;
    roundedBox(x, rewardY, width, 54, 10, '#fffdf5', '#b8ad8c');
    caption(answerPage ? '检查小脚印' : '我的认真星', x + 17, rewardY + 21, 16, INK, 700);
    caption('做到一项，就涂亮一颗。', x + 17, rewardY + 40, 11, MUTED);
    const labels = answerPage ? ['核对答案', '圈出错题', '再试一次'] : ['认真计算', '仔细检查', '坚持完成'];
    labels.forEach((label, i) => {
      const sx = x + width * (.5 + i * .195);
      star(sx, rewardY + 17, 10, '#96722a'); caption(label, sx, rewardY + 42, 11, INK, 400, 'center');
    });
    caption(model.encouragement || '今天的小坚持，正在长成大本领！', x + width / 2, rewardY + 82, 11, MUTED, 400, 'center');
    return canvas;
  }
  const ascii = value => new TextEncoder().encode(value);
  function makePdf(images) {
    const chunks = [], offsets = [0]; let bytes = 0;
    const push = part => { const data = typeof part === 'string' ? ascii(part) : part; chunks.push(data); bytes += data.length; };
    const object = (id, data) => { offsets[id] = bytes; push(`${id} 0 obj\n`); push(data); push('\nendobj\n'); };
    push('%PDF-1.4\n'); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, `<< /Type /Pages /Count ${images.length} /Kids [${images.map((_, i) => `${5 + 3 * i} 0 R`).join(' ')}] >>`);
    images.forEach((image, i) => {
      const imageId = 3 + i * 3, contentId = imageId + 1, pageId = imageId + 2;
      offsets[imageId] = bytes;
      push(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W * SCALE} /Height ${H * SCALE} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);
      push(image); push('\nendstream\nendobj\n');
      const content = 'q\n595.275591 0 0 841.889764 0 0 cm\n/Im0 Do\nQ';
      object(contentId, `<< /Length ${ascii(content).length} >>\nstream\n${content}\nendstream`);
      object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.275591 841.889764] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    });
    const xref = bytes;
    push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    offsets.slice(1).forEach(offset => push(`${String(offset).padStart(10, '0')} 00000 n \n`));
    push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
  }
  async function create(model, includeAnswers, onProgress = () => {}) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const images = [], total = model.pageCount * (includeAnswers ? 2 : 1);
    for (const answers of includeAnswers ? [false, true] : [false]) {
      for (let page = 0; page < model.pageCount; page++) {
        onProgress(images.length + 1, total);
        const canvas = pageCanvas(model, answers);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .97));
        if (!blob) throw new Error('PDF 页面生成失败，请重试');
        images.push(new Uint8Array(await blob.arrayBuffer()));
        canvas.width = canvas.height = 1;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    return makePdf(images);
  }
  function save(blob, filename) {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  root.MathIslandPDF = { create, save, layout, questionParts, instructionText };
})(globalThis);
