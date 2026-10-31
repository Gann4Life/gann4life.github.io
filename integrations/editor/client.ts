import './client.css';

type Opt = { value: string; label: string; draft?: boolean };
type FieldDef = {
  name: string;
  type: string;
  label: string;
  help: string;
  options?: Opt[];
  fields?: FieldDef[];
  required?: boolean;
  default?: unknown;
};
type Loaded = { id: string; hash: string; values: Record<string, unknown>; body: string; form: { dir: string; fields: FieldDef[] } };
type Path = (string | number)[];
type Pending = { token: string; file: File };
type Ctl = {
  el: HTMLElement;
  get(): unknown;
  changed(): boolean;
  error(path: Path, message: string): boolean;
  clear(): void;
  lock(on: boolean): void;
  focus(): void;
  uploads(): Pending[];
};
type Ctx = { labeled: boolean; onChange: () => void; dir: string };

const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
const SCALARS = ['text', 'longtext', 'markdown', 'url', 'date', 'image'];
const ACCEPT = 'image/png,image/jpeg,image/webp,image/avif,image/gif';

const newToken = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const previewUrl = (dir: string, value: string): string =>
  `${BASE}${new URL(value, `http://local/${dir}/`).pathname.slice(1)}`;

let uid = 0;
const nextId = (prefix: string) => `${prefix}-${++uid}`;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, any> = {},
  ...kids: (Node | string | null | false | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false || value === null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key in node && key !== 'list') (node as any)[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const kid of kids) if (kid) node.append(kid);
  return node;
}

function norm(field: FieldDef, value: unknown): any {
  switch (field.type) {
    case 'boolean':
      return Boolean(value ?? field.default ?? false);
    case 'enum':
      return (value as string | undefined) ?? (field.default as string | undefined) ?? '';
    case 'tags':
    case 'refs':
      return Array.isArray(value) ? [...value] : [];
    case 'list':
      return (Array.isArray(value) ? value : []).map((item) =>
        Object.fromEntries((field.fields ?? []).map((sub) => [sub.name, norm(sub, (item as any)?.[sub.name])])),
      );
    default:
      return String(value ?? '');
  }
}

function payload(field: FieldDef, value: any): unknown {
  if (field.type === 'list') {
    return value.map((item: Record<string, any>) => {
      const out: Record<string, unknown> = {};
      for (const sub of field.fields ?? []) {
        const v = payload(sub, item[sub.name]);
        if (v === null) continue;
        out[sub.name] = v;
      }
      return out;
    });
  }
  if (SCALARS.includes(field.type) && value === '' && !field.required) return null;
  return value;
}

function describe(input: HTMLElement, field: FieldDef, wrap: HTMLElement) {
  const id = nextId('ed-help');
  wrap.append(h('span', { class: 'ed-sr', id, text: field.help }));
  input.setAttribute('aria-describedby', id);
  input.setAttribute('title', field.help);
  if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby')) input.setAttribute('aria-label', field.label);
}

