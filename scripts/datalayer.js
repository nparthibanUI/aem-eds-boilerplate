import { getMetadata, toClassName } from './aem.js';

/*
 * Adobe Client Data Layer (ACDL) support.
 *
 * Creates `window.adobeDataLayer` and pushes:
 *   1. page data, once, on page load
 *   2. one `component` entry per block/widget, as soon as it finishes loading
 *
 * Blocks and widgets need no code of their own: every block loaded through
 * `loadBlock` (sections, header, footer, fragments, widgets) is picked up by
 * watching `data-block-status`. The Launch ACDL extension reads this array.
 */

const ID_ATTR = 'data-analytics-id';
const counters = {};

function dataLayer() {
  window.adobeDataLayer = window.adobeDataLayer || [];
  return window.adobeDataLayer;
}

/**
 * Pushes an entry to the data layer.
 * @param {Object} data ACDL data or event object
 */
export function pushToDataLayer(data) {
  dataLayer().push(data);
}

/**
 * Returns the widget name for widget blocks, e.g. `/widgets/forms/contact.html` -> `contact`.
 * @param {Element} block The block element
 * @returns {string} widget name, or empty string for regular blocks
 */
function getWidgetName(block) {
  if (block.dataset.blockName !== 'widget' || !block.dataset.source) return '';
  try {
    const { pathname } = new URL(block.dataset.source);
    return pathname.split('/').pop().split('.')[0];
  } catch {
    return '';
  }
}

/**
 * Builds the data layer entry for a block.
 * @param {Element} block The block element
 * @param {string} id The unique analytics id
 */
function getBlockData(block, id) {
  const { blockName } = block.dataset;
  const widgetName = getWidgetName(block);
  const name = widgetName || blockName;
  const ignored = ['block', 'widget', name];
  const variants = [...block.classList].filter((c) => !ignored.includes(c));

  let region = 'main';
  if (block.closest('header')) region = 'header';
  else if (block.closest('footer')) region = 'footer';

  const main = block.closest('main');
  const section = block.closest('.section');
  const sections = main ? [...main.querySelectorAll(':scope > .section')] : [];
  const heading = block.querySelector('h1, h2, h3, h4, h5, h6');

  return {
    '@type': widgetName ? `eds/widgets/${name}` : `eds/blocks/${name}`,
    id,
    type: widgetName ? 'widget' : 'block',
    name,
    variants,
    region,
    sectionIndex: section ? sections.indexOf(section) : -1,
    'dc:title': heading ? heading.textContent.trim() : '',
    ...(widgetName && { source: block.dataset.source }),
  };
}

/**
 * Adds a loaded block or widget to the data layer. Safe to call more than once.
 * @param {Element} block The block element
 */
export function trackBlock(block) {
  if (!block.dataset.blockName || block.hasAttribute(ID_ATTR)) return;
  const name = getWidgetName(block) || block.dataset.blockName;
  counters[name] = (counters[name] || 0) + 1;
  const id = `${name}-${counters[name]}`;
  block.setAttribute(ID_ATTR, id);

  pushToDataLayer({ component: { [id]: getBlockData(block, id) } });
  pushToDataLayer({ event: 'block:loaded', eventInfo: { path: `component.${id}` } });
}

/**
 * Tracks the element and any loaded blocks inside it.
 * @param {Node} node The node to scan
 */
function trackLoadedBlocks(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  if (node.dataset.blockStatus === 'loaded') trackBlock(node);
  node.querySelectorAll('[data-block-status="loaded"]').forEach(trackBlock);
}

/**
 * Pushes page data to the data layer.
 */
function trackPage() {
  const { pathname, href } = window.location;
  pushToDataLayer({
    page: {
      title: document.title,
      path: pathname,
      url: href,
      language: document.documentElement.lang,
      template: toClassName(getMetadata('template')),
      theme: toClassName(getMetadata('theme')),
      referrer: document.referrer,
    },
  });
}

/**
 * Creates `window.adobeDataLayer`, pushes page data, and starts tracking blocks.
 * Call once, before blocks start loading.
 */
export function initDataLayer() {
  if (window.hlx?.dataLayerInitialized) return;
  window.hlx = window.hlx || {};
  window.hlx.dataLayerInitialized = true;

  dataLayer();
  trackPage();

  // `data-block-status` flips to `loaded` on attached blocks; fragment blocks
  // load while detached and are only seen when their nodes are inserted.
  new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.type === 'attributes') trackLoadedBlocks(m.target);
      else m.addedNodes.forEach(trackLoadedBlocks);
    });
  }).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-block-status'],
  });

  trackLoadedBlocks(document.body);
}
