import { toClassName } from '../../scripts/aem.js';

/**
 * Builds the panel body: image on the left, description on the right.
 * Authors may skip the image cell or drop the image into the description
 * cell, so the image is located by content rather than by position.
 * @param {Element[]} cells The row cells after the tab label
 * @returns {Element} The panel layout element
 */
function buildPanelContent(cells) {
  const layout = document.createElement('div');
  layout.className = 'tabs-panel-layout';

  const picture = cells.map((cell) => cell.querySelector('picture')).find(Boolean);
  if (picture) {
    const media = document.createElement('div');
    media.className = 'tabs-panel-image';
    const wrapper = picture.closest('p');
    media.append(picture);
    // drop the paragraph the picture sat in if nothing else is left in it
    if (wrapper && !wrapper.textContent.trim()) wrapper.remove();
    layout.append(media);
  } else {
    layout.classList.add('no-image');
  }

  const content = document.createElement('div');
  content.className = 'tabs-panel-content';
  cells.forEach((cell) => content.append(...cell.childNodes));
  layout.append(content);

  return layout;
}

export default async function decorate(block) {
  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');

  const rows = [...block.children].filter((row) => row.firstElementChild?.textContent.trim());
  [...block.children].forEach((row) => { if (!rows.includes(row)) row.remove(); });

  const buttons = [];
  rows.forEach((row, i) => {
    const [label, ...cells] = [...row.children];
    const id = `${toClassName(label.textContent)}-${i}`;

    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.id = `tab-${id}`;
    button.type = 'button';
    button.textContent = label.textContent.trim();
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `tabpanel-${id}`);
    button.setAttribute('aria-selected', i === 0);
    button.tabIndex = i === 0 ? 0 : -1;
    tablist.append(button);
    buttons.push(button);

    const panel = document.createElement('div');
    panel.className = 'tabs-panel';
    panel.id = `tabpanel-${id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    panel.hidden = i !== 0;
    panel.append(buildPanelContent(cells));
    row.replaceWith(panel);
  });

  const select = (index) => {
    buttons.forEach((button, i) => {
      const selected = i === index;
      button.setAttribute('aria-selected', selected);
      button.tabIndex = selected ? 0 : -1;
      block.querySelector(`#${button.getAttribute('aria-controls')}`).hidden = !selected;
    });
  };

  buttons.forEach((button, i) => {
    button.addEventListener('click', () => select(i));
    button.addEventListener('keydown', (e) => {
      const keys = {
        ArrowRight: (i + 1) % buttons.length,
        ArrowLeft: (i - 1 + buttons.length) % buttons.length,
        Home: 0,
        End: buttons.length - 1,
      };
      if (!(e.key in keys)) return;
      e.preventDefault();
      select(keys[e.key]);
      buttons[keys[e.key]].focus();
    });
  });

  block.prepend(tablist);
}
