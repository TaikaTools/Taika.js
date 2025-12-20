/* Taika.js
 * Fluent DOM poetry — no build, no deps, pure love
 * MIT © Daniel Taika + Grok.v4 2025
 * -------------------------------------------------- */

;(() => {
  'use strict';

  const ready = (fn) => {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };

  const BOOL_ATTRS = new Set(['checked','selected','disabled','required','autoplay','loop','muted','controls']);

  const $ = (s) => {
    const el = document.querySelector(s);
    if (el) {
      el.clear = () => (el.replaceChildren(), el);
      el.set = (child) => (el.clear().appendChild(child?.el || child), el);
    }
    return el;
  };
  window.$ = $;
  window.$$ = document.querySelectorAll.bind(document);

  class Element {
    constructor(tag, opts = {}) {
      this.el = document.createElement(tag);
      this.#apply(opts);
      return this.#proxy();
    }

    #eventMap = new WeakMap();

    #addListener(event, fn) {
      let map = this.#eventMap.get(this.el);
      if (!map) { map = {}; this.#eventMap.set(this.el, map); }
      (map[event] = map[event] || []).push(fn);
    }

    #removeAllListeners() {
      const map = this.#eventMap.get(this.el);
      if (!map) return;
      Object.entries(map).forEach(([event, fns]) => {
        fns.forEach(fn => this.el.removeEventListener(event, fn));
      });
      this.#eventMap.delete(this.el);
    }

    #apply(opts) {
      if (!opts || typeof opts !== 'object') return;
      const { id, class: cls, text, html, style, on = {}, ...attrs } = opts;

      if (id) this.el.id = id;
      if (html != null) this.el.innerHTML = html;
      if (text != null) this.el.textContent = text;
      if (cls) {
        const list = Array.isArray(cls) ? cls : String(cls).trim().split(/\s+/);
        this.el.classList.add(...list.filter(Boolean));
      }
      if (style != null) {
        if (typeof style === 'string') {
          this.el.style.cssText = style;
        }
        else if (style && typeof style === 'object' && !Array.isArray(style)) {
          Object.keys(style).forEach(key => {
            if (typeof key === 'string' && key) {
              const prop = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
              const value = style[key];
              if (value != null) {
                this.el.style[prop] = value;
              }
            }
          });
        }
        else if (Array.isArray(style)) {
          this.el.style.cssText = style
            .filter(s => typeof s === 'string')
            .join('; ');
        }
      }

      Object.entries(on).forEach(([key, handler]) => {
        if (typeof handler !== 'function') return;
        const eventName = key.replace(/^on/i, '').toLowerCase();
        this.el.addEventListener(eventName, handler);
        this.#addListener(eventName, handler);
      });

      Object.entries(attrs).forEach(([key, handler]) => {
        if (typeof key !== 'string' || !key) return;
        if (key.toLowerCase().startsWith('on')) { // Catching nested, e.g. onClick events
          const eventName = key.slice(2).toLowerCase(); // "onclick" → "click"
          if (typeof handler === 'function') {
            this.el.addEventListener(eventName, handler);
            this.#addListener(eventName, handler);
          }
          return; // don't set as attribute
        }

        const name = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
        if (BOOL_ATTRS.has(name)) {
          const val = Boolean(handler);
          this.el[name] = val;
          if (val) this.el.setAttribute(name, '');
          else this.el.removeAttribute(name);
        } else if (handler != null) {
          this.el.setAttribute(name, String(handler));
        }
      });
    }

    #proxy() {
      const t = this;
      return new Proxy(this, {

        get(target, p, receiver) {
          const el = t.el;
          if (typeof p === 'symbol') return undefined;
          if (p in el) return Reflect.get(el, p, el);
          if (p in t) return Reflect.get(t, p, t);

          if (p === 'classAdd') {
            return (...cls) => { el.classList.add(...cls.filter(Boolean)); return receiver; };
          }
          if (p === 'classRemove') {
            return (...cls) => { el.classList.remove(...cls.filter(Boolean)); return receiver; };
          }
          if (p === 'classToggle') {
            return (cls, force) => { el.classList.toggle(cls, force); return receiver; };
          }

          if (p === 'data') {
            return new Proxy({}, {
              get(_, prop) {
                const key = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                return el.dataset[key];
              },
              set(_, prop, val) {
                const key = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                el.dataset[key] = val == null ? '' : String(val);
                return true;
              },
              deleteProperty(_, prop) {
                const key = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                delete el.dataset[key];
                return true;
              }
            });
          }


          if (p === 'apply') {
            return (data, fn) => {
              if (typeof fn !== 'function' || data == null) return receiver;

              const add = node => node?.el ? this.el.appendChild(node.el) : node instanceof Node && this.el.appendChild(node);
              const addAll = r => Array.isArray(r) ? r.forEach(add) : add(r);

              // 1. Plain object → map mode (key, value)
              if (data && typeof data === 'object' && !Array.isArray(data)) {
                Object.entries(data).forEach(([k, v], i) => addAll(fn(k, v, i)));
                return receiver;
              }

              // 2. Array (or iterable)
              const arr = [...data];

              // Detect perfect {key: value} map array (your beloved case)
              const isPerfectMap = arr.length && arr.every(o => 
                o && typeof o === 'object' && Object.keys(o).length === 1
              );
              const keys = isPerfectMap ? arr.map(o => Object.keys(o)[0]) : [];
              const uniqueKeys = new Set(keys);

              if (isPerfectMap && keys.length === uniqueKeys.size) {
                // → map mode: fn(key, value, i)
                arr.forEach((obj, i) => {
                  const k = keys[i];
                  addAll(fn(k, obj[k], i));
                });
              } else {
                // → normal list mode: fn(item, i)
                arr.forEach((item, i) => addAll(fn(item, i)));
              }

              return receiver;
            };
          }

          if (p === 'applyOLD') {
            return (items, fn) => {
              if (typeof fn !== 'function') return receiver;

              if (items == null || items.length === 0) return;

              let flags = 8;
              const seenKeys = new Set();

              if (!Array.isArray(items)) {
                if (typeof items !== 'object' || Object.keys(items).length === 0 ) return console.log(`Expected object or array, got ${typeof items}`);
                flags |= 1;
              } else {
                for (const item of items) {
                  if (item === null || typeof item !== 'object' || typeof item === 'function') {
                    flags |= 4;
                  } else if (Array.isArray(item)) {
                    flags |= 4;
                  } else {
                    flags |= 2;

                    const keys = Object.keys(item);
                    if (keys.length !== 1) flags &= ~8;
                    else if ((flags & 8) != 0) {
                      const key = keys[0];
                      if (seenKeys.has(key)) flags &= ~8;
                      seenKeys.add(key);
                    }
                  }
                }
              }

              const createTemp = () => {
                const temp = new Element('div');
                return temp.proxy(); // This proxy has FULL set trap???
              };

              if ((flags & 2) != 0 && (flags & 4) != 0 ) return console.warn( `Mixed array not allowed, got ${JSON.stringify(item)}`);
              if ((flags & 1) != 0 || ((flags & 8) != 0 && seenKeys.size === item.length)) {
                forEachAsMap(items, (value, key) => {
                  const temp = createTemp(); //WILL CREATE THE BUG
                  fn.call(temp, key, value, i, items);
                  el.append(...temp.el.children);
                });
              }
              if ((flags & 2) != 0) {
                Object.entries(items).forEach(([value, key], i) => {
                  const temp = createTemp(); //WILL CREATE THE BUG
                  fn.call(temp, key, value, i, items);
                  el.append(...temp.el.children);
                });
              } else {
                items.forEach((item, index, array) => {
                  const temp = createTemp(); //WILL CREATE THE BUG
                  fn.call(temp, item, index, array); // call on temp (with proxy, not perfect)
                  el.append(...temp.el.children);
                });
              }
              return receiver;
            }
          };

          if (typeof p === 'string' && /^on[A-Z]/.test(p)) { // Allow .onClick(fn) in chaining
            return fn => {
              if (typeof fn === 'function') {
                const e = p.slice(2).toLowerCase();
                el.addEventListener(e, fn);
                t.#addListener(e, fn);
              }
              return receiver;
            };
          }

          if (p === 'addEvent') {
            return (event, fn) => {
              if (typeof fn === 'function' && typeof event === 'string') {
                const e = event.toLowerCase();
                el.addEventListener(e, fn);
                t.#addListener(e, fn);
              }
              return receiver;
            };
          }

          if (typeof p === 'string' && (p === 'body' || p === 'head' || /^[#.]/.test(p))) {
            return () => t.insert(p === 'body' ? document.body : p === 'head' ? document.head : p);
          }

          if (p === 'before' || p === 'after') {
            return ref => {
              const r = ref?.el || ref;
              if (!r?.parentNode) return receiver;
              if (p === 'before') r.parentNode.insertBefore(el, r);
              if (p === 'after') r.parentNode.insertBefore(el, r.nextSibling);
              return receiver;
            };
          }

          if (typeof p === 'string' && /^[a-z]/i.test(p)) { // TAG CREATORS — SUPPORTS CALLBACKS
            return (opts, fn) => {
              const child = new Element(p, typeof opts === 'object' ? opts : {});
              el.appendChild(child.el);
              if (typeof fn === 'function') fn(child); // If second argument is function → run it on child
              else if (typeof opts === 'function') opts(child);
              return receiver;
            };
          }
          return undefined;
        },

        set(target, p, value, receiver) {
          const el = t.el;
          if (p === 'text') {
            el.textContent = value;
            return true;
          }
          if (p === 'html') {
            el.innerHTML = value;
            return true;
          }          
          if (p === 'text' && typeof value === 'string') {
            const current = el.textContent ?? '';
            if (current && typeof el.textContent === 'string') {
              el.textContent += value;
              return true;
            }
          }
          if (p === 'html' && typeof value === 'string') {
            const template = document.createElement('template');
            template.innerHTML = value.trim();
            el.append(...template.content.childNodes);  // childNodes = preserves text nodes too
            return true;
          }
          if (p === 'id') { el.id = value; return true; }
          if (p === 'class') { el.className = value; return true; }
          if (p === 'style') {
            if (typeof value === 'string') el.style.cssText = value;
            else if (value && typeof value === 'object') Object.assign(el.style, value);
            return true;
          }

          if (p === 'data') {
            if (value === null || typeof value !== 'object') {
              for (let key of el.dataset.keys()) el.dataset[key] = '';
              return true;
            }
            Object.entries(value).forEach(([k, v]) => {
              const key = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
              el.dataset[key] = v == null ? '' : String(v);
            });
            return true;
          }

          return Reflect.set(target, p, value, receiver);
        }
      });
    }

    insert(target = document.body) { // Should we support htmlText?
      ready(() => {
        const parent = typeof target === 'string' ? $(target) : target?.el || target;
        if (parent && !parent.contains(this.el)) {
          parent.appendChild(this.el);
        }
      });
      return this;
    }

    destroy() {
      this.body().remove();
    }

    remove() {
      this.#removeAllListeners();
      this.el?.remove();
      return this;
    }

    clear() {
      Array.from(this.el.children).forEach(child => {
        const wrapper = child._taikaWrapper;
        if (wrapper) wrapper.#removeAllListeners();
      });      
      this.el?.replaceChildren();
      return this;
    }
  }

  const orig = Node.prototype.appendChild;
  Node.prototype.appendChild = function(child) {
    if (child && child.el) child = child.el;
    return orig.call(this, child);
  };

  window.Element = Element;
  window.$el = (t, o) => new Element(t, o);

  ready(() => {
console.log('%cTaika.js — Fluent DOM Poetry — MIT © Daniel Taika + Grok.v4 2025', 'background:#000;color:#00ff88;font-weight:bold;padding:1rem;font-size:1rem');  });
})();
