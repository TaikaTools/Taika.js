# Taika.js - Fluent DOM Poetry

**No build. No dependencies. Pure love.**

Taika.js is a tiny (~5KB minified) vanilla JavaScript library for expressive, fluent DOM creation and manipulation.

Write HTML like poetry:

```js
$el('div', { class: 'card', style: { padding: '2rem' } })
  .div({ class: 'header' }, h => h
    .h1('Welcome to Taika')
    .p('Light as a haiku, powerful as a saga.')
  )
  .div({ class: 'buttons' }, b => b
    .button({ onClick: () => alert('Clicked!') }, 'Click me')
    .button({ disabled: true }, 'Disabled')
  )
  .insert('body');