function makeCtl(field: FieldDef, value: unknown, ctx: Ctx, forceLabel?: boolean): Ctl {
  const wrap = h('div', { class: `ed-field ed-t-${field.type}`, 'data-name': field.name });
  const orig = norm(field, value);
  const errors: HTMLElement[] = [];
  let primary: HTMLElement | null = null;
  let getter: () => any = () => orig;
  let locker: (on: boolean) => void = () => {};
  let itemError: (path: Path, message: string) => boolean = () => false;
  let clearInner: () => void = () => {};
  let uploadsOf: () => Pending[] = () => [];
  const labeled = forceLabel ?? ctx.labeled;
  const baseDescribed = () => primary?.getAttribute('aria-describedby') ?? '';

  const showError = (message: string, host: HTMLElement = wrap, input: HTMLElement | null = primary) => {
    const id = nextId('ed-err');
    const p = h('p', { class: 'ed-error', id, text: message });
    host.append(p);
    errors.push(p);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `${baseDescribed()} ${id}`.trim());
    }
  };
  const clear = () => {
    for (const p of errors.splice(0)) {
      p.remove();
      primary?.setAttribute('aria-describedby', baseDescribed().split(' ').filter((id) => id !== p.id).join(' '));
    }
    primary?.removeAttribute('aria-invalid');
  };
  const touch = () => {
    clear();
    ctx.onChange();
  };

  const addLabel = (forInput?: HTMLElement) => {
    if (!labeled || field.type === 'boolean') return;
    const label = forInput
      ? h('label', { class: 'ed-label', text: field.label })
      : h('p', { class: 'ed-label', text: field.label });
    if (forInput) {
      if (!forInput.id) forInput.id = nextId('ed-in');
      (label as HTMLLabelElement).htmlFor = forInput.id;
    }
    wrap.append(label);
  };

  if (['text', 'url', 'date'].includes(field.type)) {
    const input = h('input', {
      class: 'ed-in',
      type: field.type === 'text' ? 'text' : field.type,
      value: orig,
      placeholder: field.type === 'date' ? '' : field.help,
    });
    if (field.type === 'url') input.spellcheck = false;
    if (field.type === 'url') input.setAttribute('inputmode', 'url');
    primary = input;
    addLabel(input);
    wrap.append(input);
    describe(input, field, wrap);
    input.addEventListener('input', touch);
    getter = () => input.value;
    locker = (on) => (input.readOnly = on);
  } else if (field.type === 'longtext' || field.type === 'markdown') {
    const area = h('textarea', {
      class: `ed-in ed-area${field.type === 'markdown' ? ' ed-area--md' : ''}`,
      rows: field.type === 'markdown' ? 10 : 2,
      value: orig,
      placeholder: field.type === 'markdown' ? '' : field.help,
    });
    if (field.type === 'markdown') area.spellcheck = false;
    const fit = () => {
      area.style.height = 'auto';
      area.style.height = `${area.scrollHeight + 2}px`;
    };
    primary = area;
    addLabel(area);
    wrap.append(area);
    describe(area, field, wrap);
    area.addEventListener('input', () => {
      fit();
      touch();
    });
    requestAnimationFrame(fit);
    getter = () => area.value;
    locker = (on) => (area.readOnly = on);
    if (field.type === 'markdown') {
      const picked = new Map<string, File>();
      const fileInput = h('input', { type: 'file', accept: ACCEPT, hidden: true, tabIndex: -1 });
      const insertBtn = h('button', { type: 'button', class: 'ed-btn ed-insert__open', text: 'Insert image' });
      insertBtn.setAttribute('aria-label', 'Insert image into the body');
      const preview = h('img', { class: 'ed-img__thumb', alt: '' });
      const altId = nextId('ed-alt');
      const altInput = h('input', { class: 'ed-in', type: 'text', id: altId, placeholder: 'Describe the image (alt text)…' });
      altInput.setAttribute('aria-label', 'Alt text of the image');
      const okBtn = h('button', { type: 'button', class: 'ed-btn', text: 'Insert' });
      const cancelBtn = h('button', { type: 'button', class: 'ed-btn', text: 'Cancel' });
      const prompt = h('div', { class: 'ed-insert__prompt', hidden: true }, preview, altInput, okBtn, cancelBtn);
      let pending: File | null = null;
      let at = 0;
      const close = () => {
        pending = null;
        prompt.hidden = true;
        if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
        preview.removeAttribute('src');
        altInput.value = '';
      };
      insertBtn.addEventListener('click', () => {
        at = area.selectionStart ?? area.value.length;
        fileInput.click();
      });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        close();
        pending = file;
        preview.src = URL.createObjectURL(file);
        prompt.hidden = false;
        altInput.focus();
      });
      const confirm = () => {
        if (!pending) return;
        const token = newToken();
        picked.set(token, pending);
        const alt = altInput.value.replace(/[\[\]\r\n]+/g, ' ').trim();
        const mark = `![${alt}](upload:${token})`;
        area.value = `${area.value.slice(0, at)}${mark}${area.value.slice(at)}`;
        const end = at + mark.length;
        area.setSelectionRange(end, end);
        close();
        area.dispatchEvent(new Event('input'));
        area.focus();
      };
      okBtn.addEventListener('click', confirm);
      cancelBtn.addEventListener('click', () => {
        close();
        insertBtn.focus();
      });
      altInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirm();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          close();
          insertBtn.focus();
        }
      });
      wrap.append(h('div', { class: 'ed-insert' }, insertBtn, fileInput), prompt);
      uploadsOf = () =>
        [...picked.entries()].filter(([token]) => area.value.includes(`](upload:${token})`)).map(([token, file]) => ({ token, file }));
      const lockArea = locker;
      locker = (on) => {
        lockArea(on);
        insertBtn.disabled = on;
        okBtn.disabled = on;
        altInput.readOnly = on;
      };
    }
  } else if (field.type === 'image') {
    type Cur = { path: string } | { token: string; file: File; url: string } | null;
    let cur: Cur = orig ? { path: String(orig) } : null;
    const fileInput = h('input', { type: 'file', accept: ACCEPT, hidden: true, tabIndex: -1 });
    const thumb = h('img', { class: 'ed-img__thumb', alt: '' });
    const none = h('span', { class: 'ed-img__none', text: 'No image' });
    const pick = h('button', { type: 'button', class: 'ed-btn' });
    const drop = h('button', { type: 'button', class: 'ed-btn', text: 'Remove' });
    const box = h('div', { class: 'ed-img' }, thumb, none, h('div', { class: 'ed-img__actions' }, pick, drop), fileInput);
    const release = () => {
      if (cur && 'url' in cur) URL.revokeObjectURL(cur.url);
    };
    const render = () => {
      thumb.hidden = !cur;
      none.hidden = Boolean(cur);
      if (cur) thumb.src = 'url' in cur ? cur.url : previewUrl(ctx.dir, cur.path);
      pick.textContent = cur ? 'Replace' : 'Add image';
      pick.setAttribute('aria-label', `${cur ? 'Replace' : 'Add'} ${field.label}`);
      drop.hidden = !cur;
      drop.setAttribute('aria-label', `Remove ${field.label}`);
    };
    thumb.addEventListener('error', () => {
      none.textContent = 'Image not found';
      none.hidden = false;
      thumb.hidden = true;
    });
    thumb.addEventListener('load', () => {
      none.textContent = 'No image';
      none.hidden = true;
    });
    pick.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      release();
      cur = { token: newToken(), file, url: URL.createObjectURL(file) };
      render();
      touch();
    });
    drop.addEventListener('click', () => {
      release();
      cur = null;
      render();
      touch();
      pick.focus();
    });
    render();
    primary = pick;
    addLabel();
    wrap.append(box);
    describe(pick, field, wrap);
    pick.setAttribute('aria-label', `${cur ? 'Replace' : 'Add'} ${field.label}`);
    getter = () => (!cur ? '' : 'path' in cur ? cur.path : { upload: cur.token });
    locker = (on) => {
      pick.disabled = on;
      drop.disabled = on;
    };
    uploadsOf = () => (cur && 'token' in cur ? [{ token: cur.token, file: cur.file }] : []);
  } else if (field.type === 'boolean') {
    const box = h('input', { class: 'ed-in', type: 'checkbox', checked: Boolean(orig) });
    primary = box;
    wrap.append(h('label', { class: 'ed-toggle' }, box, h('span', { text: field.label })));
    describe(box, field, wrap);
    box.addEventListener('change', touch);
    getter = () => box.checked;
    locker = (on) => (box.disabled = on);
  } else if (field.type === 'enum') {
    const select = h('select', { class: 'ed-in' });
    if (orig === '') select.append(h('option', { value: '', text: '—' }));
    for (const opt of field.options ?? []) select.append(h('option', { value: opt.value, text: opt.label }));
    select.value = orig;
    primary = select;
    addLabel(select);
    wrap.append(select);
    describe(select, field, wrap);
    select.addEventListener('change', touch);
    getter = () => select.value;
    locker = (on) => (select.disabled = on);
  } else if (field.type === 'tags' || field.type === 'refs') {
    let chosen: string[] = [...orig];
    const optionOf = new Map((field.options ?? []).map((o) => [o.value, o]));
    const chips = h('div', { class: 'ed-chips' });
    const holder = h('div', { class: 'ed-multi' }, chips);
    const word = field.label.replace(/s$/, '');
    const render = () => {
      chips.replaceChildren(
        ...chosen.map((v) => {
          const opt = optionOf.get(v);
          const name = opt?.label ?? v;
          return h(
            'button',
            { type: 'button', class: 'ed-chip', 'aria-label': `Remove ${name}`, title: `Remove ${name}` },
            h('span', { text: name }),
            opt?.draft ? h('span', { class: 'ed-chip__draft', text: ' (draft)' }) : null,
            h('span', { 'aria-hidden': 'true', text: ' ✕' }),
          );
        }),
      );
      chips.querySelectorAll('button').forEach((b, i) =>
        b.addEventListener('click', () => {
          chosen.splice(i, 1);
          render();
          touch();
        }),
      );
      if (field.type === 'tags') {
        const select = adder as HTMLSelectElement;
        select.replaceChildren(h('option', { value: '', disabled: true, selected: true, text: `+ ${word}` }));
        for (const opt of field.options ?? []) {
          if (!chosen.includes(opt.value)) select.append(h('option', { value: opt.value, text: opt.label }));
        }
      }
    };
    let adder: HTMLElement;
    if (field.type === 'tags') {
      const select = h('select', { class: 'ed-add ed-in', 'aria-label': `Add ${word}` });
      select.addEventListener('change', () => {
        if (select.value) chosen.push(select.value);
        render();
        touch();
      });
      adder = select;
    } else {
      const listId = nextId('ed-dl');
      const titles = new Map<string, number>();
      for (const opt of field.options ?? []) titles.set(opt.label, (titles.get(opt.label) ?? 0) + 1);
      const text = (o: Opt) => `${o.label}${o.draft ? ' (draft)' : ''}${(titles.get(o.label) ?? 0) > 1 ? ` · ${o.value}` : ''}`;
      const list = h('datalist', { id: listId });
      for (const opt of field.options ?? []) list.append(h('option', { value: text(opt) }));
      const input = h('input', { class: 'ed-add ed-in', type: 'text', placeholder: 'Type a project title…', 'aria-label': `Add ${word}` });
      input.setAttribute('list', listId);
      const tryAdd = () => {
        const match = (field.options ?? []).find((o) => text(o) === input.value);
        if (!match || chosen.includes(match.value)) return;
        chosen.push(match.value);
        input.value = '';
        render();
        touch();
      };
      input.addEventListener('change', tryAdd);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          tryAdd();
        }
      });
      holder.append(list);
      adder = input;
    }
    holder.append(adder);
    render();
    primary = adder;
    addLabel();
    wrap.append(holder);
    describe(adder, field, wrap);
    adder.setAttribute('aria-label', `Add ${word}`);
    getter = () => [...chosen];
    locker = (on) => {
      adder.toggleAttribute('disabled', on);
      chips.querySelectorAll('button').forEach((b) => (b.disabled = on));
    };
  } else if (field.type === 'list') {
    type Item = { el: HTMLElement; ctls: Ctl[]; names: string[]; buttons: HTMLButtonElement[] };
    const subs = field.fields ?? [];
    const host = h('div', { class: 'ed-list' });
    const empty = h('p', { class: 'ed-empty', text: 'No items.' });
    const items: Item[] = [];
    const addBtn = h('button', { type: 'button', class: 'ed-btn ed-add-item', text: '+ Add' });
    addBtn.setAttribute('aria-label', `Add to ${field.label}`);
    const blank = (): Record<string, unknown> =>
      Object.fromEntries(
        subs.map((s) => [s.name, s.default ?? (s.type === 'enum' ? s.options?.[0]?.value : s.type === 'boolean' ? false : s.type === 'tags' || s.type === 'refs' ? [] : '')]),
      );
    const sync = () => {
      items.forEach((item, i) => {
        const [up, down, del] = item.buttons;
        up.disabled = i === 0;
        down.disabled = i === items.length - 1;
        up.setAttribute('aria-label', `Move up ${field.label} item ${i + 1}`);
        down.setAttribute('aria-label', `Move down ${field.label} item ${i + 1}`);
        del.setAttribute('aria-label', `Remove ${field.label} item ${i + 1}`);
        item.el.dataset.index = String(i);
      });
      host.replaceChildren(...(items.length ? items.map((i) => i.el) : [empty]));
    };
    const make = (data: Record<string, unknown>): Item => {
      const ctls = subs.map((s) => makeCtl(s, data[s.name], { labeled: true, dir: ctx.dir, onChange: () => { unflag(item); touch(); } }));
      const up = h('button', { type: 'button', class: 'ed-btn ed-icon', text: '↑' });
      const down = h('button', { type: 'button', class: 'ed-btn ed-icon', text: '↓' });
      const del = h('button', { type: 'button', class: 'ed-btn ed-icon', text: '✕' });
      const item: Item = {
        el: h('div', { class: 'ed-item' }, h('div', { class: 'ed-item__fields' }, ...ctls.map((c) => c.el)), h('div', { class: 'ed-item__actions' }, up, down, del)),
        ctls,
        names: subs.map((s) => s.name),
        buttons: [up, down, del],
      };
      const move = (by: number, which: number) => {
        const at = items.indexOf(item);
        const to = at + by;
        if (to < 0 || to >= items.length) return;
        items.splice(at, 1);
        items.splice(to, 0, item);
        sync();
        item.buttons[which].focus();
        touch();
      };
      up.addEventListener('click', () => move(-1, 0));
      down.addEventListener('click', () => move(1, 1));
      del.addEventListener('click', () => {
        const at = items.indexOf(item);
        items.splice(at, 1);
        sync();
        (items[at]?.buttons[2] ?? items[at - 1]?.buttons[2] ?? addBtn).focus();
        touch();
      });
      return item;
    };
    const unflag = (item: Item) => {
      if (!item.el.querySelector('.ed-error')) item.el.removeAttribute('data-invalid');
    };
    for (const entry of orig as Record<string, unknown>[]) items.push(make(entry));
    addBtn.addEventListener('click', () => {
      const item = make(blank());
      items.push(item);
      sync();
      item.ctls[0]?.focus();
      touch();
    });
    sync();
    addLabel();
    wrap.append(host, addBtn);
    const anchor = h('span', { class: 'ed-sr', id: nextId('ed-help'), text: field.help });
    wrap.append(anchor);
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', field.label);
    host.setAttribute('aria-describedby', anchor.id);
    host.setAttribute('title', field.help);
    primary = host;
    getter = () =>
      items.map((item) => Object.fromEntries(item.ctls.map((c, i) => [item.names[i], c.get()])));
    locker = (on) => {
      items.forEach((item) => {
        item.ctls.forEach((c) => c.lock(on));
        item.buttons.forEach((b) => (b.disabled = on));
      });
      addBtn.disabled = on;
      if (!on) sync();
    };
    itemError = (path, message) => {
      const [index, sub] = path;
      const item = typeof index === 'number' ? items[index] : undefined;
      if (!item) return false;
      item.el.setAttribute('data-invalid', '');
      const at = item.names.indexOf(String(sub));
      if (at >= 0 && item.ctls[at].error(path.slice(2), message)) return true;
      showError(message, item.el, null);
      return true;
    };
    clearInner = () => items.forEach((i) => i.ctls.forEach((c) => c.clear()));
    uploadsOf = () => items.flatMap((item) => item.ctls.flatMap((c) => c.uploads()));
  }

  const ctl: Ctl = {
    el: wrap,
    get: () => getter(),
    changed: () => JSON.stringify(getter()) !== JSON.stringify(orig),
    error(path, message) {
      if (field.type === 'list' && path.length > 0 && itemError(path, message)) return true;
      showError(message);
      return true;
    },
    clear() {
      clearInner();
      clear();
    },
    lock: (on) => locker(on),
    uploads: () => uploadsOf(),
    focus: () => (primary instanceof HTMLElement && field.type !== 'list' ? primary : wrap.querySelector<HTMLElement>('input,select,textarea,button'))?.focus(),
  };
  return ctl;
}

