'use strict';

const data = JSON.parse(document.getElementById('session-data').textContent);
const criteria = {
  overall: 'Which image do you prefer overall?',
  alignment: 'Which image better matches the text prompt?',
  quality: 'Which image has better visual quality?',
};
const choices = ['left', 'right', 'tie'];
const element = id => document.getElementById(id);
let rater = '';
let answers = {};
let position = 0;

element('session-label').textContent = data.label;
const suggestedId = new URLSearchParams(location.search).get('rater');
if (suggestedId && /^R\d{2,3}$/.test(suggestedId)) element('rater').value = suggestedId;

function storageKey() {
  return [data.study_id, data.subset_id, data.block_id, rater].join(':');
}

function save() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify({answers, position}));
  } catch {
    element('notice').textContent = 'Local saving is unavailable. Export your answers before closing this page.';
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
      label.append(input, choice[0].toUpperCase() + choice.slice(1));
      group.append(label);
    }
    element('questions').append(group);
  }
  const completed = data.trials.filter(item => Object.keys(criteria).every(criterion => choices.includes(answers[item.id]?.[criterion]))).length;
  element('progress').max = data.trials.length;
  element('progress').value = completed;
  element('count').textContent = `Pair ${position + 1} of ${data.trials.length} · ${completed} complete`;
  element('previous').disabled = position === 0;
  element('next').disabled = !Object.keys(criteria).every(criterion => choices.includes(answers[trial.id]?.[criterion])) || position === data.trials.length - 1;
  element('finished').hidden = completed !== data.trials.length;
}

element('start').onclick = () => {
  const value = element('rater').value.trim().toUpperCase();
  if (!/^R\d{2,3}$/.test(value)) {
    element('notice').textContent = 'Enter the anonymous ID supplied by the organizer, such as R01.';
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
    element('notice').textContent = 'Saved answers could not be loaded. Export regularly while completing this session.';
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
  element('notice').textContent = 'Send the downloaded JSON file privately to the organizer. This page does not submit it automatically.';
};
