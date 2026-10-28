import { OPTIONS, COLORS, SECTOR_DEGREES, randomIndex, rotationFor } from './wheel-core.mjs';

const wheel = document.querySelector('#wheel');
const button = document.querySelector('#spin-button');
const hub = document.querySelector('#hub-button');
const label = document.querySelector('#spin-label');
const card = document.querySelector('#result-card');
const kicker = document.querySelector('#result-kicker');
const value = document.querySelector('#result-value');
const message = document.querySelector('#result-message');
const note = document.querySelector('#button-note');
const optionsList = document.querySelector('#options-list');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const svgNS = 'http://www.w3.org/2000/svg';
let rotation = 0;
let spinning = false;

function svgNode(name, attrs, text) {
  const node = document.createElementNS(svgNS, name);
  for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val);
  if (text) node.textContent = text;
  return node;
}
function polar(degrees, radius = 246) {
  const a = (degrees - 90) * Math.PI / 180;
  return [250 + radius * Math.cos(a), 250 + radius * Math.sin(a)];
}
OPTIONS.forEach((option, i) => {
  const angle = i * SECTOR_DEGREES;
  const [x1, y1] = polar(angle - SECTOR_DEGREES / 2);
  const [x2, y2] = polar(angle + SECTOR_DEGREES / 2);
  wheel.append(svgNode('path', { d: `M250 250L${x1} ${y1}A246 246 0 0 1 ${x2} ${y2}Z`, fill: COLORS[i], class: 'wheel-sector' }));
  const group = svgNode('g', { transform: `rotate(${angle} 250 250)` });
  group.append(svgNode('text', { x:250,y:81,class:'wheel-number' }, String(i + 1).padStart(2,'0')));
  group.append(svgNode('text', { x:250,y:108,class:'wheel-label' }, option.slice(0,2)));
  group.append(svgNode('text', { x:250,y:133,class:'wheel-label' }, option.slice(2)));
  wheel.append(group);
  const item = document.createElement('li');
  item.className = 'option';
  item.style.setProperty('--option-color', COLORS[i]);
  const dot = document.createElement('span');
  dot.className = 'option-dot';
  dot.setAttribute('aria-hidden','true');
  item.append(dot, document.createTextNode(option));
  optionsList.append(item);
});

function celebrate() {
  if (reducedMotion.matches) return;
  const container = document.querySelector('#confetti');
  container.replaceChildren();
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--color', COLORS[i % COLORS.length]);
    piece.style.setProperty('--x', `${(Math.random() - .5) * Math.min(innerWidth, 900)}px`);
    piece.style.setProperty('--y', `${(Math.random() - .24) * 700}px`);
    piece.style.setProperty('--r', `${Math.random() * 720}deg`);
    piece.style.borderRadius = i % 3 === 0 ? '50%' : '1px';
    container.append(piece);
  }
  setTimeout(() => container.replaceChildren(), 1700);
}

async function spin() {
  if (spinning) return;
  let selected;
  try { selected = randomIndex(); }
  catch {
    kicker.textContent = '暂时无法抽取';
    value.textContent = '请重试';
    message.textContent = '请使用支持安全随机数的现代浏览器访问此页面。';
    return;
  }
  spinning = true;
  button.disabled = true;
  hub.disabled = true;
  wheel.setAttribute('aria-label', '转盘正在转动');
  card.classList.remove('has-result');
  card.classList.add('spinning');
  kicker.textContent = '转盘正在替你做决定';
  const waiting = document.createElement('span');
  waiting.className = 'empty-result';
  waiting.textContent = '…';
  value.replaceChildren(waiting);
  message.textContent = '放轻松，答案马上揭晓';
  label.textContent = '转动中…';
  note.textContent = '九个选项，机会始终相同';
  for (const item of optionsList.children) item.classList.remove('selected');
  const destination = rotationFor(selected, rotation);
  const duration = reducedMotion.matches ? 200 : 4400;
  if (typeof wheel.animate === 'function') {
    const animation = wheel.animate([
      { transform: `rotate(${rotation}deg)` },
      { transform: `rotate(${destination}deg)` }
    ], { duration, easing: 'cubic-bezier(.14,.68,.16,1)', fill: 'forwards' });
    try { await animation.finished; } catch { /* Preserve the already drawn result if the browser cancels an animation. */ }
    rotation = destination % 360;
    wheel.style.transform = `rotate(${rotation}deg)`;
    animation.cancel();
  } else {
    wheel.style.transition = `transform ${duration}ms cubic-bezier(.14,.68,.16,1)`;
    wheel.style.transform = `rotate(${destination}deg)`;
    await new Promise(resolve => setTimeout(resolve, duration));
    wheel.style.transition = 'none';
    rotation = destination % 360;
    wheel.style.transform = `rotate(${rotation}deg)`;
  }
  card.classList.remove('spinning');
  card.classList.add('has-result');
  kicker.textContent = '本次结果 · 就是它了';
  value.textContent = OPTIONS[selected];
  message.textContent = '一份随机的小安排，愿你今天轻松一点。';
  wheel.setAttribute('aria-label', `转盘已停止，指针指向：${OPTIONS[selected]}`);
  optionsList.children[selected].classList.add('selected');
  label.textContent = '再转一次';
  note.textContent = '每次都是全新的一次抽取，也可能抽到相同结果';
  spinning = false;
  button.disabled = false;
  hub.disabled = false;
  celebrate();
}
button.addEventListener('click', spin);
hub.addEventListener('click', spin);
