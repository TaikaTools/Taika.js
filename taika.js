/* Taika.js - $x/$el [XL]
 * Fluent DOM poetry — no build, no deps, pure love
 * MIT © Daniel Taika + Grok.v4 2025
 * -------------------------------------------------- */

;(() => {
  'use strict';

  const BOOL_ATTRS = new Set(['checked','selected','disabled','required','autoplay','loop','muted','controls']);

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
          const eventName = key.slice(2).toLowerCase(); // "onclick" == "click"
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
                // map mode: fn(key, value, i)
                arr.forEach((obj, i) => {
                  const k = keys[i];
                  addAll(fn(k, obj[k], i));
                });
              } else {
                // normal list mode: fn(item, i)
                arr.forEach((item, i) => addAll(fn(item, i)));
              }

              return receiver;
            };
          }

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
            return () => t.into(p === 'body' ? document.body : p === 'head' ? document.head : p);
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
              if (typeof fn === 'function') fn(child); // If second argument is function == run it on child
              else if (typeof opts === 'function') opts(child);
              return receiver;
            };
          }
          return undefined;
        },

        set(target, p, value, receiver) {
          const el = t.el;
          if (p === 'id') { el.id = value; return true; }
          if (p === 'class') { el.className = value; return true; }
          if (p === 'text') { el.textContent = value; return true; }
          if (p === 'html') { el.innerHTML = value; return true; }
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

    into(target = document.body) {
      const parent = typeof target === 'string' ? $(target) : target?.el || target;
      if (parent && !parent.contains(this.el)) {
        parent.appendChild(this.el);
      }
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

    set(el, clear = true) {
      if(clear) this.clear();
      this.el?.appendChild(el?.el || el);
    }

    static wrap(domElement) {
      if (!domElement?.nodeType) return null;
      if (domElement._taikaWrapper) return domElement._taikaWrapper;

      const wrapper = new Element('div');
      wrapper.el = domElement;
      domElement._taikaWrapper = wrapper;

      return wrapper.proxy();   // cry, cry...
    }
  }

  const orig = Node.prototype.appendChild;
  Node.prototype.appendChild = function(child) {
    if (child && child.el) child = child.el;
    return orig.call(this, child);
  };

  window.Element = Element;
  window.$ = (s) => {
    if (!s) return null;
    const el = s.startsWith('#') || s.startsWith('.') ? document.querySelector(s) : document.getElementById(s);    
    if (!el) return null;
    return Element.wrap(el);
  };
  window.$$ = (s) => Array.from(document.querySelectorAll(s)).map(Element.wrap);
  window.$el = (t, o) => new Element(t, o);

  console.log('%cTaika.js — Fluent DOM Poetry — MIT © Daniel Taika + Grok.v4 2025', 'background:#000;color:#00ff88;font-weight:bold;padding:1rem;font-size:1rem'); 
})();

async function $x(name, options={}) {
  try {
    const globalName = `$x${name}`;
    if (globalThis[globalName]) return globalThis[globalName];    // cached

    await loadResource(`${name}.js`, 'js');
    const ComponentClass = globalThis[globalName];
    if (!ComponentClass) {
      throw new Error(`Class $x${name} not found after loading ${name}.js`);
    }

    const instance = new ComponentClass(options);    // Create instance
    if( instance.init ) await instance.init();

    return globalThis[globalName] = instance;
  } catch (err) {
    console.error(`Loading $x${name} failed:`, err);
    throw err;
  }
}

// Load a single JS or CSS file and return a Promise
function loadResource(url, type = 'js') {
  return new Promise((resolve, reject) => {
    let element;

    if (type === 'js') {
      element = document.createElement('script');
      element.type = 'text/javascript';
      element.src = 'containers/'+url;
      element.async = true;
    } else if (type === 'css') {
      element = document.createElement('link');
      element.rel = 'stylesheet';
      element.type = 'text/css';
      element.href = 'containers/'+url;
    } else {
      reject(new Error('Unsupported type'));
      return;
    }

    element.onload = () => resolve(element);    // Success
    element.onerror = () => reject(new Error(`Failed to load ${url}`));    // Failure

    document.head.appendChild(element);    // Add to head
  });
}