function start() {
  const root = document.querySelector<HTMLElement>('[data-edit-entry]');
  if (!root) return;
  const entryKey = root.dataset.editEntry!;
  const [collection, id] = entryKey.split('/');
  const storeKey = `editor:${entryKey}`;
  const url = new URL(location.href);
  const wants = url.searchParams.has('edit');
  if (wants) {
    url.searchParams.delete('edit');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
  const open = document.querySelector<HTMLButtonElement>('[data-edit-open]');
  const refocus = sessionStorage.getItem(`${storeKey}:focus`);
  if (refocus) {
    sessionStorage.removeItem(`${storeKey}:focus`);
    open?.focus();
  }
  let entered = false;
  open?.addEventListener('click', () => enter());
  const resume = sessionStorage.getItem(storeKey) === 'on';
  if (resume) window.setTimeout(() => sessionStorage.removeItem(storeKey), 4000);
  if (wants || resume) enter();

  function enter() {
    if (entered) return;
    entered = true;
    document.documentElement.classList.add('is-editing');
    const keystaticUrl = `${BASE}keystatic/collection/${collection}/item/${id}`;
    const status = h('span', { class: 'ed-status', role: 'status', 'aria-live': 'polite', text: 'Loading…' });
    const keyLink = h('a', { class: 'ed-btn ed-btn--ghost', href: keystaticUrl, target: '_blank', rel: 'noopener', 'aria-label': 'Edit in Keystatic (new tab)' },
      h('span', { class: 'ed-long', text: 'Edit in Keystatic ↗' }), h('span', { class: 'ed-short', text: 'Keystatic ↗' }));
    const save = h('button', { type: 'button', class: 'ed-btn ed-btn--primary', disabled: true }, h('span', { text: 'Save' }), h('span', { class: 'ed-hint', text: ' Ctrl+S' }));
    const done = h('button', { type: 'button', class: 'ed-btn ed-btn--ghost', text: 'Done' });
    const reload = h('button', { type: 'button', class: 'ed-btn ed-btn--primary', text: 'Reload', hidden: true });
    const problems = h('button', { type: 'button', class: 'ed-btn ed-link', hidden: true, text: 'Show first' });
    const bar = h('div', { class: 'ed-bar' }, status, problems, keyLink, save, reload, done);
    root!.prepend(bar);

    const measure = () => document.documentElement.style.setProperty('--ed-bar-h', `${bar.offsetHeight}px`);
    measure();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(bar);

    let leaving = false;
    let dirty = false;
    let busy = false;
    const leave = () => {
      leaving = true;
      location.reload();
    };
    const exit = () => {
      sessionStorage.removeItem(storeKey);
      sessionStorage.removeItem(`${storeKey}:y`);
      sessionStorage.setItem(`${storeKey}:focus`, '1');
      leave();
    };
    done.addEventListener('click', () => {
      if (!dirty || done.dataset.armed) return exit();
      done.dataset.armed = '1';
      done.textContent = 'Discard?';
      window.setTimeout(() => {
        delete done.dataset.armed;
        done.textContent = 'Done';
      }, 3000);
    });
    reload.addEventListener('click', leave);
    window.addEventListener('beforeunload', (e) => {
      if (dirty && !leaving) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    const setStatus = (text: string, state = '', title = '') => {
      status.textContent = text;
      status.dataset.state = state;
      status.title = title;
      if (state === 'error') status.setAttribute('role', 'alert');
      else status.setAttribute('role', 'status');
    };

    if (sessionStorage.getItem(`${storeKey}:saved`)) {
      sessionStorage.removeItem(`${storeKey}:saved`);
      const y = Number(sessionStorage.getItem(`${storeKey}:y`) ?? 0);
      sessionStorage.removeItem(`${storeKey}:y`);
      setStatus('Saved ✓', 'saved');
      window.setTimeout(() => status.dataset.state === 'saved' && !dirty && setStatus('No changes', 'clean'), 4000);
      requestAnimationFrame(() => window.scrollTo(0, y));
    }

    fetch(`${BASE}__editor/${collection}/${id}`, { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status}).`);
        return body as Loaded;
      })
      .then(ready)
      .catch((err: Error) => {
        const text = err.message.length > 140 ? `${err.message.slice(0, 137)}…` : err.message;
        setStatus(text, 'error', err.message);
        save.hidden = true;
      });

    function ready(data: Loaded) {
      if (status.dataset.state !== 'saved') setStatus('No changes', 'clean');
      const fields = data.form.fields;
      const byName = new Map(fields.map((f) => [f.name, f]));
      const ctls = new Map<string, Ctl>();
      const mods = new Map<string, HTMLElement>();
      const hookedNames = new Set<string>();
      root!.querySelectorAll<HTMLElement>('[data-edit-field]').forEach((el) =>
        (el.dataset.editField ?? '').split(' ').forEach((n) => hookedNames.add(n)),
      );
      const ctx: Ctx = { labeled: true, dir: data.form.dir, onChange: () => refresh() };
      let warn: HTMLElement | null = null;
      const draftCtl = () => ctls.get('draft');
      const contribCtl = () => ctls.get('contribution');

      const create = (field: FieldDef, labeled: boolean) => {
        const ctl = makeCtl(field, field.type === 'markdown' ? data.body : data.values[field.name], { ...ctx, labeled });
        ctls.set(field.name, ctl);
        mods.set(field.name, ctl.el);
        return ctl;
      };

      root!.querySelectorAll<HTMLElement>('[data-edit-field]').forEach((el) => {
        const editable = (el.dataset.editField ?? '').split(' ').map((n) => byName.get(n)).filter((f): f is FieldDef => Boolean(f));
        if (editable.length === 0) return;
        const anchor = el.closest('picture') ?? el;
        const host = h(el.tagName === 'SPAN' ? 'span' : 'div', { class: `ed-inplace ed-in-${el.tagName.toLowerCase()}` });
        const section = el.tagName === 'SECTION';
        const heading = el.querySelector('h2')?.textContent ?? editable[0].label;
        if (section) host.append(h('p', { class: 'ed-heading', text: heading }));
        const compact = el.matches('h1, p, span, time, ul.tags');
        for (const f of editable) {
          const ctl = create(f, section ? editable.length > 1 : !compact);
          host.append(ctl.el);
          if (f.name === 'contribution') {
            const h2 = el.closest('section')?.querySelector('h2');
            if (h2) {
              if (!h2.id) h2.id = nextId('ed-h2');
              ctl.el.querySelector('.ed-in')?.setAttribute('aria-labelledby', h2.id);
            }
          }
        }
        anchor.classList.add('ed-hide');
        anchor.after(host);
        if (el.matches('.badge, .detail__meta span')) host.classList.add('ed-inline');
      });

      const panelFields = fields.filter((f) => !hookedNames.has(f.name));
      let panel: HTMLElement | null = null;
      if (panelFields.length) {
        const bools = panelFields.filter((f) => f.type === 'boolean');
        const rest = panelFields.filter((f) => f.type !== 'boolean');
        const grid = h('div', { class: 'ed-panel__grid' });
        if (bools.length) grid.append(h('div', { class: 'ed-bools' }, ...bools.map((f) => create(f, true).el)));
        for (const f of rest) grid.append(create(f, true).el);
        warn = h('p', { class: 'ed-warn', hidden: true, text: 'Published, but "What I did" is empty: the build leaves this entry out.' });
        const panelBox = h('div', { class: 'ed-panel__alerts' });
        panel = h('details', { class: 'ed-panel', open: true }, h('summary', { text: `Not on the page (${panelFields.length})` }), panelBox, grid, warn);
        bar.after(panel);
      }
      const alerts = () => panel?.querySelector<HTMLElement>('.ed-panel__alerts') ?? null;

      const allCtls = () => [...ctls.entries()];
      const sets = () => {
        const set: Record<string, unknown> = {};
        for (const [name, ctl] of allCtls()) {
          if (name === 'body' && byName.get(name)?.type === 'markdown') continue;
          if (ctl.changed()) set[name] = payload(byName.get(name)!, ctl.get());
        }
        return set;
      };
      const bodyField = fields.find((f) => f.type === 'markdown');
      const bodyCtl = () => (bodyField ? ctls.get(bodyField.name) : undefined);

      function refresh() {
        let any = false;
        for (const [name, ctl] of allCtls()) {
          const on = ctl.changed();
          any = any || on;
          mods.get(name)?.toggleAttribute('data-mod', on);
        }
        dirty = any;
        if (warn) {
          const draft = draftCtl();
          const contrib = contribCtl();
          warn.hidden = !(draft && contrib && draft.get() === false && String(contrib.get()).trim() === '');
        }
        if (busy) return;
        save.disabled = !dirty;
        if (dirty) setStatus(window.matchMedia('(max-width: 40rem)').matches ? '● Unsaved' : '● Unsaved changes', 'unsaved');
        else if (status.dataset.state !== 'saved') setStatus('No changes', 'clean');
      }
      refresh();

      const lockAll = (on: boolean) => {
        busy = on;
        save.disabled = on || !dirty;
        save.toggleAttribute('aria-busy', on);
        for (const [, ctl] of allCtls()) ctl.lock(on);
      };

      let firstIssue: HTMLElement | null = null;
      const show = () => {
        if (panel) panel.open = true;
        const target = firstIssue;
        if (!target) return;
        target.scrollIntoView({ block: 'center' });
        const input = target.closest('.ed-field')?.querySelector<HTMLElement>('.ed-in, button, select, input, textarea') ?? target;
        input.focus({ preventScroll: true });
      };
      problems.addEventListener('click', show);

      const clearIssues = () => {
        firstIssue = null;
        problems.hidden = true;
        panel?.querySelectorAll('.ed-alert').forEach((n) => n.remove());
      };

      async function doSave() {
        if (busy || !dirty) return;
        clearIssues();
        const set = sets();
        const body: Record<string, unknown> = { hash: data.hash, set };
        const bc = bodyCtl();
        if (bc?.changed()) body.body = bc.get();
        lockAll(true);
        setStatus('Saving…', 'saving');
        let res: Response;
        try {
          const pending = allCtls().flatMap(([, ctl]) => ctl.uploads());
          if (pending.length) {
            body.uploads = await Promise.all(
              pending.map(async ({ token, file }) => ({ token, name: file.name, data: await toBase64(file) })),
            );
          }
          res = await fetch(`${BASE}__editor/${collection}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        } catch {
          lockAll(false);
          setStatus('Could not reach the dev server.', 'error');
          return;
        }
        const out = await res.json().catch(() => ({}));
        lockAll(false);
        if (res.ok) {
          sessionStorage.setItem(storeKey, 'on');
          sessionStorage.setItem(`${storeKey}:y`, String(window.scrollY));
          sessionStorage.setItem(`${storeKey}:saved`, '1');
          leaving = true;
          location.reload();
          return;
        }
        if (res.status === 409) {
          const narrow = window.matchMedia('(max-width: 40rem)').matches;
          setStatus(narrow ? 'Changed elsewhere. Not saved.' : 'Changed elsewhere since you opened it. Nothing was written.', 'error');
          save.hidden = true;
          reload.hidden = false;
          window.removeEventListener('keydown', onKey);
          dirty = false;
          return;
        }
        if (res.status === 422 && Array.isArray(out.issues)) {
          const issues = out.issues as { path: Path; message: string }[];
          for (const issue of issues) {
            const [name, ...rest] = issue.path;
            const ctl = ctls.get(String(name));
            let placed = false;
            if (ctl) placed = ctl.error(rest, issue.message);
            if (!placed) {
              const box = alerts();
              const alert = h('p', { class: 'ed-alert', role: 'alert', text: `${issue.path.join('.')}: ${issue.message}` });
              (box ?? bar).append(alert);
              if (!firstIssue) firstIssue = alert;
            } else if (!firstIssue) {
              firstIssue = ctl!.el.querySelector<HTMLElement>('.ed-error') ?? ctl!.el;
            }
          }
          const n = issues.length;
          const narrow = window.matchMedia('(max-width: 40rem)').matches;
          setStatus(`${n} problem${n === 1 ? '' : 's'}${narrow ? '' : ' ·'}`, 'error');
          problems.hidden = false;
          problems.textContent = narrow ? 'Show' : 'Show first';
          refreshKeep();
          return;
        }
        const message = String(out?.error ?? `Request failed (${res.status}).`);
        setStatus(message.length > 140 ? `${message.slice(0, 137)}…` : message, 'error', message);
      }
      const refreshKeep = () => {
        save.disabled = !dirty;
      };

      const onKey = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          void doSave();
        } else if (e.key === 'Escape' && !dirty && !busy) {
          exit();
        }
      };
      window.addEventListener('keydown', onKey);
      save.addEventListener('click', () => void doSave());
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dirty && !document.querySelector('.ed-field')) exit();
    });
  }
}

start();
