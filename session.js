'use strict';

const data = JSON.parse(document.getElementById('session-data').textContent);
const criteria = {
  overall: '总体偏好：综合来看，你更喜欢哪张图片？',
  alignment: '提示词符合度：哪张图片更符合文字描述？',
  quality: '视觉质量：哪张图片的画质更好、瑕疵更少？',
};
const choices = ['left', 'right', 'tie'];
const choiceLabels = {left: '左图更好', right: '右图更好', tie: '难分高下'};
const element = id => document.getElementById(id);
let rater = '';
let answers = {};
let position = 0;

element('session-label').textContent = `第 ${Number(data.block_id.slice(-2))} 组`;
const suggestedId = new URLSearchParams(location.search).get('rater');
if (suggestedId && /^R\d{2,3}$/.test(suggestedId)) element('rater').value = suggestedId;

function storageKey() {
  return [data.study_id, data.subset_id, data.block_id, rater].join(':');
}

function save() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify({answers, position}));
  } catch {
    element('notice').textContent = '浏览器无法自动保存。请在关闭页面前导出答案。';
  }
}

function render() {
  const trial = data.trials[position];
  element('prompt').textContent = trial.prompt;
  for (const side of ['left', 'right']) {
    element(side).src = data.images[trial[side]];
    element(side).onclick = () => {
      element('zoom-image').src = data.images[trial[side]];
      element('zoom').showModal();
    };
  }
  element('questions').replaceChildren();
  for (const [criterion, question] of Object.entries(criteria)) {
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = question;
    group.append(legend);
    for (const choice of choices) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = criterion;
      input.value = choice;
      input.checked = answers[trial.id]?.[criterion] === choice;
      input.onchange = () => {
        answers[trial.id] ??= {};
        answers[trial.id][criterion] = choice;
        save();
        render();
      };
      label.append(input, choiceLabels[choice]);
      group.append(label);
    }
    element('questions').append(group);
  }
  const completed = data.trials.filter(item => Object.keys(criteria).every(criterion => choices.includes(answers[item.id]?.[criterion]))).length;
  element('progress').max = data.trials.length;
  element('progress').value = completed;
  element('count').textContent = `第 ${position + 1} / ${data.trials.length} 对图片 · 已完成 ${completed} 对`;
  element('previous').disabled = position === 0;
  element('next').disabled = !Object.keys(criteria).every(criterion => choices.includes(answers[trial.id]?.[criterion])) || position === data.trials.length - 1;
  element('finished').hidden = completed !== data.trials.length;
}

element('start').onclick = () => {
  const value = element('rater').value.trim().toUpperCase();
  if (!/^R\d{2,3}$/.test(value)) {
    element('notice').textContent = '请输入组织者分配的匿名编号，例如 R01。';
    return;
  }
  rater = value;
  element('rater').value = rater;
  answers = {};
  position = 0;
  element('notice').textContent = '';
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || '{}');
    if (saved.answers && typeof saved.answers === 'object') answers = saved.answers;
    if (Number.isInteger(saved.position) && saved.position >= 0 && saved.position < data.trials.length) position = saved.position;
  } catch {
    element('notice').textContent = '无法读取已保存的答案。请在作答过程中及时导出备份。';
  }
  element('main').hidden = false;
  element('export').disabled = false;
  render();
};

element('previous').onclick = () => { position--; save(); render(); };
element('next').onclick = () => { position++; save(); render(); };
element('close-zoom').onclick = () => element('zoom').close();
element('export').onclick = () => {
  if (!rater) return;
  const payload = {
    study_id: data.study_id,
    subset_id: data.subset_id,
    rater_id: rater,
    block_id: data.block_id,
    exported_at: new Date().toISOString(),
    answers: data.trials.filter(trial => answers[trial.id]).map(trial => ({trial_id: trial.id, ...answers[trial.id]})),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `ratings_${rater}_${data.block_id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  element('notice').textContent = '请把下载的 JSON 文件私下发给组织者。本页面不会自动提交答案。';
};
