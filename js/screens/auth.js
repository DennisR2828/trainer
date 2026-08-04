/* Sign in / create account.
 *
 * Gates the whole app: nothing else renders until this resolves. Styled with
 * the existing onboarding classes so it reads as the same product rather than
 * a bolted-on login page.
 */

import { login, register, ApiError, OfflineError } from '../api.js';

const h = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v != null && v !== false) n.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};

export function renderAuth(mount, { onAuthed }) {
  let mode = 'signin'; // 'signin' | 'signup'
  let busy = false;

  draw();

  function draw() {
    const signup = mode === 'signup';

    const email = h('input', {
      class: 'num-input', type: 'email', name: 'email', placeholder: 'you@example.com',
      autocomplete: 'username', inputmode: 'email', autocapitalize: 'none', autocorrect: 'off', required: true,
    });
    const password = h('input', {
      class: 'num-input', type: 'password', name: 'password', placeholder: signup ? 'At least 8 characters' : 'Password',
      autocomplete: signup ? 'new-password' : 'current-password', required: true,
    });
    const name = h('input', {
      class: 'num-input', type: 'text', name: 'name', placeholder: 'First name',
      autocomplete: 'given-name', autocapitalize: 'words',
    });
    const code = h('input', {
      class: 'num-input', type: 'text', name: 'code', placeholder: 'Signup code',
      autocapitalize: 'none', autocorrect: 'off', required: true,
    });
    const remember = h('input', { type: 'checkbox', id: 'auth-remember', checked: true });

    const err = h('p', { class: 'ob-err', role: 'alert' }, '');
    const submit = h('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, signup ? 'Create account' : 'Sign in');

    const field = (label, input) => h('label', { class: 'auth-field' }, [
      h('span', { class: 'auth-label' }, label),
      input,
    ]);

    const form = h('form', { class: 'auth-form', novalidate: true, onSubmit: (e) => { e.preventDefault(); go(); } }, [
      signup ? field('Name', name) : null,
      field('Email', email),
      field('Password', password),
      signup ? field('Signup code', code) : null,
      h('label', { class: 'auth-remember', for: 'auth-remember' }, [
        remember,
        h('span', {}, 'Keep me signed in'),
      ]),
      err,
      submit,
    ]);

    mount.innerHTML = '';
    mount.append(h('div', { class: 'ob-center auth-screen' }, [
      h('div', { class: 'ob-badge' }, '◇'),
      h('h1', {}, signup ? 'Create your account' : 'Welcome back'),
      h('p', { class: 'muted' }, signup
        ? 'Your plan and logs sync to your account, so they follow you to any device.'
        : 'Sign in to load your plan, workouts, and history.'),
      form,
      h('button', {
        class: 'btn btn-ghost auth-toggle', type: 'button',
        onClick: () => { mode = signup ? 'signin' : 'signup'; draw(); },
      }, signup ? 'I already have an account' : 'Create an account'),
    ]));

    // Focus the first empty field so the keyboard opens on the right one.
    (signup ? name : email).focus();

    async function go() {
      if (busy) return;
      err.textContent = '';

      const payload = {
        email: email.value.trim(),
        password: password.value,
        ...(signup ? { name: name.value.trim(), code: code.value.trim() } : {}),
      };
      if (!payload.email || !payload.password) {
        err.textContent = 'Enter your email and password.';
        return;
      }
      if (signup && !payload.code) {
        err.textContent = 'Enter the signup code.';
        return;
      }

      busy = true;
      submit.disabled = true;
      submit.textContent = signup ? 'Creating…' : 'Signing in…';

      try {
        const user = signup
          ? await register(payload, remember.checked)
          : await login(payload, remember.checked);
        onAuthed(user);
      } catch (e) {
        busy = false;
        submit.disabled = false;
        submit.textContent = signup ? 'Create account' : 'Sign in';
        if (e instanceof OfflineError) {
          err.textContent = 'You are offline. Signing in needs a connection the first time.';
        } else if (e instanceof ApiError) {
          err.textContent = e.message;
        } else {
          err.textContent = 'Something went wrong. Try again.';
        }
      }
    }
  }
}
